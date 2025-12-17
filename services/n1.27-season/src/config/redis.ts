import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD || undefined,
      db: config.REDIS_DB,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redisClient.on('error', (err: Error) => {
      logger.error('Redis connection error:', err);
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }

  return redisClient;
};

export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
};

export const CACHE_KEYS = {
  PLAYER_MMR: (playerId: string, seasonId: string): string => `mmr:${seasonId}:${playerId}`,
  PLAYER_RANK: (playerId: string, seasonId: string): string => `rank:${seasonId}:${playerId}`,
  LEADERBOARD: (seasonId: string, page: number): string => `leaderboard:${seasonId}:${page}`,
  SEASON_INFO: (seasonId: string): string => `season:${seasonId}`,
  ACTIVE_SEASON: (): string => 'season:active',
};

export const CACHE_TTL = {
  PLAYER_MMR: 300,
  PLAYER_RANK: 300,
  LEADERBOARD: 60,
  SEASON_INFO: 3600,
  ACTIVE_SEASON: 3600,
};
