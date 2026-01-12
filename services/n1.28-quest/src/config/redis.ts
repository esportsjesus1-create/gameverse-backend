import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

const redisConfig = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retryStrategy: (times: number): number | null => {
    if (times > 3) {
      logger.error('Redis connection failed after 3 retries');
      return null;
    }
    return Math.min(times * 100, 3000);
  },
  maxRetriesPerRequest: 3
};

export const redis = new Redis(redisConfig);

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

redis.on('error', (err) => {
  logger.error('Redis connection error', err);
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

export const CACHE_KEYS = {
  QUEST: (id: string): string => `quest:${id}`,
  QUESTS_LIST: (type?: string): string => `quests:list:${type || 'all'}`,
  USER_QUESTS: (userId: string): string => `user:${userId}:quests`,
  USER_REWARDS: (userId: string): string => `user:${userId}:rewards`,
  DAILY_RESET: 'quest:daily:reset',
  WEEKLY_RESET: 'quest:weekly:reset'
};

export async function closeRedis(): Promise<void> {
  await redis.quit();
  logger.info('Redis connection closed');
}
