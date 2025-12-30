import { getRedisClient } from '../config/redis';

export interface PerformanceMetrics {
  pullsPerSecond: number;
  currencyOpsPerSecond: number;
  averageLatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  cacheHitRate: number;
}

export interface BatchOperation<T> {
  id: string;
  operation: () => Promise<T>;
}

export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private metrics: {
    pullLatencies: number[];
    currencyLatencies: number[];
    cacheHits: number;
    cacheMisses: number;
    errors: number;
    totalOperations: number;
  };

  private constructor() {
    this.metrics = {
      pullLatencies: [],
      currencyLatencies: [],
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      totalOperations: 0,
    };
  }

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  recordPullLatency(latencyMs: number): void {
    this.metrics.pullLatencies.push(latencyMs);
    this.metrics.totalOperations++;

    if (this.metrics.pullLatencies.length > 10000) {
      this.metrics.pullLatencies = this.metrics.pullLatencies.slice(-5000);
    }
  }

  recordCurrencyLatency(latencyMs: number): void {
    this.metrics.currencyLatencies.push(latencyMs);
    this.metrics.totalOperations++;

    if (this.metrics.currencyLatencies.length > 10000) {
      this.metrics.currencyLatencies = this.metrics.currencyLatencies.slice(-5000);
    }
  }

  recordCacheHit(): void {
    this.metrics.cacheHits++;
  }

  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  recordError(): void {
    this.metrics.errors++;
  }

  getMetrics(): PerformanceMetrics {
    const allLatencies = [...this.metrics.pullLatencies, ...this.metrics.currencyLatencies];
    allLatencies.sort((a, b) => a - b);

    const avgLatency = allLatencies.length > 0
      ? allLatencies.reduce((sum, l) => sum + l, 0) / allLatencies.length
      : 0;

    const p99Index = Math.floor(allLatencies.length * 0.99);
    const p99Latency = allLatencies.length > 0 ? allLatencies[p99Index] || allLatencies[allLatencies.length - 1] : 0;

    const pullsPerSecond = this.metrics.pullLatencies.length > 0
      ? 1000 / (this.metrics.pullLatencies.reduce((sum, l) => sum + l, 0) / this.metrics.pullLatencies.length)
      : 0;

    const currencyOpsPerSecond = this.metrics.currencyLatencies.length > 0
      ? 1000 / (this.metrics.currencyLatencies.reduce((sum, l) => sum + l, 0) / this.metrics.currencyLatencies.length)
      : 0;

    const totalCacheOps = this.metrics.cacheHits + this.metrics.cacheMisses;
    const cacheHitRate = totalCacheOps > 0 ? this.metrics.cacheHits / totalCacheOps : 0;

    const errorRate = this.metrics.totalOperations > 0
      ? this.metrics.errors / this.metrics.totalOperations
      : 0;

    return {
      pullsPerSecond,
      currencyOpsPerSecond,
      averageLatencyMs: avgLatency,
      p99LatencyMs: p99Latency,
      errorRate,
      cacheHitRate,
    };
  }

  resetMetrics(): void {
    this.metrics = {
      pullLatencies: [],
      currencyLatencies: [],
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      totalOperations: 0,
    };
  }
}

export async function executeBatch<T>(
  operations: BatchOperation<T>[],
  concurrencyLimit: number = 100
): Promise<Map<string, T | Error>> {
  const results = new Map<string, T | Error>();
  const chunks: BatchOperation<T>[][] = [];

  for (let i = 0; i < operations.length; i += concurrencyLimit) {
    chunks.push(operations.slice(i, i + concurrencyLimit));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.allSettled(
      chunk.map(async (op) => {
        try {
          const result = await op.operation();
          return { id: op.id, result };
        } catch (error) {
          return { id: op.id, error };
        }
      })
    );

    for (const result of chunkResults) {
      if (result.status === 'fulfilled') {
        if ('error' in result.value) {
          results.set(result.value.id, result.value.error as Error);
        } else {
          results.set(result.value.id, result.value.result);
        }
      } else {
        results.set('unknown', result.reason);
      }
    }
  }

  return results;
}

export async function withCache<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const optimizer = PerformanceOptimizer.getInstance();
  const redis = getRedisClient();

    try {
      const cached = await redis.get(key);
      if (cached) {
        optimizer.recordCacheHit();
        return JSON.parse(cached) as T;
      }
    } catch (e) {
      void e;
    }

  optimizer.recordCacheMiss();
  const result = await fetchFn();

    try {
      await redis.setex(key, ttl, JSON.stringify(result));
    } catch (e) {
      void e;
    }

  return result;
}

export async function invalidateCache(pattern: string): Promise<void> {
  const redis = getRedisClient();

    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (e) {
      void e;
    }
}

export function measureLatency<T>(
  fn: () => Promise<T>,
  recordFn: (latencyMs: number) => void
): () => Promise<T> {
  return async () => {
    const start = Date.now();
    try {
      const result = await fn();
      const latency = Date.now() - start;
      recordFn(latency);
      return result;
    } catch (error) {
      const latency = Date.now() - start;
      recordFn(latency);
      throw error;
    }
  };
}

export class ConnectionPool<T> {
  private pool: T[] = [];
  private inUse: Set<T> = new Set();
  private maxSize: number;
  private createFn: () => Promise<T>;
  private destroyFn: (conn: T) => Promise<void>;

  constructor(
    maxSize: number,
    createFn: () => Promise<T>,
    destroyFn: (conn: T) => Promise<void>
  ) {
    this.maxSize = maxSize;
    this.createFn = createFn;
    this.destroyFn = destroyFn;
  }

  async acquire(): Promise<T> {
    const available = this.pool.find((conn) => !this.inUse.has(conn));

    if (available) {
      this.inUse.add(available);
      return available;
    }

    if (this.pool.length < this.maxSize) {
      const newConn = await this.createFn();
      this.pool.push(newConn);
      this.inUse.add(newConn);
      return newConn;
    }

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const available = this.pool.find((conn) => !this.inUse.has(conn));
        if (available) {
          clearInterval(checkInterval);
          this.inUse.add(available);
          resolve(available);
        }
      }, 10);
    });
  }

  release(conn: T): void {
    this.inUse.delete(conn);
  }

  async drain(): Promise<void> {
    for (const conn of this.pool) {
      await this.destroyFn(conn);
    }
    this.pool = [];
    this.inUse.clear();
  }

  getStats(): { total: number; inUse: number; available: number } {
    return {
      total: this.pool.length,
      inUse: this.inUse.size,
      available: this.pool.length - this.inUse.size,
    };
  }
}

export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefill: number;

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  tryAcquire(tokens: number = 1): boolean {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  async acquire(tokens: number = 1): Promise<void> {
    while (!this.tryAcquire(tokens)) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

export class CircuitBreaker {
  private failures: number = 0;
  private lastFailure: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureThreshold: number;
  private resetTimeout: number;

  constructor(failureThreshold: number = 5, resetTimeout: number = 30000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }
}
