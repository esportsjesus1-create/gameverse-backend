process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.DEFAULT_MMR = '1200';
process.env.MIN_MMR = '0';
process.env.MAX_MMR = '5000';
process.env.PLACEMENT_MATCHES_REQUIRED = '10';
process.env.SOFT_RESET_FACTOR = '0.5';
process.env.LOG_LEVEL = 'error';

jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn().mockResolvedValue(null as string | null),
    set: jest.fn().mockResolvedValue('OK' as const),
    setex: jest.fn().mockResolvedValue('OK' as const),
    del: jest.fn().mockResolvedValue(1 as number),
    keys: jest.fn().mockResolvedValue([] as string[]),
    ping: jest.fn().mockResolvedValue('PONG' as const),
    quit: jest.fn().mockResolvedValue('OK' as const),
    on: jest.fn(),
  };
  return jest.fn(() => mockRedis);
});

afterAll(() => {
  jest.clearAllMocks();
});
