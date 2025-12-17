import { EventEmitter } from 'events';
import { ChainId, BlockInfo, ReorgEvent, IReorgDetector, HealthCheckResult } from '../types';
import { ProviderManager } from '../providers/ProviderManager';
import { redisClient } from '../database/redis';
import { config, getChainConfig } from '../config';
import { logger } from '../utils/logger';

const BLOCK_CACHE_KEY_PREFIX = 'block:';
const REORG_HISTORY_KEY_PREFIX = 'reorg:history:';
const MAX_CACHED_BLOCKS = 256;

export class ReorgDetector extends EventEmitter implements IReorgDetector {
  private providerManager: ProviderManager;
  private monitoringIntervals: Map<ChainId, NodeJS.Timeout> = new Map();
  private lastKnownBlocks: Map<ChainId, BlockInfo> = new Map();
  private blockCache: Map<ChainId, Map<number, BlockInfo>> = new Map();
  private isRunning: boolean = false;

  constructor(providerManager: ProviderManager) {
    super();
    this.providerManager = providerManager;
  }

  async start(chainIds?: ChainId[]): Promise<void> {
    if (this.isRunning) {
      return;
    }

    const chainsToMonitor = chainIds || [
      ChainId.ETHEREUM,
      ChainId.POLYGON,
      ChainId.BSC,
      ChainId.ARBITRUM,
      ChainId.OPTIMISM
    ];

    for (const chainId of chainsToMonitor) {
      await this.startMonitoring(chainId);
    }

    this.isRunning = true;
    logger.info('ReorgDetector started', { chainIds: chainsToMonitor });
  }

  async stop(): Promise<void> {
    for (const interval of this.monitoringIntervals.values()) {
      clearInterval(interval);
    }
    this.monitoringIntervals.clear();
    this.isRunning = false;
    logger.info('ReorgDetector stopped');
  }

  onReorg(callback: (event: ReorgEvent) => void): void {
    this.on('reorg', callback);
  }

  private async startMonitoring(chainId: ChainId): Promise<void> {
    const chainConfig = getChainConfig(chainId);
    const pollInterval = Math.max(chainConfig.blockTime * 500, 1000);

    this.blockCache.set(chainId, new Map());

    await this.initializeLastBlock(chainId);

    const interval = setInterval(async () => {
      try {
        await this.checkForReorg(chainId);
      } catch (error) {
        logger.warn('Reorg check failed', {
          chainId,
          error: (error as Error).message
        });
      }
    }, pollInterval);

    this.monitoringIntervals.set(chainId, interval);
  }

  private async initializeLastBlock(chainId: ChainId): Promise<void> {
    try {
      const blockNumber = await this.providerManager.executeRequest(
        chainId,
        'eth_blockNumber',
        []
      ) as string;

      const block = await this.fetchBlock(chainId, parseInt(blockNumber, 16));
      if (block) {
        this.lastKnownBlocks.set(chainId, block);
        await this.cacheBlock(chainId, block);
      }
    } catch (error) {
      logger.warn('Failed to initialize last block', {
        chainId,
        error: (error as Error).message
      });
    }
  }

  private async checkForReorg(chainId: ChainId): Promise<void> {
    const lastKnown = this.lastKnownBlocks.get(chainId);
    if (!lastKnown) {
      await this.initializeLastBlock(chainId);
      return;
    }

    const currentBlockNumber = await this.providerManager.executeRequest(
      chainId,
      'eth_blockNumber',
      []
    ) as string;

    const currentNumber = parseInt(currentBlockNumber, 16);

    if (currentNumber <= lastKnown.number) {
      return;
    }

    for (let blockNum = lastKnown.number + 1; blockNum <= currentNumber; blockNum++) {
      const block = await this.fetchBlock(chainId, blockNum);
      if (!block) {
        continue;
      }

      const reorg = await this.detectReorgAtBlock(chainId, block);
      if (reorg) {
        await this.handleReorg(chainId, reorg);
      }

      this.lastKnownBlocks.set(chainId, block);
      await this.cacheBlock(chainId, block);
    }
  }

  private async detectReorgAtBlock(chainId: ChainId, newBlock: BlockInfo): Promise<ReorgEvent | null> {
    const cache = this.blockCache.get(chainId);
    if (!cache) {
      return null;
    }

    const cachedParent = cache.get(newBlock.number - 1);
    if (!cachedParent) {
      return null;
    }

    if (cachedParent.hash !== newBlock.parentHash) {
      const depth = await this.calculateReorgDepth(chainId, newBlock);

      return {
        chainId,
        oldBlockNumber: cachedParent.number,
        oldBlockHash: cachedParent.hash,
        newBlockNumber: newBlock.number,
        newBlockHash: newBlock.hash,
        depth,
        timestamp: new Date()
      };
    }

    return null;
  }

  private async calculateReorgDepth(chainId: ChainId, newBlock: BlockInfo): Promise<number> {
    const cache = this.blockCache.get(chainId);
    if (!cache) {
      return 1;
    }

    let depth = 1;
    let currentBlock = newBlock;
    const maxDepth = config.reorgDepth;

    while (depth < maxDepth) {
      const parentNumber = currentBlock.number - 1;
      const cachedBlock = cache.get(parentNumber);

      if (!cachedBlock) {
        break;
      }

      const onChainBlock = await this.fetchBlock(chainId, parentNumber);
      if (!onChainBlock) {
        break;
      }

      if (cachedBlock.hash === onChainBlock.hash) {
        break;
      }

      depth++;
      currentBlock = onChainBlock;
    }

    return depth;
  }

