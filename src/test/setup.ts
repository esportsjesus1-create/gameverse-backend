import { jest } from '@jest/globals';

jest.mock('../config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  transaction: jest.fn(),
  closePool: jest.fn(),
  healthCheck: jest.fn(),
  getPool: jest.fn(),
}));

jest.mock('../config/redis', () => {
  const mockRedis = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn().mockImplementation(() => Promise.resolve([])),
    exists: jest.fn(),
    ping: jest.fn().mockImplementation(() => Promise.resolve('PONG')),
    quit: jest.fn(),
    connect: jest.fn(),
    status: 'ready',
    on: jest.fn(),
  };

  return {
    getRedisClient: jest.fn(() => mockRedis),
    connectRedis: jest.fn(),
    closeRedis: jest.fn(),
    redisHealthCheck: jest.fn().mockImplementation(() => Promise.resolve(true)),
    CacheService: jest.fn().mockImplementation(() => ({
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      deletePattern: jest.fn(),
      exists: jest.fn(),
      invalidateUserCache: jest.fn(),
      generateUserKey: jest.fn((id: string) => `user:${id}`),
      generateUserAddressesKey: jest.fn((id: string) => `user:${id}:addresses`),
    })),
    cacheService: {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      deletePattern: jest.fn(),
      exists: jest.fn(),
      invalidateUserCache: jest.fn(),
      generateUserKey: jest.fn((id: string) => `user:${id}`),
      generateUserAddressesKey: jest.fn((id: string) => `user:${id}:addresses`),
    },
  };
});

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockImplementation(() => Promise.resolve('https://presigned-url.example.com')),
}));

jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockImplementation(() => Promise.resolve(Buffer.from('processed-image'))),
  }));
});

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_S3_BUCKET = 'test-bucket';

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  jest.restoreAllMocks();
});
