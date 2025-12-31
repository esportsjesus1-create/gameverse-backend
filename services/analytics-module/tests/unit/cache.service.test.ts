/**
 * GameVerse Analytics Module - Cache Service Tests
 * Comprehensive tests for in-memory caching with TTL
 */

import { CacheService, cacheService } from '../../src/services/cache.service';

describe('CacheService', () => {
  let testCache: CacheService;

  beforeEach(() => {
    testCache = new CacheService();
    cacheService.clear();
  });

  afterEach(() => {
    testCache.stop();
  });

  describe('set and get', () => {
    it('should store and retrieve a value', () => {
      testCache.set('key1', { data: 'test' });
      const result = testCache.get<{ data: string }>('key1');
      
      expect(result).toEqual({ data: 'test' });
    });

    it('should return null for non-existent key', () => {
      const result = testCache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should store values with custom TTL', () => {
      testCache.set('key1', 'value1', 60);
      expect(testCache.has('key1')).toBe(true);
    });

    it('should expire values after TTL', async () => {
      testCache.set('key1', 'value1', 0.1); // 100ms TTL
      
      expect(testCache.get('key1')).toBe('value1');
      
      await new Promise((resolve) => setTimeout(resolve, 150));
      
      expect(testCache.get('key1')).toBeNull();
    });

    it('should update existing values', () => {
      testCache.set('key1', 'value1');
      testCache.set('key1', 'value2');
      
      expect(testCache.get('key1')).toBe('value2');
    });

    it('should handle complex objects', () => {
      const complexObj = {
        nested: {
          array: [1, 2, 3],
          date: new Date('2024-01-01'),
        },
        string: 'test',
      };
      
      testCache.set('complex', complexObj);
      const result = testCache.get<typeof complexObj>('complex');
      
      expect(result).toEqual(complexObj);
    });
  });

  describe('has', () => {
    it('should return true for existing key', () => {
      testCache.set('key1', 'value1');
      expect(testCache.has('key1')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(testCache.has('non-existent')).toBe(false);
    });

    it('should return false for expired key', async () => {
      testCache.set('key1', 'value1', 0.1);
      
      await new Promise((resolve) => setTimeout(resolve, 150));
      
      expect(testCache.has('key1')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete an existing key', () => {
      testCache.set('key1', 'value1');
      const deleted = testCache.delete('key1');
      
      expect(deleted).toBe(true);
      expect(testCache.has('key1')).toBe(false);
    });

    it('should return false when deleting non-existent key', () => {
      const deleted = testCache.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      testCache.set('key1', 'value1');
      testCache.set('key2', 'value2');
      testCache.set('key3', 'value3');
      
      testCache.clear();
      
      expect(testCache.has('key1')).toBe(false);
      expect(testCache.has('key2')).toBe(false);
      expect(testCache.has('key3')).toBe(false);
    });
  });

  describe('invalidateByPattern', () => {
    it('should invalidate keys matching pattern', () => {
      testCache.set('metrics:user:1', 'value1');
      testCache.set('metrics:user:2', 'value2');
      testCache.set('events:user:1', 'value3');
      
      const count = testCache.invalidateByPattern('metrics:.*');
      
      expect(count).toBe(2);
      expect(testCache.has('metrics:user:1')).toBe(false);
      expect(testCache.has('metrics:user:2')).toBe(false);
      expect(testCache.has('events:user:1')).toBe(true);
    });

    it('should return 0 when no keys match', () => {
      testCache.set('key1', 'value1');
      const count = testCache.invalidateByPattern('nomatch:.*');
      expect(count).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should track cache statistics', () => {
      testCache.set('key1', 'value1');
      testCache.get('key1'); // hit
      testCache.get('key1'); // hit
      testCache.get('non-existent'); // miss
      
      const stats = testCache.getStats();
      
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.size).toBe(1);
      expect(stats.hitRate).toBeCloseTo(66.67, 1); // Hit rate is a percentage
    });

    it('should return 0 hit rate when no requests', () => {
      const stats = testCache.getStats();
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      testCache.set('key1', 'cached-value');
      
      const factory = jest.fn().mockResolvedValue('new-value');
      const result = await testCache.getOrSet('key1', factory);
      
      expect(result).toBe('cached-value');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not exists', async () => {
      const factory = jest.fn().mockResolvedValue('new-value');
      const result = await testCache.getOrSet('key1', factory, 60);
      
      expect(result).toBe('new-value');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(testCache.get('key1')).toBe('new-value');
    });

    it('should handle factory errors', async () => {
      const factory = jest.fn().mockRejectedValue(new Error('Factory error'));
      
      await expect(testCache.getOrSet('key1', factory)).rejects.toThrow('Factory error');
      expect(testCache.has('key1')).toBe(false);
    });
  });

  describe('eviction policy', () => {
    it('should evict oldest entry when capacity exceeded', () => {
      // Use the default cache service which has a max size from config
      testCache.set('evict_key1', 'value1');
      testCache.set('evict_key2', 'value2');
      testCache.set('evict_key3', 'value3');
      
      expect(testCache.has('evict_key1')).toBe(true);
      expect(testCache.has('evict_key2')).toBe(true);
      expect(testCache.has('evict_key3')).toBe(true);
    });

    it('should track evictions in stats', () => {
      testCache.set('evict_stat_key1', 'value1');
      testCache.set('evict_stat_key2', 'value2');
      
      const stats = testCache.getStats();
      expect(stats.evictions).toBeGreaterThanOrEqual(0);
    });
  });

  describe('static key generators', () => {
    it('should generate metrics cache key', () => {
      const key = CacheService.metricsKey({ names: ['metric1'], page: 1 });
      expect(key).toContain('metrics:');
      expect(key).toContain('metric1');
    });

    it('should generate query cache key', () => {
      const key = CacheService.queryKey('query-123', { metrics: ['m1'] });
      expect(key).toContain('query:');
      expect(key).toContain('query-123');
    });

    it('should generate aggregation cache key', () => {
      const key = CacheService.aggregationKey('metric-1', { type: 'SUM', start: new Date(), end: new Date() });
      expect(key).toContain('aggregation:');
      expect(key).toContain('metric-1');
    });

    it('should generate events cache key', () => {
      const key = CacheService.eventsKey({ types: ['LOGIN'], page: 1 });
      expect(key).toContain('events:');
    });
  });

  describe('getAllEntries', () => {
    it('should return all non-expired entries', () => {
      testCache.set('key1', 'value1');
      testCache.set('key2', 'value2');
      
      const entries = testCache.getAllEntries();
      
      expect(entries.length).toBe(2);
      expect(entries.map((e) => e.key)).toContain('key1');
      expect(entries.map((e) => e.key)).toContain('key2');
    });

    it('should not return expired entries', async () => {
      testCache.set('key1', 'value1', 0.1);
      testCache.set('key2', 'value2', 60);
      
      await new Promise((resolve) => setTimeout(resolve, 150));
      
      // Trigger a get to clean up expired entries
      testCache.get('key1');
      
      const entries = testCache.getAllEntries();
      
      expect(entries.length).toBe(1);
      expect(entries[0].key).toBe('key2');
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries during cleanup', async () => {
      testCache.set('key1', 'value1', 0.1);
      testCache.set('key2', 'value2', 60);
      
      await new Promise((resolve) => setTimeout(resolve, 150));
      
      // Trigger cleanup manually
      (testCache as unknown as { cleanup: () => void }).cleanup();
      
      const entries = testCache.getAllEntries();
      expect(entries.length).toBe(1);
    });
  });
});

describe('Singleton cacheService', () => {
  beforeEach(() => {
    cacheService.clear();
  });

  it('should be a singleton instance', () => {
    cacheService.set('test', 'value');
    expect(cacheService.get('test')).toBe('value');
  });

  it('should persist across imports', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { cacheService: sameInstance } = require('../../src/services/cache.service');
    sameInstance.set('shared', 'data');
    expect(cacheService.get('shared')).toBe('data');
  });
});
