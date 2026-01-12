import Redis from 'ioredis';
import { config } from '../config';

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

export function getReconnectTokenKey(sessionId: string, playerId: string): string {
  return `reconnect:${sessionId}:${playerId}`;
}

export function getSessionCacheKey(sessionId: string): string {
  return `session:${sessionId}`;
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
}
