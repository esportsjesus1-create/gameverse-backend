jest.mock('../src/config/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn()
  },
  query: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn(),
  transaction: jest.fn(),
  healthCheck: jest.fn().mockResolvedValue(true),
  closePool: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/config/redis', () => {
  const mockCacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    deletePattern: jest.fn().mockResolvedValue(undefined),
    increment: jest.fn().mockResolvedValue(1),
    decrement: jest.fn().mockResolvedValue(0),
    setHash: jest.fn().mockResolvedValue(undefined),
    getHash: jest.fn().mockResolvedValue(null),
    getHashField: jest.fn().mockResolvedValue(null),
    setHashField: jest.fn().mockResolvedValue(undefined),
    addToSet: jest.fn().mockResolvedValue(1),
    getSetMembers: jest.fn().mockResolvedValue([]),
    isSetMember: jest.fn().mockResolvedValue(false),
    pushToList: jest.fn().mockResolvedValue(1),
    getListRange: jest.fn().mockResolvedValue([]),
    trimList: jest.fn().mockResolvedValue(undefined),
    expire: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(false)
  };

  return {
    redis: {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
      incr: jest.fn(),
      incrby: jest.fn(),
      decr: jest.fn(),
      decrby: jest.fn(),
      hset: jest.fn(),
      hget: jest.fn(),
      hgetall: jest.fn(),
      sadd: jest.fn(),
      smembers: jest.fn(),
      sismember: jest.fn(),
      rpush: jest.fn(),
      lrange: jest.fn(),
      ltrim: jest.fn(),
      expire: jest.fn(),
      exists: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn().mockResolvedValue(undefined)
    },
    CacheService: jest.fn().mockImplementation(() => mockCacheService),
    achievementCache: mockCacheService,
    progressCache: mockCacheService,
    notificationCache: mockCacheService,
    statsCache: mockCacheService,
    healthCheck: jest.fn().mockResolvedValue(true),
    closeRedis: jest.fn().mockResolvedValue(undefined)
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  jest.restoreAllMocks();
});
