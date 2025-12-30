import Redis, { RedisOptions } from 'ioredis';
import dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

const isTest = process.env.NODE_ENV === 'test';

const redisConfig: RedisOptions = {
  host: isTest ? process.env.TEST_REDIS_HOST : process.env.REDIS_HOST || 'localhost',
  port: parseInt(
    isTest ? process.env.TEST_REDIS_PORT || '6380' : process.env.REDIS_PORT || '6379',
    10
  ),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(isTest ? process.env.TEST_REDIS_DB || '1' : process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    if (times > 3) {
      logger.error('Redis connection failed after 3 retries');
      return null;
    }
    return Math.min(times * 100, 3000);
  },
  connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
  commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000', 10),
  lazyConnect: true,
};

export const redis = new Redis(redisConfig);

const subscriberRedis = new Redis(redisConfig);
const publisherRedis = new Redis(redisConfig);

redis.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

export const CACHE_KEYS = {
  PARTY: (id: string) => `party:${id}`,
  PARTY_MEMBERS: (partyId: string) => `party:${partyId}:members`,
  PARTY_INVITES: (partyId: string) => `party:${partyId}:invites`,
  USER: (id: string) => `user:${id}`,
  USER_PARTY: (userId: string) => `user:${userId}:party`,
  USER_INVITES: (userId: string) => `user:${userId}:invites`,
  USER_FRIENDS: (userId: string) => `user:${userId}:friends`,
  USER_BLOCKED: (userId: string) => `user:${userId}:blocked`,
  VOICE_CHANNEL: (channelId: string) => `voice:${channelId}`,
  VOICE_PARTICIPANTS: (channelId: string) => `voice:${channelId}:participants`,
  TOURNAMENT: (id: string) => `tournament:${id}`,
  TOURNAMENT_PARTICIPANTS: (tournamentId: string) => `tournament:${tournamentId}:participants`,
  TOURNAMENT_MATCHES: (tournamentId: string) => `tournament:${tournamentId}:matches`,
  TOURNAMENT_BRACKET: (tournamentId: string) => `tournament:${tournamentId}:bracket`,
  SEASON: (id: string) => `season:${id}`,
  SEASON_LEADERBOARD: (seasonId: string) => `season:${seasonId}:leaderboard`,
  SEASON_REWARDS: (seasonId: string) => `season:${seasonId}:rewards`,
  SEASON_PLAYER: (seasonId: string, playerId: string) => `season:${seasonId}:player:${playerId}`,
  ONLINE_USERS: 'online:users',
  RATE_LIMIT: (key: string) => `ratelimit:${key}`,
  SESSION: (sessionId: string) => `session:${sessionId}`,
};

export const CACHE_TTL = {
  PARTY: 300,
  PARTY_MEMBERS: 60,
  USER: 600,
  USER_PARTY: 60,
  USER_INVITES: 120,
  USER_FRIENDS: 300,
  VOICE_CHANNEL: 60,
  VOICE_PARTICIPANTS: 30,
  TOURNAMENT: 300,
  TOURNAMENT_PARTICIPANTS: 120,
  TOURNAMENT_MATCHES: 60,
  TOURNAMENT_BRACKET: 120,
  SEASON: 600,
  SEASON_LEADERBOARD: 60,
  SEASON_REWARDS: 300,
  SEASON_PLAYER: 120,
  SESSION: 3600,
  RATE_LIMIT: 60,
};

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    logger.error('Cache get error', { key, error });
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttl?: number): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await redis.setex(key, ttl, serialized);
    } else {
      await redis.set(key, serialized);
    }
  } catch (error) {
    logger.error('Cache set error', { key, error });
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    logger.error('Cache delete error', { key, error });
  }
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    logger.error('Cache delete pattern error', { pattern, error });
  }
}

export async function cacheIncrement(key: string, ttl?: number): Promise<number> {
  const result = await redis.incr(key);
  if (ttl && result === 1) {
    await redis.expire(key, ttl);
  }
  return result;
}

export async function cacheHashSet(
  key: string,
  field: string,
  value: string,
  ttl?: number
): Promise<void> {
  await redis.hset(key, field, value);
  if (ttl) {
    await redis.expire(key, ttl);
  }
}

export async function cacheHashGet(key: string, field: string): Promise<string | null> {
  return redis.hget(key, field);
}

export async function cacheHashGetAll(key: string): Promise<Record<string, string>> {
  return redis.hgetall(key);
}

export async function cacheListPush(key: string, value: string, ttl?: number): Promise<void> {
  await redis.rpush(key, value);
  if (ttl) {
    await redis.expire(key, ttl);
  }
}

export async function cacheListRange(key: string, start: number, stop: number): Promise<string[]> {
  return redis.lrange(key, start, stop);
}

export async function cacheSortedSetAdd(
  key: string,
  score: number,
  member: string,
  ttl?: number
): Promise<void> {
  await redis.zadd(key, score, member);
  if (ttl) {
    await redis.expire(key, ttl);
  }
}

export async function cacheSortedSetRange(
  key: string,
  start: number,
  stop: number,
  withScores = false
): Promise<string[]> {
  if (withScores) {
    return redis.zrange(key, start, stop, 'WITHSCORES');
  }
  return redis.zrange(key, start, stop);
}

export async function cacheSortedSetRank(key: string, member: string): Promise<number | null> {
  return redis.zrank(key, member);
}

export async function publish(channel: string, message: string): Promise<void> {
  await publisherRedis.publish(channel, message);
}

export async function subscribe(
  channel: string,
  callback: (message: string) => void
): Promise<void> {
  await subscriberRedis.subscribe(channel);
  subscriberRedis.on('message', (ch, message) => {
    if (ch === channel) {
      callback(message);
    }
  });
}

export async function healthCheck(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error('Redis health check failed', { error });
    return false;
  }
}

export async function connectRedis(): Promise<void> {
  await redis.connect();
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
  await subscriberRedis.quit();
  await publisherRedis.quit();
  logger.info('Redis connections closed');
}

export { redis as redisClient, subscriberRedis, publisherRedis };
