jest.mock('../src/config/database', () => ({
  AppDataSource: {
    isInitialized: false,
    initialize: jest.fn().mockResolvedValue(undefined as void),
    destroy: jest.fn().mockResolvedValue(undefined as void),
    getRepository: jest.fn().mockReturnValue({
      find: jest.fn(),
      findOne: jest.fn(),
      findByIds: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
        getManyAndCount: jest.fn(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
      }),
    }),
  },
  initializeDatabase: jest.fn().mockResolvedValue(undefined as void),
  closeDatabase: jest.fn().mockResolvedValue(undefined as void),
}));

jest.mock('../src/config/redis', () => {
  const mockRedis = {
    get: jest.fn().mockResolvedValue(null as string | null),
    set: jest.fn().mockResolvedValue('OK' as string),
    setex: jest.fn().mockResolvedValue('OK' as string),
    del: jest.fn().mockResolvedValue(1 as number),
    quit: jest.fn().mockResolvedValue('OK' as string),
    on: jest.fn(),
  };

  return {
    getRedisClient: jest.fn().mockReturnValue(mockRedis),
    closeRedis: jest.fn().mockResolvedValue(undefined as void),
    REDIS_KEYS: {
      playerPity: (playerId: string, bannerType: string) =>
        `gacha:pity:${playerId}:${bannerType}`,
      bannerConfig: (bannerId: string) => `gacha:banner:${bannerId}`,
      pullHistory: (playerId: string) => `gacha:history:${playerId}`,
      rateLimit: (playerId: string) => `gacha:ratelimit:${playerId}`,
    },
    REDIS_TTL: {
      pity: 60 * 60 * 24 * 30,
      banner: 60 * 60,
      history: 60 * 60 * 24 * 7,
      rateLimit: 60,
    },
  };
});

beforeAll(() => {
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  jest.clearAllMocks();
});
