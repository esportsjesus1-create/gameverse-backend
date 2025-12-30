import { Pool } from 'pg';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const testDbConfig = {
  host: process.env.TEST_POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.TEST_POSTGRES_PORT || '5433', 10),
  database: process.env.TEST_POSTGRES_DB || 'gameverse_test',
  user: process.env.TEST_POSTGRES_USER || 'gameverse_test',
  password: process.env.TEST_POSTGRES_PASSWORD || 'gameverse_test_secret',
  max: 5,
};

const testRedisConfig = {
  host: process.env.TEST_REDIS_HOST || 'localhost',
  port: parseInt(process.env.TEST_REDIS_PORT || '6380', 10),
  db: parseInt(process.env.TEST_REDIS_DB || '1', 10),
  lazyConnect: true,
};

let testPool: Pool | null = null;
let testRedis: Redis | null = null;

export async function setupTestDatabase(): Promise<Pool> {
  if (!testPool) {
    testPool = new Pool(testDbConfig);
  }
  return testPool;
}

export async function setupTestRedis(): Promise<Redis> {
  if (!testRedis) {
    testRedis = new Redis(testRedisConfig);
    await testRedis.connect();
  }
  return testRedis;
}

export async function cleanupTestDatabase(): Promise<void> {
  if (testPool) {
    const client = await testPool.connect();
    try {
      await client.query(`
        DO $$ DECLARE
          r RECORD;
        BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'migrations') LOOP
            EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
        END $$;
      `);
    } finally {
      client.release();
    }
  }
}

export async function cleanupTestRedis(): Promise<void> {
  if (testRedis) {
    await testRedis.flushdb();
  }
}

export async function teardownTestDatabase(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

export async function teardownTestRedis(): Promise<void> {
  if (testRedis) {
    await testRedis.quit();
    testRedis = null;
  }
}

export function getTestPool(): Pool | null {
  return testPool;
}

export function getTestRedis(): Redis | null {
  return testRedis;
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  await teardownTestDatabase();
  await teardownTestRedis();
});

jest.setTimeout(30000);
