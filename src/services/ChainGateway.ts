import { EventEmitter } from 'events';
import {
  ChainId,
  GasPrice,
  RpcRequest,
  RpcResponse,
  HealthCheckResult,
  SubscriptionConfig,
  ReorgEvent
} from '../types';
import { ProviderManager } from '../providers/ProviderManager';
import { GasPriceOracle } from './GasPriceOracle';
import { NonceManager } from './NonceManager';
import { ReorgDetector } from './ReorgDetector';
import { SubscriptionManager } from './SubscriptionManager';
import { RateLimiter } from './RateLimiter';
import { HealthChecker } from './HealthChecker';
import { RpcEndpointRepository, postgresClient } from '../database/postgres';
import { redisClient } from '../database/redis';
import { config, isValidChainId } from '../config';
import { logger } from '../utils/logger';
import { ChainNotSupportedError, ValidationError, RateLimitError } from '../utils/errors';

export class ChainGateway extends EventEmitter {
  private providerManager: ProviderManager;
  private gasPriceOracle: GasPriceOracle;
  private nonceManager: NonceManager;
  private reorgDetector: ReorgDetector;
  private subscriptionManager: SubscriptionManager;
  private rateLimiter: RateLimiter;
  private healthChecker: HealthChecker;
  private repository: RpcEndpointRepository;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.repository = new RpcEndpointRepository(postgresClient);
    this.providerManager = new ProviderManager(this.repository);
    this.gasPriceOracle = new GasPriceOracle(this.providerManager);
    this.nonceManager = new NonceManager(this.providerManager);
    this.reorgDetector = new ReorgDetector(this.providerManager);
    this.subscriptionManager = new SubscriptionManager(this.providerManager);
    this.rateLimiter = new RateLimiter();
    this.healthChecker = new HealthChecker(config.healthCheckInterval);

    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.info('Initializing ChainGateway...');

    await redisClient.connect();
    await postgresClient.connect();
    await postgresClient.initializeSchema();

    await this.providerManager.initialize();

    const supportedChains = [
      ChainId.ETHEREUM,
      ChainId.POLYGON,
      ChainId.BSC,
      ChainId.ARBITRUM,
      ChainId.OPTIMISM
    ];

    await this.gasPriceOracle.start(supportedChains);
    await this.reorgDetector.start(supportedChains);

    this.rateLimiter.start();

    this.healthChecker.registerService('provider-manager', this.providerManager);
    this.healthChecker.registerService('gas-price-oracle', this.gasPriceOracle);
    this.healthChecker.registerService('nonce-manager', this.nonceManager);
    this.healthChecker.registerService('reorg-detector', this.reorgDetector);
    this.healthChecker.registerService('subscription-manager', this.subscriptionManager);
    this.healthChecker.registerService('rate-limiter', this.rateLimiter);
    this.healthChecker.start();

    this.isInitialized = true;
    logger.info('ChainGateway initialized successfully');
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down ChainGateway...');

    this.healthChecker.stop();
    this.rateLimiter.stop();
    await this.subscriptionManager.stop();
    await this.reorgDetector.stop();
    await this.gasPriceOracle.stop();
    await this.providerManager.stop();

    await redisClient.disconnect();
    await postgresClient.disconnect();

