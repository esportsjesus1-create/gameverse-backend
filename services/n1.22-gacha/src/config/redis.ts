import Redis from 'ioredis';
import config from './index';

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis connected successfully');
    });
  }

  return redisClient;
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};

export const REDIS_KEYS = {
  playerPity: (playerId: string, bannerType: string): string =>
    `gacha:pity:${playerId}:${bannerType}`,
  bannerConfig: (bannerId: string): string => `gacha:banner:${bannerId}`,
  pullHistory: (playerId: string): string => `gacha:history:${playerId}`,
  rateLimit: (playerId: string): string => `gacha:ratelimit:${playerId}`,
};

export const REDIS_TTL = {
  pity: 60 * 60 * 24 * 30,
  banner: 60 * 60,
  history: 60 * 60 * 24 * 7,
  rateLimit: 60,
};
