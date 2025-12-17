import Redis from 'ioredis';
import { config } from './index.js';

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  keyPrefix: config.redis.keyPrefix,
  retryStrategy: (times: number) => {
    if (times > 3) {
      console.error('Redis connection failed after 3 retries');
      return null;
    }
    return Math.min(times * 200, 2000);
  },
  maxRetriesPerRequest: 3
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('connect', () => {
  console.info('Redis connected');
});

export class CacheService {
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return this.prefix ? `${this.prefix}:${key}` : key;
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(this.getKey(key));
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.setex(this.getKey(key), ttlSeconds, serialized);
    } else {
      await redis.set(this.getKey(key), serialized);
    }
  }

  async delete(key: string): Promise<void> {
    await redis.del(this.getKey(key));
  }

  async deletePattern(pattern: string): Promise<void> {
    const keys = await redis.keys(this.getKey(pattern));
    if (keys.length > 0) {
      const keysWithoutPrefix = keys.map(k => k.replace(config.redis.keyPrefix, ''));
      await redis.del(...keysWithoutPrefix);
    }
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    if (amount === 1) {
      return redis.incr(this.getKey(key));
    }
    return redis.incrby(this.getKey(key), amount);
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    if (amount === 1) {
      return redis.decr(this.getKey(key));
    }
    return redis.decrby(this.getKey(key), amount);
  }

  async setHash<T extends Record<string, unknown>>(key: string, data: T): Promise<void> {
    const entries = Object.entries(data).flatMap(([k, v]) => [k, JSON.stringify(v)]);
    if (entries.length > 0) {
      await redis.hset(this.getKey(key), ...entries);
    }
  }

  async getHash<T extends Record<string, unknown>>(key: string): Promise<T | null> {
    const data = await redis.hgetall(this.getKey(key));
    if (!data || Object.keys(data).length === 0) return null;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      try {
        result[k] = JSON.parse(v);
      } catch {
        result[k] = v;
      }
    }
    return result as T;
  }

  async getHashField<T>(key: string, field: string): Promise<T | null> {
    const data = await redis.hget(this.getKey(key), field);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async setHashField<T>(key: string, field: string, value: T): Promise<void> {
    await redis.hset(this.getKey(key), field, JSON.stringify(value));
  }

  async addToSet(key: string, ...members: string[]): Promise<number> {
    return redis.sadd(this.getKey(key), ...members);
  }

  async getSetMembers(key: string): Promise<string[]> {
    return redis.smembers(this.getKey(key));
  }

  async isSetMember(key: string, member: string): Promise<boolean> {
    const result = await redis.sismember(this.getKey(key), member);
    return result === 1;
  }

  async pushToList(key: string, ...values: string[]): Promise<number> {
    return redis.rpush(this.getKey(key), ...values);
  }

  async getListRange(key: string, start: number, stop: number): Promise<string[]> {
    return redis.lrange(this.getKey(key), start, stop);
  }

  async trimList(key: string, start: number, stop: number): Promise<void> {
    await redis.ltrim(this.getKey(key), start, stop);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await redis.expire(this.getKey(key), ttlSeconds);
  }

  async exists(key: string): Promise<boolean> {
    const result = await redis.exists(this.getKey(key));
    return result === 1;
  }
}

export const achievementCache = new CacheService('achievements');
export const progressCache = new CacheService('progress');
export const notificationCache = new CacheService('notifications');
export const statsCache = new CacheService('stats');

export async function healthCheck(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
}
