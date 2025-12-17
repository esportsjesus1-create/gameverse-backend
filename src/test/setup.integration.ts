import { Pool } from 'pg';
import Redis from 'ioredis';

let pool: Pool | null = null;
let redis: Redis | null = null;

export async function setupTestDatabase(): Promise<Pool> {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/gameverse_test',
    });
  }
  return pool;
}

export async function setupTestRedis(): Promise<Redis> {
  if (!redis) {
    redis = new Redis(process.env.TEST_REDIS_URL || 'redis://localhost:6379/1', {
      lazyConnect: true,
    });
    await redis.connect();
  }
  return redis;
}

export async function cleanupTestDatabase(): Promise<void> {
  if (pool) {
    await pool.query('TRUNCATE users, blockchain_addresses, kyc_history CASCADE');
  }
}

export async function cleanupTestRedis(): Promise<void> {
  if (redis) {
    await redis.flushdb();
  }
}

export async function teardownTestDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function teardownTestRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_S3_BUCKET = 'test-bucket';

beforeAll(async () => {
  await setupTestDatabase();
  await setupTestRedis();
});

beforeEach(async () => {
  await cleanupTestDatabase();
  await cleanupTestRedis();
});

afterAll(async () => {
  await teardownTestDatabase();
  await teardownTestRedis();
});