    this.isInitialized = false;
    logger.info('ChainGateway shutdown complete');
  }

  async executeRpcRequest(
    chainId: ChainId,
    request: RpcRequest,
    clientId?: string
  ): Promise<RpcResponse> {
    if (!isValidChainId(chainId)) {
      throw new ChainNotSupportedError(chainId);
    }

    if (clientId) {
      const rateLimitInfo = await this.rateLimiter.incrementCount(clientId);
      if (rateLimitInfo.remaining < 0) {
        const retryAfter = Math.ceil(
          (rateLimitInfo.resetAt.getTime() - Date.now()) / 1000
        );
        throw new RateLimitError('Rate limit exceeded', retryAfter);
      }
    }

    try {
      const result = await this.providerManager.executeRequest(
        chainId,
        request.method,
        request.params
      );

      return {
        jsonrpc: '2.0',
        result,
        id: request.id
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: (error as Error).message
        },
        id: request.id
      };
    }
  }

  async getGasPrice(chainId: ChainId): Promise<GasPrice> {
    if (!isValidChainId(chainId)) {
      throw new ChainNotSupportedError(chainId);
    }
    return this.gasPriceOracle.getGasPrice(chainId);
  }

  async refreshGasPrice(chainId: ChainId): Promise<GasPrice> {
    if (!isValidChainId(chainId)) {
      throw new ChainNotSupportedError(chainId);
    }
    return this.gasPriceOracle.refreshGasPrice(chainId);
  }

  async getGasPriceHistory(
    chainId: ChainId,
    limit?: number
  ): Promise<{ price: bigint; timestamp: Date }[]> {
    if (!isValidChainId(chainId)) {
      throw new ChainNotSupportedError(chainId);
    }
    return this.gasPriceOracle.getGasPriceHistory(chainId, limit);
  }

  async getNonce(chainId: ChainId, address: string): Promise<number> {
    if (!isValidChainId(chainId)) {
      throw new ChainNotSupportedError(chainId);
    }
    this.validateAddress(address);
    return this.nonceManager.getNonce(chainId, address);
  }

  async incrementNonce(chainId: ChainId, address: string): Promise<number> {
    if (!isValidChainId(chainId)) {
      throw new ChainNotSupportedError(chainId);
    }
    this.validateAddress(address);
    return this.nonceManager.incrementNonce(chainId, address);
  }

  async resetNonce(chainId: ChainId, address: string): Promise<void> {
    if (!isValidChainId(chainId)) {
      throw new ChainNotSupportedError(chainId);
    }
    this.validateAddress(address);
    return this.nonceManager.resetNonce(chainId, address);
  }

  async syncNonce(chainId: ChainId, address: string): Promise<number> {
    if (!isValidChainId(chainId)) {
      throw new ChainNotSupportedError(chainId);
    }
    this.validateAddress(address);
    return this.nonceManager.syncNonce(chainId, address);
  }

  async subscribe(config: SubscriptionConfig): Promise<string> {
    if (!isValidChainId(config.chainId)) {
      throw new ChainNotSupportedError(config.chainId);
    }
    return this.subscriptionManager.subscribe(config);
  }

  async unsubscribe(subscriptionId: string): Promise<boolean> {
    return this.subscriptionManager.unsubscribe(subscriptionId);
  }

  getActiveSubscriptions(): SubscriptionConfig[] {
    return this.subscriptionManager.getActiveSubscriptions();
  }

  async getReorgHistory(chainId: ChainId, limit?: number): Promise<ReorgEvent[]> {
    if (!isValidChainId(chainId)) {
      throw new ChainNotSupportedError(chainId);
    }
    return this.reorgDetector.getReorgHistory(chainId, limit);
  }

  onReorg(callback: (event: ReorgEvent) => void): void {
    this.reorgDetector.onReorg(callback);
  }

  async checkRateLimit(clientId: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  }> {
    const info = await this.rateLimiter.checkLimit(clientId);
    return {
      allowed: info.remaining > 0,
      remaining: info.remaining,
      resetAt: info.resetAt
    };
  }

  async getHealth(): Promise<{
    status: string;
    services: Record<string, HealthCheckResult>;
    timestamp: string;
  }> {
    await this.healthChecker.checkAll();
    return this.healthChecker.toJSON();
  }

  getProviderHealth(chainId: ChainId) {
    return this.providerManager.getProviderHealth(chainId);
  }

  getAllProviderHealth() {
    return this.providerManager.getAllProviderHealth();
  }

  private validateAddress(address: string): void {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new ValidationError('Invalid Ethereum address', { address });
    }
  }

  private setupEventHandlers(): void {
    this.gasPriceOracle.on('gasPriceUpdated', (data) => {
      this.emit('gasPriceUpdated', data);
    });

    this.nonceManager.on('nonceReset', (data) => {
      this.emit('nonceReset', data);
    });

    this.nonceManager.on('nonceSynced', (data) => {
      this.emit('nonceSynced', data);
    });

    this.nonceManager.on('nonceGapDetected', (data) => {
      this.emit('nonceGapDetected', data);
    });

    this.reorgDetector.on('reorg', (event) => {
      this.emit('reorg', event);
      logger.warn('Chain reorganization detected', event);
    });

    this.subscriptionManager.on('subscriptionEvent', (data) => {
      this.emit('subscriptionEvent', data);
    });

    this.rateLimiter.on('rateLimitExceeded', (data) => {
      this.emit('rateLimitExceeded', data);
    });

    this.healthChecker.on('healthCheckComplete', (data) => {
      this.emit('healthCheckComplete', data);
    });

    this.providerManager.on('healthCheckComplete', (data) => {
      this.emit('providerHealthUpdate', data);
    });
  }
}

export const chainGateway = new ChainGateway();
