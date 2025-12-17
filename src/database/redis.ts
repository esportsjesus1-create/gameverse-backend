import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ConnectionError } from '../utils/errors';
import { HealthCheckResult } from '../types';

export class RedisClient {
  private client: Redis | null = null;
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    try {
      this.client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
        retryStrategy: (times) => {
          if (times > 3) {
            return null;
          }
          return Math.min(times * 200, 2000);
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Connected to Redis');
      });

      this.client.on('error', (err) => {
        logger.error('Redis error', { error: err.message });
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
      });

      await this.client.ping();
      this.isConnected = true;
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to connect to Redis', { error: err.message });
      throw new ConnectionError('Redis', { error: err.message });
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info('Disconnected from Redis');
    }
  }

  getClient(): Redis {
    if (!this.client) {
      throw new ConnectionError('Redis', { reason: 'Not connected' });
    }
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.getClient().get(key);
  }

  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    if (ttlMs) {
      await this.getClient().set(key, value, 'PX', ttlMs);
    } else {
      await this.getClient().set(key, value);
    }
  }

  async del(key: string): Promise<number> {
    return this.getClient().del(key);
  }

  async incr(key: string): Promise<number> {
    return this.getClient().incr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.getClient().expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return this.getClient().ttl(key);
  }

  async exists(key: string): Promise<number> {
    return this.getClient().exists(key);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.getClient().hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.getClient().hset(key, field, value);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.getClient().hgetall(key);
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.getClient().hdel(key, ...fields);
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.getClient().lpush(key, ...values);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.getClient().lrange(key, start, stop);
  }

  async ltrim(key: string, start: number, stop: number): Promise<string> {
    return this.getClient().ltrim(key, start, stop);
  }

  async eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown> {
    return this.getClient().eval(script, keys.length, ...keys, ...args);
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      if (!this.client) {
        return {
          service: 'redis',
          status: 'unhealthy',
          message: 'Not connected'
        };
      }

      await this.client.ping();
      const latency = Date.now() - startTime;

      return {
        service: 'redis',
        status: latency < 50 ? 'healthy' : 'degraded',
        latency,
        details: { connected: this.isConnected }
      };
    } catch (error) {
      const err = error as Error;
      return {
        service: 'redis',
        status: 'unhealthy',
        latency: Date.now() - startTime,
        message: err.message
      };
    }
  }
}

export const redisClient = new RedisClient();
