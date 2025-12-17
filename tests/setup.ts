import { Pool } from 'pg';
import Redis from 'ioredis';

jest.mock('../src/config/database', () => {
  const mockPool = {
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: jest.fn(),
    }),
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    end: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  };

  return {
    pool: mockPool,
    initializeDatabase: jest.fn().mockResolvedValue(undefined),
    closeDatabase: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock('../src/config/redis', () => {
  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    publish: jest.fn().mockResolvedValue(1),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    smembers: jest.fn().mockResolvedValue([]),
    sismember: jest.fn().mockResolvedValue(0),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
  };

  return {
    redis: mockRedis,
    CACHE_KEYS: {
      PARTY: (id: string) => `party:${id}`,
      PARTY_MEMBERS: (partyId: string) => `party:${partyId}:members`,
      USER_PARTY: (userId: string) => `user:${userId}:party`,
      USER_INVITES: (userId: string) => `user:${userId}:invites`,
      VOICE_CHANNEL: (channelId: string) => `voice:${channelId}`,
      VOICE_PARTICIPANTS: (channelId: string) => `voice:${channelId}:participants`,
      PARTY_BENEFITS: (partyId: string) => `party:${partyId}:benefits`,
      ONLINE_USERS: 'online:users',
    },
    CACHE_TTL: {
      PARTY: 300,
      PARTY_MEMBERS: 60,
      USER_PARTY: 60,
      USER_INVITES: 120,
      VOICE_CHANNEL: 60,
      VOICE_PARTICIPANTS: 30,
      PARTY_BENEFITS: 300,
    },
    cacheGet: jest.fn().mockResolvedValue(null),
    cacheSet: jest.fn().mockResolvedValue(undefined),
    cacheDelete: jest.fn().mockResolvedValue(undefined),
    cacheDeletePattern: jest.fn().mockResolvedValue(undefined),
    closeRedis: jest.fn().mockResolvedValue(undefined),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  jest.restoreAllMocks();
});
