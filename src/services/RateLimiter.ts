import { EventEmitter } from 'events';
import { RateLimitConfig, RateLimitInfo, IRateLimiter, HealthCheckResult } from '../types';
import { redisClient } from '../database/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { RateLimitError } from '../utils/errors';

const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local current = redis.call('GET', key)
if current then
  current = tonumber(current)
else
  current = 0
end

if current >= limit then
  local ttl = redis.call('PTTL', key)
  return {0, current, ttl}
end

current = redis.call('INCR', key)
if current == 1 then
  redis.call('PEXPIRE', key, window)
end

local ttl = redis.call('PTTL', key)
return {1, current, ttl}
`;

export class RateLimiter extends EventEmitter implements IRateLimiter {
  private config: RateLimitConfig;
  private localCache: Map<string, { count: number; resetAt: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(rateLimitConfig?: Partial<RateLimitConfig>) {
    super();
    this.config = {
      windowMs: rateLimitConfig?.windowMs || config.rateLimit.windowMs,
      maxRequests: rateLimitConfig?.maxRequests || config.rateLimit.maxRequests,
      keyPrefix: rateLimitConfig?.keyPrefix || config.rateLimit.keyPrefix
    };
  }

  start(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupLocalCache();
    }, 60000);
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.localCache.clear();
  }

  async checkLimit(key: string): Promise<RateLimitInfo> {
    const fullKey = `${this.config.keyPrefix}${key}`;

    try {
      const result = await this.checkRedisLimit(fullKey);
      return result;
    } catch (error) {
      logger.warn('Redis rate limit check failed, using local cache', {
        key,
        error: (error as Error).message
      });
      return this.checkLocalLimit(fullKey);
    }
  }

  async incrementCount(key: string): Promise<RateLimitInfo> {
    const fullKey = `${this.config.keyPrefix}${key}`;

    try {
      const result = await this.incrementRedisCount(fullKey);

      if (result.remaining <= 0) {
        this.emit('rateLimitExceeded', { key, info: result });
      }

      return result;
    } catch (error) {
      logger.warn('Redis rate limit increment failed, using local cache', {
        key,
        error: (error as Error).message
      });
      return this.incrementLocalCount(fullKey);
    }
  }

  async resetLimit(key: string): Promise<void> {
    const fullKey = `${this.config.keyPrefix}${key}`;

    try {
      await redisClient.del(fullKey);
    } catch (error) {
      logger.warn('Failed to reset rate limit in Redis', {
        key,
        error: (error as Error).message
      });
    }

    this.localCache.delete(fullKey);
  }

  async isAllowed(key: string): Promise<boolean> {
    const info = await this.checkLimit(key);
    return info.remaining > 0;
  }

  async consume(key: string, tokens: number = 1): Promise<RateLimitInfo> {
    const info = await this.checkLimit(key);

    if (info.remaining < tokens) {
      const retryAfter = Math.ceil((info.resetAt.getTime() - Date.now()) / 1000);
      throw new RateLimitError(
        `Rate limit exceeded for key: ${key}`,
        retryAfter > 0 ? retryAfter : 1
      );
    }

    for (let i = 0; i < tokens; i++) {
      await this.incrementCount(key);
    }

    return this.checkLimit(key);
  }

  private async checkRedisLimit(key: string): Promise<RateLimitInfo> {
    const count = await redisClient.get(key);
    const ttl = await redisClient.ttl(key);

    const currentCount = count ? parseInt(count, 10) : 0;
    const resetAt = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : this.config.windowMs));

    return {
      key,
      count: currentCount,
      resetAt,
      remaining: Math.max(0, this.config.maxRequests - currentCount)
    };
  }

  private async incrementRedisCount(key: string): Promise<RateLimitInfo> {
    const now = Date.now();

    const result = (await redisClient.eval(
      RATE_LIMIT_SCRIPT,
      [key],
      [this.config.maxRequests, this.config.windowMs, now]
    )) as [number, number, number];

    const [allowed, count, ttl] = result;
    const resetAt = new Date(now + (ttl > 0 ? ttl : this.config.windowMs));

    return {
      key,
      count,
      resetAt,
      remaining: Math.max(0, this.config.maxRequests - count)
    };
  }

  private checkLocalLimit(key: string): RateLimitInfo {
    const now = Date.now();
    const cached = this.localCache.get(key);

    if (!cached || cached.resetAt <= now) {
      return {
        key,
        count: 0,
        resetAt: new Date(now + this.config.windowMs),
        remaining: this.config.maxRequests
      };
    }

    return {
      key,
      count: cached.count,
      resetAt: new Date(cached.resetAt),
      remaining: Math.max(0, this.config.maxRequests - cached.count)
    };
  }

  private incrementLocalCount(key: string): RateLimitInfo {
    const now = Date.now();
    let cached = this.localCache.get(key);

    if (!cached || cached.resetAt <= now) {
      cached = {
        count: 0,
        resetAt: now + this.config.windowMs
      };
    }

    cached.count++;
    this.localCache.set(key, cached);

    const info: RateLimitInfo = {
      key,
      count: cached.count,
      resetAt: new Date(cached.resetAt),
      remaining: Math.max(0, this.config.maxRequests - cached.count)
    };

    if (info.remaining <= 0) {
      this.emit('rateLimitExceeded', { key, info });
    }

    return info;
  }

  private cleanupLocalCache(): void {
    const now = Date.now();
    for (const [key, value] of this.localCache.entries()) {
      if (value.resetAt <= now) {
        this.localCache.delete(key);
      }
    }
  }

  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Rate limiter config updated', { config: this.config });
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const testKey = `${this.config.keyPrefix}health_check_${Date.now()}`;
      await redisClient.set(testKey, '1', 1000);
      await redisClient.del(testKey);

      return {
        service: 'rate-limiter',
        status: 'healthy',
        details: {
          windowMs: this.config.windowMs,
          maxRequests: this.config.maxRequests,
          localCacheSize: this.localCache.size
        }
      };
    } catch (error) {
      return {
        service: 'rate-limiter',
        status: 'degraded',
        message: 'Redis unavailable, using local cache',
        details: {
          localCacheSize: this.localCache.size
        }
      };
    }
  }
}

export function createRateLimitMiddleware(rateLimiter: RateLimiter) {
  return async (
    req: { ip?: string; headers?: Record<string, string | string[] | undefined> },
    res: { status: (code: number) => { json: (body: unknown) => void }; setHeader: (name: string, value: string) => void },
    next: () => void
  ): Promise<void> => {
    const clientId =
      req.ip ||
      (req.headers?.['x-forwarded-for'] as string)?.split(',')[0] ||
      'unknown';

    try {
      const info = await rateLimiter.incrementCount(clientId);

      res.setHeader('X-RateLimit-Limit', rateLimiter.getConfig().maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', info.remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(info.resetAt.getTime() / 1000).toString());

      if (info.remaining < 0) {
        const retryAfter = Math.ceil((info.resetAt.getTime() - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());
        res.status(429).json({
          error: 'Too Many Requests',
          retryAfter
        });
        return;
      }

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        res.setHeader('Retry-After', error.retryAfter.toString());
        res.status(429).json({
          error: error.message,
          retryAfter: error.retryAfter
        });
        return;
      }
      next();
    }
  };
}
