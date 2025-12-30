import Redis from 'ioredis';
import { config } from './index';

let redisClient: Redis | null = null;

export const initializeRedis = (): Redis => {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      enableReadyCheck: true,
      lazyConnect: true,
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

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    return initializeRedis();
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
  playerPity: (playerId: string, bannerType: string) =>
    `gacha:pity:${playerId}:${bannerType}`,
  playerPityBanner: (playerId: string, bannerId: string) =>
    `gacha:pity:${playerId}:banner:${bannerId}`,
  banner: (bannerId: string) => `gacha:banner:${bannerId}`,
  activeBanners: () => 'gacha:banners:active',
  playerInventory: (playerId: string) => `gacha:inventory:${playerId}`,
  playerCurrency: (playerId: string, currencyType: string) =>
    `gacha:currency:${playerId}:${currencyType}`,
  playerSpending: (playerId: string) => `gacha:spending:${playerId}`,
  dropRates: (bannerId: string) => `gacha:droprates:${bannerId}`,
  pullLock: (playerId: string) => `gacha:lock:pull:${playerId}`,
  currencyLock: (playerId: string) => `gacha:lock:currency:${playerId}`,
  rateLimitPull: (playerId: string) => `gacha:ratelimit:pull:${playerId}`,
  rateLimitCurrency: (playerId: string) => `gacha:ratelimit:currency:${playerId}`,
  statisticsDaily: (date: string) => `gacha:stats:daily:${date}`,
  statisticsBanner: (bannerId: string) => `gacha:stats:banner:${bannerId}`,
};

export const REDIS_TTL = {
  pity: 3600,
  banner: 300,
  activeBanners: 60,
  inventory: 120,
  currency: 60,
  spending: 300,
  dropRates: 3600,
  lock: 30,
  rateLimit: 60,
  statistics: 86400,
};

export default { initializeRedis, getRedisClient, closeRedis, REDIS_KEYS, REDIS_TTL };
