import Redis from 'ioredis';

jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    exists: jest.fn(),
    ping: jest.fn(),
    quit: jest.fn(),
    connect: jest.fn(),
    status: 'wait',
    on: jest.fn(),
  };
  return jest.fn(() => mockRedis);
});

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Redis Config', () => {
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockRedis = new Redis() as jest.Mocked<Redis>;
  });

  describe('getRedisClient', () => {
    it('should create client on first call', async () => {
      const { getRedisClient } = await import('../../config/redis');
      const client = getRedisClient();
      expect(client).toBeDefined();
    });

    it('should return same client on subsequent calls', async () => {
      const { getRedisClient } = await import('../../config/redis');
      const client1 = getRedisClient();
      const client2 = getRedisClient();
      expect(client1).toBe(client2);
    });
  });

  describe('connectRedis', () => {
    it('should connect when status is wait', async () => {
      const { connectRedis, getRedisClient } = await import('../../config/redis');
      const client = getRedisClient();
      (client as unknown as { status: string }).status = 'wait';
      (client.connect as jest.Mock).mockResolvedValue(undefined);

      await connectRedis();

      expect(client.connect).toHaveBeenCalled();
    });
  });

  describe('closeRedis', () => {
    it('should close connection', async () => {
      const { closeRedis, getRedisClient } = await import('../../config/redis');
      const client = getRedisClient();
      (client.quit as jest.Mock).mockResolvedValue('OK');

      await closeRedis();

      expect(client.quit).toHaveBeenCalled();
    });
  });

  describe('redisHealthCheck', () => {
    it('should return true when healthy', async () => {
      const { redisHealthCheck, getRedisClient } = await import('../../config/redis');
      const client = getRedisClient();
      (client.ping as jest.Mock).mockResolvedValue('PONG');

      const result = await redisHealthCheck();

      expect(result).toBe(true);
    });

    it('should return false when unhealthy', async () => {
      const { redisHealthCheck, getRedisClient } = await import('../../config/redis');
      const client = getRedisClient();
      (client.ping as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const result = await redisHealthCheck();

      expect(result).toBe(false);
    });
  });

  describe('CacheService', () => {
    it('should get cached value', async () => {
      const { CacheService, getRedisClient } = await import('../../config/redis');
      const client = getRedisClient();
      (client.get as jest.Mock).mockResolvedValue(JSON.stringify({ id: '1' }));

      const cache = new CacheService(client, 3600);
      const result = await cache.get<{ id: string }>('test-key');

      expect(result).toEqual({ id: '1' });
    });

    it('should return null for missing key', async () => {
      const { CacheService, getRedisClient } = await import('../../config/redis');
      const client = getRedisClient();
      (client.get as jest.Mock).mockResolvedValue(null);

      const cache = new CacheService(client, 3600);
      const result = await cache.get('test-key');

      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      const { CacheService, getRedisClient } = await import('../../config/redis');
      const client = getRedisClient();
      (client.get as jest.Mock).mockResolvedValue('invalid-json');

      const cache = new CacheService(client, 3600);
      const result = await cache.get('test-key');

      expect(result).toBeNull();
    });

    it('should set value with TTL', async () => {
      const { CacheService, getRedisClient } = await import('../../config/redis');
      const client = getRedisClient();
      (client.setex as jest.Mock).mockResolvedValue('OK');

      const cache = new CacheService(client, 3600);
      await cache.set('test-key', { id: '1' });

      expect(client.setex).toHaveBeenCalledWith('test-key', 3600, JSON.stringify({ id: '1' }));
    });

    it('should set value with custom TTL', async () => {
      const { CacheService, getRedisClient } = await import('../../config/redis');
      const client = getRedisClient();
      (client.setex as jest.Mock).mockResolvedValue('OK');

      const cache = new CacheService(client, 3600);
      await cache.set('test-key', { id: '1' }, 7200);

      expect(client.setex).toHaveBeenCalledWith('test-key', 7200, JSON.stringify({ id: '1' }));
    });

    it('should delete key', async () => {
      const { CacheService, getRedisClient } = await import('../../config/redis');
      const client = getRedisClient();
      (client.del as jest.Mock).mockResolvedValue(1);

      const cache = new CacheService(client, 3600);
      await cache.delete('test-key');

      expect(client.del).toHaveBeenCalledWith('test-key');
    });

    it('should delete pattern', async () => {
      const { CacheService, getRedisClient } = await import('../../config/redis');
      const client = getRedisClient();
      (client.keys as jest.Mock).mockResolvedValue(['key1', 'key2']);
      (client.del as jest.Mock).mockResolvedValue(2);

      const cache = new CacheService(client, 3600);
      await cache.deletePattern('test:*');

      expect(client.keys).toHaveBeenCalledWith('test:*');
      expect(client.del).toHaveBeenCalledWith('key1', 'key2');
    });

    it('should not delete if no keys match pattern', async () => {
      const { CacheService, getRedisClient } = await import('../../config/redis');
      const client = getRedisClient();
      (client.keys as jest.Mock).mockResolvedValue([]);

      const cache = new CacheService(client, 3600);
      await cache.deletePattern('test:*');

      expect(client.del).not.toHaveBeenCalled();
    });

    it('should check if key exists', async () => {
      const { CacheService, getRedisClient } = await import('../../config/redis');
      const client = getRedisClient();
      (client.exists as jest.Mock).mockResolvedValue(1);

      const cache = new CacheService(client, 3600);
      const result = await cache.exists('test-key');

      expect(result).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      const { CacheService, getRedisClient } = await import('../../config/redis');
      const client = getRedisClient();
      (client.exists as jest.Mock).mockResolvedValue(0);

      const cache = new CacheService(client, 3600);
      const result = await cache.exists('test-key');

      expect(result).toBe(false);
    });

    it('should invalidate user cache', async () => {
      const { CacheService, getRedisClient } = await import('../../config/redis');
      const client = getRedisClient();
      (client.keys as jest.Mock).mockResolvedValue(['user:123:addresses']);
      (client.del as jest.Mock).mockResolvedValue(1);

      const cache = new CacheService(client, 3600);
      await cache.invalidateUserCache('123');

      expect(client.keys).toHaveBeenCalledWith('user:123:*');
      expect(client.del).toHaveBeenCalled();
    });

    it('should generate user key', async () => {
      const { CacheService, getRedisClient } = await import('../../config/redis');
      const client = getRedisClient();

      const cache = new CacheService(client, 3600);
      const key = cache.generateUserKey('123');

      expect(key).toBe('user:123');
    });

    it('should generate user addresses key', async () => {
      const { CacheService, getRedisClient } = await import('../../config/redis');
      const client = getRedisClient();

      const cache = new CacheService(client, 3600);
      const key = cache.generateUserAddressesKey('123');

      expect(key).toBe('user:123:addresses');
    });
  });
});
