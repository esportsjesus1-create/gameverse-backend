import { RedisClient } from './redis';

const mockIoRedis = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(-1),
  exists: jest.fn().mockResolvedValue(0),
  hget: jest.fn().mockResolvedValue(null),
  hset: jest.fn().mockResolvedValue(1),
  hgetall: jest.fn().mockResolvedValue({}),
  hdel: jest.fn().mockResolvedValue(1),
  lpush: jest.fn().mockResolvedValue(1),
  lrange: jest.fn().mockResolvedValue([]),
  ltrim: jest.fn().mockResolvedValue('OK'),
  eval: jest.fn().mockResolvedValue([1, 1, 60000]),
  ping: jest.fn().mockResolvedValue('PONG'),
  on: jest.fn(),
  status: 'ready'
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockIoRedis);
});

describe('RedisClient', () => {
  let redisClient: RedisClient;

  beforeEach(() => {
    jest.clearAllMocks();
    redisClient = new RedisClient();
  });

  afterEach(async () => {
    await redisClient.disconnect();
  });

  describe('connect', () => {
    it('should connect to Redis', async () => {
      await redisClient.connect();
    });

    it('should not connect twice', async () => {
      await redisClient.connect();
      await redisClient.connect();
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Redis', async () => {
      await redisClient.connect();
      await redisClient.disconnect();
    });
  });

  describe('get', () => {
    it('should get value from Redis', async () => {
      await redisClient.connect();
      mockIoRedis.get.mockResolvedValueOnce('test-value');
      
      const value = await redisClient.get('test-key');
      
      expect(value).toBe('test-value');
    });

    it('should return null for non-existent key', async () => {
      await redisClient.connect();
      mockIoRedis.get.mockResolvedValueOnce(null);
      
      const value = await redisClient.get('non-existent');
      
      expect(value).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value in Redis', async () => {
      await redisClient.connect();
      
      await redisClient.set('test-key', 'test-value');
      
      expect(mockIoRedis.set).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should set value with TTL', async () => {
      await redisClient.connect();
      
      await redisClient.set('test-key', 'test-value', 60);
      
      expect(mockIoRedis.set).toHaveBeenCalledWith('test-key', 'test-value', 'PX', 60);
    });
  });

  describe('del', () => {
    it('should delete key from Redis', async () => {
      await redisClient.connect();
      
      const result = await redisClient.del('test-key');
      
      expect(result).toBe(1);
    });
  });

  describe('incr', () => {
    it('should increment value', async () => {
      await redisClient.connect();
      mockIoRedis.incr.mockResolvedValueOnce(5);
      
      const result = await redisClient.incr('counter');
      
      expect(result).toBe(5);
    });
  });

  describe('expire', () => {
    it('should set expiration on key', async () => {
      await redisClient.connect();
      
      const result = await redisClient.expire('test-key', 60);
      
      expect(result).toBe(1);
    });
  });

  describe('ttl', () => {
    it('should get TTL of key', async () => {
      await redisClient.connect();
      mockIoRedis.ttl.mockResolvedValueOnce(30);
      
      const result = await redisClient.ttl('test-key');
      
      expect(result).toBe(30);
    });
  });

  describe('exists', () => {
    it('should check if key exists', async () => {
      await redisClient.connect();
      mockIoRedis.exists.mockResolvedValueOnce(1);
      
      const result = await redisClient.exists('test-key');
      
      expect(result).toBe(1);
    });
  });

  describe('hash operations', () => {
    it('should set hash field', async () => {
      await redisClient.connect();
      
      await redisClient.hset('hash-key', 'field', 'value');
      
      expect(mockIoRedis.hset).toHaveBeenCalledWith('hash-key', 'field', 'value');
    });

    it('should get hash field', async () => {
      await redisClient.connect();
      mockIoRedis.hget.mockResolvedValueOnce('value');
      
      const result = await redisClient.hget('hash-key', 'field');
      
      expect(result).toBe('value');
    });

    it('should get all hash fields', async () => {
      await redisClient.connect();
      mockIoRedis.hgetall.mockResolvedValueOnce({ field1: 'value1', field2: 'value2' });
      
      const result = await redisClient.hgetall('hash-key');
      
      expect(result).toEqual({ field1: 'value1', field2: 'value2' });
    });

    it('should delete hash field', async () => {
      await redisClient.connect();
      
      const result = await redisClient.hdel('hash-key', 'field');
      
      expect(result).toBe(1);
    });
  });

  describe('list operations', () => {
    it('should push to list', async () => {
      await redisClient.connect();
      mockIoRedis.lpush.mockResolvedValueOnce(3);
      
      const result = await redisClient.lpush('list-key', 'value');
      
      expect(result).toBe(3);
    });

    it('should get list range', async () => {
      await redisClient.connect();
      mockIoRedis.lrange.mockResolvedValueOnce(['a', 'b', 'c']);
      
      const result = await redisClient.lrange('list-key', 0, -1);
      
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should trim list', async () => {
      await redisClient.connect();
      
      await redisClient.ltrim('list-key', 0, 99);
      
      expect(mockIoRedis.ltrim).toHaveBeenCalledWith('list-key', 0, 99);
    });
  });

  describe('eval', () => {
    it('should execute Lua script', async () => {
      await redisClient.connect();
      mockIoRedis.eval.mockResolvedValueOnce([1, 99, 60000]);
      
      const result = await redisClient.eval('return 1', ['key'], []);
      
      expect(result).toEqual([1, 99, 60000]);
    });
  });

  describe('getClient', () => {
    it('should return underlying client', async () => {
      await redisClient.connect();
      
      const client = redisClient.getClient();
      
      expect(client).toBeDefined();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      await redisClient.connect();
      
      const health = await redisClient.healthCheck();
      
      expect(health.service).toBe('redis');
      expect(health.status).toBe('healthy');
    });

    it('should return unhealthy when not connected', async () => {
      const health = await redisClient.healthCheck();
      
      expect(health.status).toBe('unhealthy');
    });
  });
});
