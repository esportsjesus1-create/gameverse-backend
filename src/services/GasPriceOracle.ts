import { EventEmitter } from 'events';
import { ChainId, GasPrice, IGasPriceOracle, HealthCheckResult } from '../types';
import { ProviderManager } from '../providers/ProviderManager';
import { redisClient } from '../database/redis';
import { config, getChainConfig } from '../config';
import { logger } from '../utils/logger';
import { ProviderError } from '../utils/errors';

const GAS_PRICE_KEY_PREFIX = 'gas:price:';
const GAS_HISTORY_KEY_PREFIX = 'gas:history:';
const MAX_HISTORY_LENGTH = 100;

export class GasPriceOracle extends EventEmitter implements IGasPriceOracle {
  private providerManager: ProviderManager;
  private refreshIntervals: Map<ChainId, NodeJS.Timeout> = new Map();

  constructor(providerManager: ProviderManager) {
    super();
    this.providerManager = providerManager;
  }

  async start(chainIds: ChainId[]): Promise<void> {
    for (const chainId of chainIds) {
      await this.startRefreshLoop(chainId);
    }
    logger.info('GasPriceOracle started', { chainIds });
  }

  async stop(): Promise<void> {
    for (const interval of this.refreshIntervals.values()) {
      clearInterval(interval);
    }
    this.refreshIntervals.clear();
    logger.info('GasPriceOracle stopped');
  }

  async getGasPrice(chainId: ChainId): Promise<GasPrice> {
    const cached = await this.getCachedGasPrice(chainId);
    if (cached) {
      return cached;
    }

    return this.refreshGasPrice(chainId);
  }

  async refreshGasPrice(chainId: ChainId): Promise<GasPrice> {
    try {
      const provider = await this.providerManager.getProvider(chainId);
      const chainConfig = getChainConfig(chainId);

      let gasPrice: GasPrice;

      if (chainConfig.isEIP1559) {
        gasPrice = await this.fetchEIP1559GasPrice(chainId, provider);
      } else {
        gasPrice = await this.fetchLegacyGasPrice(chainId, provider);
      }

      await this.cacheGasPrice(chainId, gasPrice);
      await this.addToHistory(chainId, gasPrice);

      this.emit('gasPriceUpdated', { chainId, gasPrice });
      return gasPrice;
    } catch (error) {
      logger.error('Failed to refresh gas price', {
        chainId,
        error: (error as Error).message
      });
      throw new ProviderError(`Failed to fetch gas price for chain ${chainId}`, {
        chainId,
        error: (error as Error).message
      });
    }
  }

  private async fetchEIP1559GasPrice(chainId: ChainId, provider: unknown): Promise<GasPrice> {
    const ethersProvider = provider as { getFeeData: () => Promise<{ gasPrice: bigint | null; maxFeePerGas: bigint | null; maxPriorityFeePerGas: bigint | null }> };
    const feeData = await ethersProvider.getFeeData();

    const baseFee = feeData.maxFeePerGas || BigInt(0);
    const priorityFee = feeData.maxPriorityFeePerGas || BigInt(0);

    const slow = baseFee + (priorityFee * BigInt(80)) / BigInt(100);
    const standard = baseFee + priorityFee;
    const fast = baseFee + (priorityFee * BigInt(150)) / BigInt(100);
    const instant = baseFee + (priorityFee * BigInt(200)) / BigInt(100);

    return {
      chainId,
      slow,
      standard,
      fast,
      instant,
      baseFee,
      maxPriorityFee: priorityFee,
      timestamp: new Date()
    };
  }

  private async fetchLegacyGasPrice(chainId: ChainId, provider: unknown): Promise<GasPrice> {
    const ethersProvider = provider as { getFeeData: () => Promise<{ gasPrice: bigint | null }> };
    const feeData = await ethersProvider.getFeeData();
    const gasPrice = feeData.gasPrice || BigInt(0);

    const slow = (gasPrice * BigInt(90)) / BigInt(100);
    const standard = gasPrice;
    const fast = (gasPrice * BigInt(120)) / BigInt(100);
    const instant = (gasPrice * BigInt(150)) / BigInt(100);

    return {
      chainId,
      slow,
      standard,
      fast,
      instant,
      timestamp: new Date()
    };
  }

