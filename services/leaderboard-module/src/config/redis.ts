import Redis from 'ioredis';
import { config } from './index';
import { logger, EventType } from '../utils/logger';

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
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      logger.info(EventType.SERVICE_STARTED, 'Redis connected successfully');
    });

    redisClient.on('error', (err: Error) => {
      logger.error(EventType.CACHE_ERROR, 'Redis connection error', err);
    });

    redisClient.on('close', () => {
      logger.warn(EventType.SERVICE_STOPPED, 'Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      logger.info(EventType.SERVICE_STARTED, 'Redis reconnecting...');
    });
  }

  return redisClient;
};

export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info(EventType.SERVICE_STOPPED, 'Redis connection closed gracefully');
  }
};

export const CACHE_KEYS = {
  LEADERBOARD: (leaderboardId: string, page: number): string =>
    `leaderboard:${leaderboardId}:page:${page}`,
  LEADERBOARD_TOP_100: (leaderboardId: string): string =>
    `leaderboard:${leaderboardId}:top100`,
  LEADERBOARD_STATS: (leaderboardId: string): string =>
    `leaderboard:${leaderboardId}:stats`,
  PLAYER_RANK: (playerId: string, leaderboardId: string): string =>
    `player:${playerId}:leaderboard:${leaderboardId}:rank`,
  PLAYER_GLOBAL_RANK: (playerId: string): string =>
    `player:${playerId}:global:rank`,
  PLAYER_SEASONAL_RANK: (playerId: string, seasonId: string): string =>
    `player:${playerId}:season:${seasonId}:rank`,
  PLAYER_REGIONAL_RANK: (playerId: string, region: string): string =>
    `player:${playerId}:region:${region}:rank`,
  PLAYER_CONTEXT: (playerId: string, leaderboardId: string): string =>
    `player:${playerId}:leaderboard:${leaderboardId}:context`,
  FRIEND_LEADERBOARD: (playerId: string, gameId?: string): string =>
    gameId ? `friends:${playerId}:game:${gameId}` : `friends:${playerId}:all`,
  TIER_DISTRIBUTION: (leaderboardId: string): string =>
    `leaderboard:${leaderboardId}:tier_distribution`,
  REGION_DISTRIBUTION: (leaderboardId: string): string =>
    `leaderboard:${leaderboardId}:region_distribution`,
  ACTIVE_SEASON: (): string => 'season:active',
  SEASON_INFO: (seasonId: string): string => `season:${seasonId}:info`,
  RATE_LIMIT: (playerId: string, tier: string): string =>
    `ratelimit:${tier}:${playerId}`,
  WEBSOCKET_SUBSCRIPTIONS: (connectionId: string): string =>
    `ws:subscriptions:${connectionId}`,
  ANTI_CHEAT_SCORE_HISTORY: (playerId: string): string =>
    `anticheat:scores:${playerId}`,
  DECAY_STATUS: (playerId: string, leaderboardId: string): string =>
    `decay:${playerId}:${leaderboardId}`,
};

export const CACHE_TTL = {
  LEADERBOARD: config.CACHE_TTL_LEADERBOARD,
  LEADERBOARD_TOP_100: config.CACHE_TTL_TOP_100,
  LEADERBOARD_STATS: config.CACHE_TTL_STATISTICS,
  PLAYER_RANK: config.CACHE_TTL_PLAYER_RANK,
  PLAYER_CONTEXT: 120,
  FRIEND_LEADERBOARD: 180,
  TIER_DISTRIBUTION: config.CACHE_TTL_STATISTICS,
  REGION_DISTRIBUTION: config.CACHE_TTL_STATISTICS,
  ACTIVE_SEASON: 3600,
  SEASON_INFO: 3600,
  RATE_LIMIT_WINDOW: 60,
  WEBSOCKET_SUBSCRIPTIONS: 86400,
  ANTI_CHEAT_HISTORY: 3600,
  DECAY_STATUS: 300,
};

