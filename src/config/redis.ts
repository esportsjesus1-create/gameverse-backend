import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
};

export const redis = new Redis(redisConfig);

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

export const CACHE_KEYS = {
  PARTY: (id: string) => `party:${id}`,
  PARTY_MEMBERS: (partyId: string) => `party:${partyId}:members`,
  USER_PARTY: (userId: string) => `user:${userId}:party`,
  USER_INVITES: (userId: string) => `user:${userId}:invites`,
  VOICE_CHANNEL: (channelId: string) => `voice:${channelId}`,
  VOICE_PARTICIPANTS: (channelId: string) => `voice:${channelId}:participants`,
  PARTY_BENEFITS: (partyId: string) => `party:${partyId}:benefits`,
  ONLINE_USERS: 'online:users',
};

export const CACHE_TTL = {
  PARTY: 300,
  PARTY_MEMBERS: 60,
  USER_PARTY: 60,
  USER_INVITES: 120,
  VOICE_CHANNEL: 60,
  VOICE_PARTICIPANTS: 30,
  PARTY_BENEFITS: 300,
};

export async function cacheGet<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttl?: number): Promise<void> {
  const serialized = JSON.stringify(value);
  if (ttl) {
    await redis.setex(key, ttl, serialized);
  } else {
    await redis.set(key, serialized);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  await redis.del(key);
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
}
