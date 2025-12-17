import { EventEmitter } from 'events';
import { ChainId, NonceInfo, INonceManager, HealthCheckResult } from '../types';
import { ProviderManager } from '../providers/ProviderManager';
import { redisClient } from '../database/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { NonceError } from '../utils/errors';

const NONCE_KEY_PREFIX = 'nonce:';
const PENDING_NONCE_KEY_PREFIX = 'nonce:pending:';
const NONCE_LOCK_KEY_PREFIX = 'nonce:lock:';
const LOCK_TTL_MS = 5000;

export class NonceManager extends EventEmitter implements INonceManager {
  private providerManager: ProviderManager;
  private localNonceCache: Map<string, NonceInfo> = new Map();

  constructor(providerManager: ProviderManager) {
    super();
    this.providerManager = providerManager;
  }

  async getNonce(chainId: ChainId, address: string): Promise<number> {
    const normalizedAddress = address.toLowerCase();
    const key = this.getNonceKey(chainId, normalizedAddress);

    const lockAcquired = await this.acquireLock(key);
    if (!lockAcquired) {
      throw new NonceError('Failed to acquire nonce lock', { chainId, address });
    }

    try {
      const cachedNonce = await this.getCachedNonce(chainId, normalizedAddress);
      
      if (cachedNonce !== null) {
        const pendingNonce = await this.getPendingNonce(chainId, normalizedAddress);
        const nextNonce = Math.max(cachedNonce, pendingNonce);
        
        await this.setPendingNonce(chainId, normalizedAddress, nextNonce + 1);
        
        logger.debug('Returning cached nonce', {
          chainId,
          address: normalizedAddress,
          nonce: nextNonce
        });
        
        return nextNonce;
      }

      const onChainNonce = await this.fetchOnChainNonce(chainId, normalizedAddress);
      
      await this.setCachedNonce(chainId, normalizedAddress, onChainNonce);
      await this.setPendingNonce(chainId, normalizedAddress, onChainNonce + 1);

      logger.debug('Fetched on-chain nonce', {
        chainId,
        address: normalizedAddress,
        nonce: onChainNonce
      });

      return onChainNonce;
    } finally {
      await this.releaseLock(key);
    }
  }

  async incrementNonce(chainId: ChainId, address: string): Promise<number> {
    const normalizedAddress = address.toLowerCase();
    const key = this.getNonceKey(chainId, normalizedAddress);

    const lockAcquired = await this.acquireLock(key);
    if (!lockAcquired) {
      throw new NonceError('Failed to acquire nonce lock', { chainId, address });
    }

    try {
      const pendingNonce = await this.getPendingNonce(chainId, normalizedAddress);
      const newNonce = pendingNonce + 1;
      
      await this.setPendingNonce(chainId, normalizedAddress, newNonce);

      logger.debug('Incremented nonce', {
        chainId,
        address: normalizedAddress,
        newNonce
      });

      return newNonce;
    } finally {
      await this.releaseLock(key);
    }
  }

  async resetNonce(chainId: ChainId, address: string): Promise<void> {
    const normalizedAddress = address.toLowerCase();
    const key = this.getNonceKey(chainId, normalizedAddress);

    const lockAcquired = await this.acquireLock(key);
    if (!lockAcquired) {
      throw new NonceError('Failed to acquire nonce lock', { chainId, address });
    }

    try {
      const onChainNonce = await this.fetchOnChainNonce(chainId, normalizedAddress);
      
      await this.setCachedNonce(chainId, normalizedAddress, onChainNonce);
      await this.setPendingNonce(chainId, normalizedAddress, onChainNonce);

      this.localNonceCache.delete(key);

      logger.info('Reset nonce', {
        chainId,
        address: normalizedAddress,
        nonce: onChainNonce
      });

      this.emit('nonceReset', { chainId, address: normalizedAddress, nonce: onChainNonce });
    } finally {
      await this.releaseLock(key);
    }
  }

  async confirmNonce(chainId: ChainId, address: string, nonce: number): Promise<void> {
    const normalizedAddress = address.toLowerCase();
    
    await this.setCachedNonce(chainId, normalizedAddress, nonce + 1);

    logger.debug('Confirmed nonce', {
      chainId,
      address: normalizedAddress,
      confirmedNonce: nonce
    });

    this.emit('nonceConfirmed', { chainId, address: normalizedAddress, nonce });
  }

  async syncNonce(chainId: ChainId, address: string): Promise<number> {
    const normalizedAddress = address.toLowerCase();
    const key = this.getNonceKey(chainId, normalizedAddress);

    const lockAcquired = await this.acquireLock(key);
    if (!lockAcquired) {
      throw new NonceError('Failed to acquire nonce lock', { chainId, address });
    }

    try {
      const onChainNonce = await this.fetchOnChainNonce(chainId, normalizedAddress);
      const pendingNonce = await this.getPendingNonce(chainId, normalizedAddress);

      if (onChainNonce > pendingNonce) {
        logger.warn('On-chain nonce ahead of pending nonce, syncing', {
          chainId,
          address: normalizedAddress,
          onChainNonce,
          pendingNonce
        });

        await this.setCachedNonce(chainId, normalizedAddress, onChainNonce);
        await this.setPendingNonce(chainId, normalizedAddress, onChainNonce);

        this.emit('nonceSynced', {
          chainId,
          address: normalizedAddress,
          oldNonce: pendingNonce,
          newNonce: onChainNonce
        });
      }

      return onChainNonce;
    } finally {
      await this.releaseLock(key);
    }
  }