export class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = getRedisClient();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (data) {
        logger.logCacheHit(key);
        return JSON.parse(data) as T;
      }
      logger.logCacheMiss(key);
      return null;
    } catch (error) {
      logger.error(EventType.CACHE_ERROR, `Cache get failed for key: ${key}`, error as Error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl: number): Promise<boolean> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
      logger.logCacheSet(key, ttl);
      return true;
    } catch (error) {
      logger.error(EventType.CACHE_ERROR, `Cache set failed for key: ${key}`, error as Error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      logger.logCacheInvalidated([key]);
      return true;
    } catch (error) {
      logger.error(EventType.CACHE_ERROR, `Cache delete failed for key: ${key}`, error as Error);
      return false;
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.logCacheInvalidated(keys);
      }
      return keys.length;
    } catch (error) {
      logger.error(EventType.CACHE_ERROR, `Cache delete pattern failed: ${pattern}`, error as Error);
      return 0;
    }
  }

  async invalidateLeaderboard(leaderboardId: string): Promise<void> {
    const patterns = [
      `leaderboard:${leaderboardId}:*`,
      `player:*:leaderboard:${leaderboardId}:*`,
    ];
    for (const pattern of patterns) {
      await this.deletePattern(pattern);
    }
  }

  async invalidatePlayerRanks(playerId: string): Promise<void> {
    await this.deletePattern(`player:${playerId}:*`);
  }

  async invalidateFriendLeaderboards(playerIds: string[]): Promise<void> {
    for (const playerId of playerIds) {
      await this.deletePattern(`friends:${playerId}:*`);
    }
  }

  async getTop100(leaderboardId: string): Promise<unknown[] | null> {
    return this.get<unknown[]>(CACHE_KEYS.LEADERBOARD_TOP_100(leaderboardId));
  }

  async setTop100(leaderboardId: string, entries: unknown[]): Promise<boolean> {
    return this.set(
      CACHE_KEYS.LEADERBOARD_TOP_100(leaderboardId),
      entries,
      CACHE_TTL.LEADERBOARD_TOP_100
    );
  }

  async getLeaderboardPage(leaderboardId: string, page: number): Promise<unknown | null> {
    return this.get(CACHE_KEYS.LEADERBOARD(leaderboardId, page));
  }

  async setLeaderboardPage(leaderboardId: string, page: number, data: unknown): Promise<boolean> {
    return this.set(CACHE_KEYS.LEADERBOARD(leaderboardId, page), data, CACHE_TTL.LEADERBOARD);
  }

  async getPlayerRank(playerId: string, leaderboardId: string): Promise<unknown | null> {
    return this.get(CACHE_KEYS.PLAYER_RANK(playerId, leaderboardId));
  }

  async setPlayerRank(playerId: string, leaderboardId: string, rank: unknown): Promise<boolean> {
    return this.set(
      CACHE_KEYS.PLAYER_RANK(playerId, leaderboardId),
      rank,
      CACHE_TTL.PLAYER_RANK
    );
  }

  async getLeaderboardStats(leaderboardId: string): Promise<unknown | null> {
    return this.get(CACHE_KEYS.LEADERBOARD_STATS(leaderboardId));
  }

  async setLeaderboardStats(leaderboardId: string, stats: unknown): Promise<boolean> {
    return this.set(
      CACHE_KEYS.LEADERBOARD_STATS(leaderboardId),
      stats,
      CACHE_TTL.LEADERBOARD_STATS
    );
  }

  async incrementRateLimit(playerId: string, tier: string): Promise<number> {
    const key = CACHE_KEYS.RATE_LIMIT(playerId, tier);
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, CACHE_TTL.RATE_LIMIT_WINDOW);
    }
    return count;
  }

  async getRateLimitCount(playerId: string, tier: string): Promise<number> {
    const key = CACHE_KEYS.RATE_LIMIT(playerId, tier);
    const count = await this.redis.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  async addScoreToAntiCheatHistory(playerId: string, score: number): Promise<void> {
    const key = CACHE_KEYS.ANTI_CHEAT_SCORE_HISTORY(playerId);
    await this.redis.lpush(key, score.toString());
    await this.redis.ltrim(key, 0, 99);
    await this.redis.expire(key, CACHE_TTL.ANTI_CHEAT_HISTORY);
  }

  async getAntiCheatScoreHistory(playerId: string): Promise<number[]> {
    const key = CACHE_KEYS.ANTI_CHEAT_SCORE_HISTORY(playerId);
    const scores = await this.redis.lrange(key, 0, -1);
    return scores.map((s) => parseInt(s, 10));
  }

  async setWebSocketSubscriptions(connectionId: string, leaderboardIds: string[]): Promise<void> {
    const key = CACHE_KEYS.WEBSOCKET_SUBSCRIPTIONS(connectionId);
    await this.redis.del(key);
    if (leaderboardIds.length > 0) {
      await this.redis.sadd(key, ...leaderboardIds);
      await this.redis.expire(key, CACHE_TTL.WEBSOCKET_SUBSCRIPTIONS);
    }
  }

  async getWebSocketSubscriptions(connectionId: string): Promise<string[]> {
    const key = CACHE_KEYS.WEBSOCKET_SUBSCRIPTIONS(connectionId);
    return this.redis.smembers(key);
  }

  async removeWebSocketSubscriptions(connectionId: string): Promise<void> {
    const key = CACHE_KEYS.WEBSOCKET_SUBSCRIPTIONS(connectionId);
    await this.redis.del(key);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

export const cacheService = new CacheService();
export default cacheService;
