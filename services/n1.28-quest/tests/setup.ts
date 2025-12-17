jest.mock('../src/config/database', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn()
  };

  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    query: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
    on: jest.fn()
  };

  return {
    pool: mockPool,
    initializeDatabase: jest.fn().mockResolvedValue(undefined),
    closeDatabase: jest.fn().mockResolvedValue(undefined)
  };
});

jest.mock('../src/config/redis', () => {
  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn()
  };

  return {
    redis: mockRedis,
    CACHE_KEYS: {
      QUEST: (id: string) => `quest:${id}`,
      QUESTS_LIST: (type?: string) => `quests:list:${type || 'all'}`,
      USER_QUESTS: (userId: string) => `user:${userId}:quests`,
      USER_REWARDS: (userId: string) => `user:${userId}:rewards`,
      DAILY_RESET: 'quest:daily:reset',
      WEEKLY_RESET: 'quest:weekly:reset'
    },
    closeRedis: jest.fn().mockResolvedValue(undefined)
  };
});

jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  jest.restoreAllMocks();
});
