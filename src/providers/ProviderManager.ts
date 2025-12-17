import { ethers, JsonRpcProvider, WebSocketProvider } from 'ethers';
import { EventEmitter } from 'events';
import {
  ChainId,
  RpcEndpoint,
  ProviderHealth,
  ProviderStatus,
  HealthCheckResult,
  IProviderManager
} from '../types';
import { RpcEndpointRepository } from '../database/postgres';
import { redisClient } from '../database/redis';
import { logger } from '../utils/logger';
import { ProviderError, ChainNotSupportedError } from '../utils/errors';
import {
  withRetry,
  CircuitBreakerState,
  createCircuitBreakerState,
  withCircuitBreaker
} from '../utils/retry';
import { config, getChainConfig, isValidChainId } from '../config';

interface ProviderInstance {
  endpoint: RpcEndpoint;
  provider: JsonRpcProvider;
  wsProvider?: WebSocketProvider;
  health: ProviderHealth;
  circuitBreaker: CircuitBreakerState;
}

export class ProviderManager extends EventEmitter implements IProviderManager {
  private providers: Map<ChainId, ProviderInstance[]> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private repository: RpcEndpointRepository;

  constructor(repository: RpcEndpointRepository) {
    super();
    this.repository = repository;
  }

  async initialize(): Promise<void> {
    const endpoints = await this.repository.findAll();
    
    for (const endpoint of endpoints) {
      await this.addProvider(endpoint);
    }

    this.startHealthChecks();
    logger.info('ProviderManager initialized', {
      chainCount: this.providers.size,
      totalProviders: endpoints.length
    });
  }

  async addProvider(endpoint: RpcEndpoint): Promise<void> {
    try {
      const provider = new JsonRpcProvider(
        endpoint.apiKey ? `${endpoint.httpUrl}${endpoint.apiKey}` : endpoint.httpUrl,
        endpoint.chainId,
        { staticNetwork: true }
      );

      let wsProvider: WebSocketProvider | undefined;
      if (endpoint.wsUrl) {
        try {
          wsProvider = new WebSocketProvider(
            endpoint.apiKey ? `${endpoint.wsUrl}${endpoint.apiKey}` : endpoint.wsUrl,
            endpoint.chainId
          );
        } catch (error) {
          logger.warn('Failed to create WebSocket provider', {
            endpointId: endpoint.id,
            error: (error as Error).message
          });
        }
      }

      const instance: ProviderInstance = {
        endpoint,
        provider,
        wsProvider,
        health: {
          endpointId: endpoint.id,
          status: ProviderStatus.HEALTHY,
          latency: 0,
          lastCheck: new Date(),
          errorCount: 0,
          successCount: 0,
          blockHeight: 0
        },
        circuitBreaker: createCircuitBreakerState()
      };

      const chainProviders = this.providers.get(endpoint.chainId) || [];
      chainProviders.push(instance);
      chainProviders.sort((a, b) => a.endpoint.priority - b.endpoint.priority);
      this.providers.set(endpoint.chainId, chainProviders);

      logger.info('Provider added', {
        endpointId: endpoint.id,
        chainId: endpoint.chainId,
        providerType: endpoint.providerType
      });
    } catch (error) {
      logger.error('Failed to add provider', {
        endpointId: endpoint.id,
        error: (error as Error).message
      });
    }
  }

  async removeProvider(endpointId: string): Promise<void> {
    for (const [chainId, instances] of this.providers.entries()) {
      const index = instances.findIndex((i) => i.endpoint.id === endpointId);
      if (index !== -1) {
        const instance = instances[index];
        instance.provider.destroy();
        if (instance.wsProvider) {
          await instance.wsProvider.destroy();
        }
        instances.splice(index, 1);
        this.providers.set(chainId, instances);
        logger.info('Provider removed', { endpointId, chainId });
        return;
      }
    }
  }

  async getProvider(chainId: ChainId): Promise<JsonRpcProvider> {
    if (!isValidChainId(chainId)) {
      throw new ChainNotSupportedError(chainId);
    }

    const instances = this.providers.get(chainId);
    if (!instances || instances.length === 0) {
      throw new ProviderError(`No providers available for chain ${chainId}`);
    }

    const healthyInstances = instances.filter(
      (i) => i.health.status !== ProviderStatus.UNHEALTHY && i.circuitBreaker.state !== 'open'
    );

    if (healthyInstances.length === 0) {
      logger.warn('No healthy providers, falling back to any available', { chainId });
      return instances[0].provider;
    }

    const selected = this.selectProvider(healthyInstances);
    return selected.provider;
  }

  async getWebSocketProvider(chainId: ChainId): Promise<WebSocketProvider | null> {
    const instances = this.providers.get(chainId);
    if (!instances) {
      return null;
    }

    const withWs = instances.find(
      (i) => i.wsProvider && i.health.status !== ProviderStatus.UNHEALTHY
    );
    return withWs?.wsProvider || null;
  }