  private async handleReorg(chainId: ChainId, reorg: ReorgEvent): Promise<void> {
    logger.warn('Chain reorganization detected', {
      chainId,
      depth: reorg.depth,
      oldBlock: reorg.oldBlockHash,
      newBlock: reorg.newBlockHash
    });

    await this.invalidateCachedBlocks(chainId, reorg.oldBlockNumber, reorg.depth);

    await this.recordReorgEvent(reorg);

    this.emit('reorg', reorg);
  }

  private async invalidateCachedBlocks(
    chainId: ChainId,
    fromBlock: number,
    depth: number
  ): Promise<void> {
    const cache = this.blockCache.get(chainId);
    if (!cache) {
      return;
    }

    for (let i = 0; i < depth; i++) {
      const blockNumber = fromBlock - i;
      cache.delete(blockNumber);

      try {
        await redisClient.del(`${BLOCK_CACHE_KEY_PREFIX}${chainId}:${blockNumber}`);
      } catch (error) {
        logger.warn('Failed to delete cached block from Redis', {
          chainId,
          blockNumber,
          error: (error as Error).message
        });
      }
    }
  }

  private async recordReorgEvent(reorg: ReorgEvent): Promise<void> {
    try {
      const serialized = JSON.stringify({
        ...reorg,
        timestamp: reorg.timestamp.toISOString()
      });

      await redisClient.lpush(`${REORG_HISTORY_KEY_PREFIX}${reorg.chainId}`, serialized);
      await redisClient.ltrim(`${REORG_HISTORY_KEY_PREFIX}${reorg.chainId}`, 0, 99);
    } catch (error) {
      logger.warn('Failed to record reorg event', {
        chainId: reorg.chainId,
        error: (error as Error).message
      });
    }
  }

  async getReorgHistory(chainId: ChainId, limit: number = 10): Promise<ReorgEvent[]> {
    try {
      const history = await redisClient.lrange(`${REORG_HISTORY_KEY_PREFIX}${chainId}`, 0, limit - 1);
      return history.map((entry) => {
        const parsed = JSON.parse(entry);
        return {
          ...parsed,
          timestamp: new Date(parsed.timestamp)
        };
      });
    } catch (error) {
      logger.warn('Failed to get reorg history', {
        chainId,
        error: (error as Error).message
      });
      return [];
    }
  }

  private async fetchBlock(chainId: ChainId, blockNumber: number): Promise<BlockInfo | null> {
    try {
      const block = await this.providerManager.executeRequest(
        chainId,
        'eth_getBlockByNumber',
        [`0x${blockNumber.toString(16)}`, false]
      ) as {
        number: string;
        hash: string;
        parentHash: string;
        timestamp: string;
        transactions: string[];
      } | null;

      if (!block) {
        return null;
      }

      return {
        chainId,
        number: parseInt(block.number, 16),
        hash: block.hash,
        parentHash: block.parentHash,
        timestamp: parseInt(block.timestamp, 16),
        transactions: block.transactions
      };
    } catch (error) {
      logger.warn('Failed to fetch block', {
        chainId,
        blockNumber,
        error: (error as Error).message
      });
      return null;
    }
  }

  private async cacheBlock(chainId: ChainId, block: BlockInfo): Promise<void> {
    const cache = this.blockCache.get(chainId);
    if (!cache) {
      return;
    }

    cache.set(block.number, block);

    if (cache.size > MAX_CACHED_BLOCKS) {
      const oldestKey = Math.min(...cache.keys());
      cache.delete(oldestKey);
    }

    try {
      await redisClient.set(
        `${BLOCK_CACHE_KEY_PREFIX}${chainId}:${block.number}`,
        JSON.stringify(block),
        3600000
      );
    } catch (error) {
      logger.warn('Failed to cache block in Redis', {
        chainId,
        blockNumber: block.number,
        error: (error as Error).message
      });
    }
  }

  async getLastKnownBlock(chainId: ChainId): Promise<BlockInfo | null> {
    return this.lastKnownBlocks.get(chainId) || null;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const monitoredChains = this.monitoringIntervals.size;
    let healthyChains = 0;

    for (const chainId of this.monitoringIntervals.keys()) {
      const lastBlock = this.lastKnownBlocks.get(chainId);
      if (lastBlock) {
        const age = Date.now() / 1000 - lastBlock.timestamp;
        const chainConfig = getChainConfig(chainId);
        if (age < chainConfig.blockTime * 10) {
          healthyChains++;
        }
      }
    }

    const healthRatio = monitoredChains > 0 ? healthyChains / monitoredChains : 0;

    return {
      service: 'reorg-detector',
      status: healthRatio >= 0.8 ? 'healthy' : healthRatio >= 0.5 ? 'degraded' : 'unhealthy',
      details: {
        isRunning: this.isRunning,
        monitoredChains,
        healthyChains
      }
    };
  }
}
