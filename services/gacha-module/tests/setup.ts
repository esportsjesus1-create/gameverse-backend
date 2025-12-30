import { DataSource } from 'typeorm';
import Redis from 'ioredis';

let testDataSource: DataSource | null = null;
let testRedis: Redis | null = null;

export const setupTestDatabase = async (): Promise<DataSource> => {
  if (testDataSource && testDataSource.isInitialized) {
    return testDataSource;
  }

  testDataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [__dirname + '/../src/models/*.ts'],
    synchronize: true,
    logging: false,
  });

  await testDataSource.initialize();
  return testDataSource;
};

export const getTestDataSource = (): DataSource => {
  if (!testDataSource) {
    throw new Error('Test database not initialized');
  }
  return testDataSource;
};

export const closeTestDatabase = async (): Promise<void> => {
  if (testDataSource && testDataSource.isInitialized) {
    await testDataSource.destroy();
    testDataSource = null;
  }
};

export const setupTestRedis = (): Redis => {
  if (testRedis) {
    return testRedis;
  }

  testRedis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    lazyConnect: true,
  });

  return testRedis;
};

export const getTestRedis = (): Redis => {
  if (!testRedis) {
    return setupTestRedis();
  }
  return testRedis;
};

export const closeTestRedis = async (): Promise<void> => {
  if (testRedis) {
    await testRedis.quit();
    testRedis = null;
  }
};

export const clearTestData = async (): Promise<void> => {
  if (testDataSource && testDataSource.isInitialized) {
    const entities = testDataSource.entityMetadatas;
    for (const entity of entities) {
      const repository = testDataSource.getRepository(entity.name);
      await repository.clear();
    }
  }

  if (testRedis) {
    await testRedis.flushall();
  }
};

beforeAll(async () => {
  jest.setTimeout(30000);
});

afterAll(async () => {
  await closeTestDatabase();
  await closeTestRedis();
});

jest.mock('../src/config/database', () => ({
  getDataSource: () => getTestDataSource(),
  initializeDatabase: () => setupTestDatabase(),
  AppDataSource: null,
}));

jest.mock('../src/config/redis', () => ({
  getRedisClient: () => getTestRedis(),
  initializeRedis: () => setupTestRedis(),
  closeRedis: () => closeTestRedis(),
  REDIS_KEYS: {
    playerPity: (playerId: string, bannerType: string) => `test:pity:${playerId}:${bannerType}`,
    playerPityBanner: (playerId: string, bannerId: string) => `test:pity:${playerId}:banner:${bannerId}`,
    banner: (bannerId: string) => `test:banner:${bannerId}`,
    activeBanners: () => 'test:banners:active',
    playerInventory: (playerId: string) => `test:inventory:${playerId}`,
    playerCurrency: (playerId: string, currencyType: string) => `test:currency:${playerId}:${currencyType}`,
    playerSpending: (playerId: string) => `test:spending:${playerId}`,
    dropRates: (bannerId: string) => `test:droprates:${bannerId}`,
    pullLock: (playerId: string) => `test:lock:pull:${playerId}`,
    currencyLock: (playerId: string) => `test:lock:currency:${playerId}`,
    rateLimitPull: (playerId: string) => `test:ratelimit:pull:${playerId}`,
    rateLimitCurrency: (playerId: string) => `test:ratelimit:currency:${playerId}`,
    statisticsDaily: (date: string) => `test:stats:daily:${date}`,
    statisticsBanner: (bannerId: string) => `test:stats:banner:${bannerId}`,
  },
  REDIS_TTL: {
    pity: 3600,
    banner: 300,
    activeBanners: 60,
    inventory: 120,
    currency: 60,
    spending: 300,
    dropRates: 3600,
    lock: 30,
    rateLimit: 60,
    statistics: 86400,
  },
}));