  async executeRequest(chainId: ChainId, method: string, params: unknown[]): Promise<unknown> {
    if (!isValidChainId(chainId)) {
      throw new ChainNotSupportedError(chainId);
    }

    const instances = this.providers.get(chainId);
    if (!instances || instances.length === 0) {
      throw new ProviderError(`No providers available for chain ${chainId}`);
    }

    const sortedInstances = [...instances].sort((a, b) => {
      if (a.health.status !== b.health.status) {
        return a.health.status === ProviderStatus.HEALTHY ? -1 : 1;
      }
      return a.endpoint.priority - b.endpoint.priority;
    });

    let lastError: Error | undefined;

    for (const instance of sortedInstances) {
      if (instance.circuitBreaker.state === 'open') {
        continue;
      }

      try {
        const result = await withCircuitBreaker(
          async () => {
            const startTime = Date.now();
            const response = await withRetry(
              () => instance.provider.send(method, params),
              {
                maxRetries: instance.endpoint.maxRetries,
                timeout: instance.endpoint.timeout
              },
              `${method}@${instance.endpoint.id}`
            );
            
            this.updateProviderHealth(instance, true, Date.now() - startTime);
            return response;
          },
          instance.circuitBreaker,
          { failureThreshold: 5, resetTimeout: 30000 }
        );

        return result;
      } catch (error) {
        lastError = error as Error;
        this.updateProviderHealth(instance, false);
        logger.warn('Provider request failed, trying next', {
          endpointId: instance.endpoint.id,
          method,
          error: lastError.message
        });
      }
    }

    throw new ProviderError(`All providers failed for ${method}`, {
      chainId,
      lastError: lastError?.message
    });
  }

  async getHealthyProviders(chainId: ChainId): Promise<RpcEndpoint[]> {
    const instances = this.providers.get(chainId);
    if (!instances) {
      return [];
    }

    return instances
      .filter((i) => i.health.status !== ProviderStatus.UNHEALTHY)
      .map((i) => i.endpoint);
  }

  getProviderHealth(chainId: ChainId): ProviderHealth[] {
    const instances = this.providers.get(chainId);
    if (!instances) {
      return [];
    }
    return instances.map((i) => i.health);
  }

  getAllProviderHealth(): Map<ChainId, ProviderHealth[]> {
    const result = new Map<ChainId, ProviderHealth[]>();
    for (const [chainId, instances] of this.providers.entries()) {
      result.set(
        chainId,
        instances.map((i) => i.health)
      );
    }
    return result;
  }

  private selectProvider(instances: ProviderInstance[]): ProviderInstance {
    const totalWeight = instances.reduce((sum, i) => sum + i.endpoint.weight, 0);
    let random = Math.random() * totalWeight;

    for (const instance of instances) {
      random -= instance.endpoint.weight;
      if (random <= 0) {
        return instance;
      }
    }

    return instances[0];
  }

  private updateProviderHealth(
    instance: ProviderInstance,
    success: boolean,
    latency?: number
  ): void {
    if (success) {
      instance.health.successCount++;
      instance.health.errorCount = 0;
      if (latency !== undefined) {
        instance.health.latency = latency;
      }
      instance.health.status = ProviderStatus.HEALTHY;
    } else {
      instance.health.errorCount++;
      if (instance.health.errorCount >= 3) {
        instance.health.status = ProviderStatus.UNHEALTHY;
      } else if (instance.health.errorCount >= 1) {
        instance.health.status = ProviderStatus.DEGRADED;
      }
    }
    instance.health.lastCheck = new Date();

    this.cacheProviderHealth(instance.health);
  }

  private async cacheProviderHealth(health: ProviderHealth): Promise<void> {
    try {
      await redisClient.hset(
        `provider:health:${health.endpointId}`,
        'status',
        health.status
      );
      await redisClient.hset(
        `provider:health:${health.endpointId}`,
        'latency',
        health.latency.toString()
      );
      await redisClient.hset(
        `provider:health:${health.endpointId}`,
        'lastCheck',
        health.lastCheck.toISOString()
      );
      await redisClient.expire(`provider:health:${health.endpointId}`, 300);
    } catch (error) {
      logger.warn('Failed to cache provider health', {
        endpointId: health.endpointId,
        error: (error as Error).message
      });
    }
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, config.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    for (const [chainId, instances] of this.providers.entries()) {
      for (const instance of instances) {
        try {
          const startTime = Date.now();
          const blockNumber = await instance.provider.getBlockNumber();
          const latency = Date.now() - startTime;

          instance.health.blockHeight = blockNumber;
          this.updateProviderHealth(instance, true, latency);
        } catch (error) {
          this.updateProviderHealth(instance, false);
          logger.warn('Health check failed', {
            endpointId: instance.endpoint.id,
            chainId,
            error: (error as Error).message
          });
        }
      }
    }

    this.emit('healthCheckComplete', this.getAllProviderHealth());
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const allHealth = this.getAllProviderHealth();
    let totalProviders = 0;
    let healthyProviders = 0;

    for (const healths of allHealth.values()) {
      for (const health of healths) {
        totalProviders++;
        if (health.status === ProviderStatus.HEALTHY) {
          healthyProviders++;
        }
      }
    }

    const healthRatio = totalProviders > 0 ? healthyProviders / totalProviders : 0;

    return {
      service: 'provider-manager',
      status: healthRatio >= 0.5 ? 'healthy' : healthRatio > 0 ? 'degraded' : 'unhealthy',
      details: {
        totalProviders,
        healthyProviders,
        chainCount: this.providers.size
      }
    };
  }

  async stop(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    for (const instances of this.providers.values()) {
      for (const instance of instances) {
        instance.provider.destroy();
        if (instance.wsProvider) {
          await instance.wsProvider.destroy();
        }
      }
    }

    this.providers.clear();
    logger.info('ProviderManager stopped');
  }
}