  private async getCachedGasPrice(chainId: ChainId): Promise<GasPrice | null> {
    try {
      const cached = await redisClient.get(`${GAS_PRICE_KEY_PREFIX}${chainId}`);
      if (!cached) {
        return null;
      }

      const parsed = JSON.parse(cached);
      return {
        ...parsed,
        slow: BigInt(parsed.slow),
        standard: BigInt(parsed.standard),
        fast: BigInt(parsed.fast),
        instant: BigInt(parsed.instant),
        baseFee: parsed.baseFee ? BigInt(parsed.baseFee) : undefined,
        maxPriorityFee: parsed.maxPriorityFee ? BigInt(parsed.maxPriorityFee) : undefined,
        timestamp: new Date(parsed.timestamp)
      };
    } catch (error) {
      logger.warn('Failed to get cached gas price', {
        chainId,
        error: (error as Error).message
      });
      return null;
    }
  }

  private async cacheGasPrice(chainId: ChainId, gasPrice: GasPrice): Promise<void> {
    try {
      const serialized = JSON.stringify({
        ...gasPrice,
        slow: gasPrice.slow.toString(),
        standard: gasPrice.standard.toString(),
        fast: gasPrice.fast.toString(),
        instant: gasPrice.instant.toString(),
        baseFee: gasPrice.baseFee?.toString(),
        maxPriorityFee: gasPrice.maxPriorityFee?.toString(),
        timestamp: gasPrice.timestamp.toISOString()
      });

      await redisClient.set(`${GAS_PRICE_KEY_PREFIX}${chainId}`, serialized, config.gasPriceTtl);
    } catch (error) {
      logger.warn('Failed to cache gas price', {
        chainId,
        error: (error as Error).message
      });
    }
  }

  private async addToHistory(chainId: ChainId, gasPrice: GasPrice): Promise<void> {
    try {
      const historyEntry = JSON.stringify({
        standard: gasPrice.standard.toString(),
        timestamp: gasPrice.timestamp.toISOString()
      });

      await redisClient.lpush(`${GAS_HISTORY_KEY_PREFIX}${chainId}`, historyEntry);
      await redisClient.ltrim(`${GAS_HISTORY_KEY_PREFIX}${chainId}`, 0, MAX_HISTORY_LENGTH - 1);
    } catch (error) {
      logger.warn('Failed to add gas price to history', {
        chainId,
        error: (error as Error).message
      });
    }
  }

  async getGasPriceHistory(chainId: ChainId, limit: number = 50): Promise<{ price: bigint; timestamp: Date }[]> {
    try {
      const history = await redisClient.lrange(`${GAS_HISTORY_KEY_PREFIX}${chainId}`, 0, limit - 1);
      return history.map((entry) => {
        const parsed = JSON.parse(entry);
        return {
          price: BigInt(parsed.standard),
          timestamp: new Date(parsed.timestamp)
        };
      });
    } catch (error) {
      logger.warn('Failed to get gas price history', {
        chainId,
        error: (error as Error).message
      });
      return [];
    }
  }

  async getAverageGasPrice(chainId: ChainId, periodMs: number = 300000): Promise<bigint | null> {
    const history = await this.getGasPriceHistory(chainId, 100);
    const cutoff = new Date(Date.now() - periodMs);

    const recentPrices = history.filter((h) => h.timestamp >= cutoff);
    if (recentPrices.length === 0) {
      return null;
    }

    const sum = recentPrices.reduce((acc, h) => acc + h.price, BigInt(0));
    return sum / BigInt(recentPrices.length);
  }

  private async startRefreshLoop(chainId: ChainId): Promise<void> {
    await this.refreshGasPrice(chainId).catch((error) => {
      logger.warn('Initial gas price fetch failed', {
        chainId,
        error: (error as Error).message
      });
    });

    const interval = setInterval(async () => {
      try {
        await this.refreshGasPrice(chainId);
      } catch (error) {
        logger.warn('Gas price refresh failed', {
          chainId,
          error: (error as Error).message
        });
      }
    }, config.gasPriceTtl);

    this.refreshIntervals.set(chainId, interval);
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const chainIds = Array.from(this.refreshIntervals.keys());
    let healthyChains = 0;

    for (const chainId of chainIds) {
      const cached = await this.getCachedGasPrice(chainId);
      if (cached && Date.now() - cached.timestamp.getTime() < config.gasPriceTtl * 2) {
        healthyChains++;
      }
    }

    const healthRatio = chainIds.length > 0 ? healthyChains / chainIds.length : 0;

    return {
      service: 'gas-price-oracle',
      status: healthRatio >= 0.8 ? 'healthy' : healthRatio >= 0.5 ? 'degraded' : 'unhealthy',
      details: {
        totalChains: chainIds.length,
        healthyChains,
        refreshInterval: config.gasPriceTtl
      }
    };
  }
}