  async detectNonceGap(chainId: ChainId, address: string): Promise<number[]> {
    const normalizedAddress = address.toLowerCase();
    
    const onChainNonce = await this.fetchOnChainNonce(chainId, normalizedAddress);
    const pendingNonce = await this.getPendingNonce(chainId, normalizedAddress);

    if (pendingNonce <= onChainNonce) {
      return [];
    }

    const gaps: number[] = [];
    for (let i = onChainNonce; i < pendingNonce; i++) {
      gaps.push(i);
    }

    if (gaps.length > 0) {
      logger.warn('Nonce gap detected', {
        chainId,
        address: normalizedAddress,
        gaps
      });

      this.emit('nonceGapDetected', { chainId, address: normalizedAddress, gaps });
    }

    return gaps;
  }

  private async fetchOnChainNonce(chainId: ChainId, address: string): Promise<number> {
    try {
      const result = await this.providerManager.executeRequest(
        chainId,
        'eth_getTransactionCount',
        [address, 'pending']
      );
      return parseInt(result as string, 16);
    } catch (error) {
      throw new NonceError('Failed to fetch on-chain nonce', {
        chainId,
        address,
        error: (error as Error).message
      });
    }
  }

  private async getCachedNonce(chainId: ChainId, address: string): Promise<number | null> {
    const key = this.getNonceKey(chainId, address);

    const localCache = this.localNonceCache.get(key);
    if (localCache && Date.now() - localCache.lastUpdated.getTime() < config.nonceTtl) {
      return localCache.nonce;
    }

    try {
      const cached = await redisClient.get(`${NONCE_KEY_PREFIX}${key}`);
      if (cached) {
        const nonce = parseInt(cached, 10);
        this.localNonceCache.set(key, {
          chainId,
          address,
          nonce,
          pendingNonce: nonce,
          lastUpdated: new Date()
        });
        return nonce;
      }
    } catch (error) {
      logger.warn('Failed to get cached nonce from Redis', {
        chainId,
        address,
        error: (error as Error).message
      });
    }

    return null;
  }

  private async setCachedNonce(chainId: ChainId, address: string, nonce: number): Promise<void> {
    const key = this.getNonceKey(chainId, address);

    this.localNonceCache.set(key, {
      chainId,
      address,
      nonce,
      pendingNonce: nonce,
      lastUpdated: new Date()
    });

    try {
      await redisClient.set(`${NONCE_KEY_PREFIX}${key}`, nonce.toString(), config.nonceTtl);
    } catch (error) {
      logger.warn('Failed to cache nonce in Redis', {
        chainId,
        address,
        error: (error as Error).message
      });
    }
  }

  private async getPendingNonce(chainId: ChainId, address: string): Promise<number> {
    const key = this.getNonceKey(chainId, address);

    try {
      const pending = await redisClient.get(`${PENDING_NONCE_KEY_PREFIX}${key}`);
      if (pending) {
        return parseInt(pending, 10);
      }
    } catch (error) {
      logger.warn('Failed to get pending nonce from Redis', {
        chainId,
        address,
        error: (error as Error).message
      });
    }

    const cached = await this.getCachedNonce(chainId, address);
    return cached ?? 0;
  }

  private async setPendingNonce(chainId: ChainId, address: string, nonce: number): Promise<void> {
    const key = this.getNonceKey(chainId, address);

    try {
      await redisClient.set(`${PENDING_NONCE_KEY_PREFIX}${key}`, nonce.toString(), config.nonceTtl);
    } catch (error) {
      logger.warn('Failed to set pending nonce in Redis', {
        chainId,
        address,
        error: (error as Error).message
      });
    }
  }

  private async acquireLock(key: string): Promise<boolean> {
    const lockKey = `${NONCE_LOCK_KEY_PREFIX}${key}`;
    const lockValue = Date.now().toString();

    try {
      const result = await redisClient.getClient().set(lockKey, lockValue, 'PX', LOCK_TTL_MS, 'NX');
      return result === 'OK';
    } catch (error) {
      logger.warn('Failed to acquire lock', {
        key,
        error: (error as Error).message
      });
      return true;
    }
  }

  private async releaseLock(key: string): Promise<void> {
    const lockKey = `${NONCE_LOCK_KEY_PREFIX}${key}`;

    try {
      await redisClient.del(lockKey);
    } catch (error) {
      logger.warn('Failed to release lock', {
        key,
        error: (error as Error).message
      });
    }
  }

  private getNonceKey(chainId: ChainId, address: string): string {
    return `${chainId}:${address}`;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const cacheSize = this.localNonceCache.size;

    return {
      service: 'nonce-manager',
      status: 'healthy',
      details: {
        localCacheSize: cacheSize
      }
    };
  }
}
