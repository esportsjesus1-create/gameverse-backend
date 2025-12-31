/**
 * GameVerse Analytics Module - Cache Service
 * In-memory caching with TTL for analytics queries and aggregations
 */

import { config } from '../config';
import { logger, LogEventType } from '../utils/logger';
import { CacheEntry, CacheStats } from '../types';

interface CacheItem<T> {
  value: T;
  expiresAt: number;
  hits: number;
  createdAt: number;
}

export class CacheService {
  private cache: Map<string, CacheItem<unknown>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    maxSize: config.CACHE_MAX_SIZE,
    hitRate: 0,
    evictions: 0,
  };
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (config.CACHE_ENABLED) {
      this.startCleanupInterval();
    }
  }

  /**
   * Get a value from the cache
   */
  get<T>(key: string): T | null {
    if (!config.CACHE_ENABLED) {
      return null;
    }

    const item = this.cache.get(key) as CacheItem<T> | undefined;

    if (!item) {
      this.stats.misses++;
      this.updateHitRate();
      logger.logCache('miss', key);
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      this.stats.misses++;
      this.updateHitRate();
      logger.logCache('miss', key, { reason: 'expired' });
      return null;
    }

    item.hits++;
    this.stats.hits++;
    this.updateHitRate();
    logger.logCache('hit', key, { hits: item.hits });
    return item.value;
  }

  /**
   * Set a value in the cache
   */
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    if (!config.CACHE_ENABLED) {
      return;
    }

    const ttl = ttlSeconds || config.CACHE_DEFAULT_TTL;
    const now = Date.now();

    if (this.cache.size >= config.CACHE_MAX_SIZE) {
      this.evictOldest();
    }

    const item: CacheItem<T> = {
      value,
      expiresAt: now + ttl * 1000,
      hits: 0,
      createdAt: now,
    };

    this.cache.set(key, item);
    this.stats.size = this.cache.size;
    logger.logCache('set', key, { ttl, size: this.cache.size });
  }

  /**
   * Delete a value from the cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.size = this.cache.size;
      logger.logCache('evict', key);
    }
    return deleted;
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    if (!config.CACHE_ENABLED) {
      return false;
    }

    const item = this.cache.get(key);
    if (!item) {
      return false;
    }

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      return false;
    }

    return true;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    logger.logCache('invalidate', '*', { reason: 'clear_all' });
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidateByPattern(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    this.stats.size = this.cache.size;
    logger.logCache('invalidate', pattern, { count });
    return count;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get or set a value with a factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    try {
      const value = await factory();
      this.set(key, value, ttlSeconds);
      return value;
    } catch (error) {
      logger.logCache('error', key, { error: String(error) });
      throw error;
    }
  }

  /**
   * Generate a cache key for metrics
   */
  static metricsKey(params: Record<string, unknown>): string {
    return `metrics:${JSON.stringify(params)}`;
  }

  /**
   * Generate a cache key for queries
   */
  static queryKey(queryId: string, params: Record<string, unknown>): string {
    return `query:${queryId}:${JSON.stringify(params)}`;
  }

  /**
   * Generate a cache key for aggregations
   */
  static aggregationKey(metricId: string, params: Record<string, unknown>): string {
    return `aggregation:${metricId}:${JSON.stringify(params)}`;
  }

  /**
   * Generate a cache key for events
   */
  static eventsKey(params: Record<string, unknown>): string {
    return `events:${JSON.stringify(params)}`;
  }

  /**
   * Evict the oldest cache entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, item] of this.cache.entries()) {
      if (item.createdAt < oldestTime) {
        oldestTime = item.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      logger.logCache('evict', oldestKey, { reason: 'capacity' });
    }
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Start the cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Run every minute
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.size = this.cache.size;
      logger.debug(LogEventType.CACHE_EVICT, `Cleaned up ${cleaned} expired cache entries`);
    }
  }

  /**
   * Stop the cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get all cache entries (for debugging)
   */
  getAllEntries(): Array<CacheEntry<unknown>> {
    const entries: Array<CacheEntry<unknown>> = [];

    for (const [key, item] of this.cache.entries()) {
      entries.push({
        key,
        value: item.value,
        ttl: Math.max(0, Math.floor((item.expiresAt - Date.now()) / 1000)),
        createdAt: new Date(item.createdAt),
        expiresAt: new Date(item.expiresAt),
        hits: item.hits,
      });
    }

    return entries;
  }
}

// Singleton instance
export const cacheService = new CacheService();

export default cacheService;
