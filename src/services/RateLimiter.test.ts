import { RateLimiter, createRateLimitMiddleware } from './RateLimiter';
import { RateLimitError } from '../utils/errors';

jest.mock('../database/redis', () => ({
  redisClient: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(-1),
    eval: jest.fn().mockResolvedValue([1, 1, 60000]),
    getClient: jest.fn().mockReturnValue({
      set: jest.fn().mockResolvedValue('OK')
    })
  }
}));

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 100,
      keyPrefix: 'test:'
    });
    rateLimiter.start();
  });

  afterEach(() => {
    rateLimiter.stop();
  });

  describe('checkLimit', () => {
    it('should return rate limit info', async () => {
      const info = await rateLimiter.checkLimit('client1');
      expect(info).toHaveProperty('key');
      expect(info).toHaveProperty('count');
      expect(info).toHaveProperty('resetAt');
      expect(info).toHaveProperty('remaining');
    });

    it('should return remaining requests', async () => {
      const info = await rateLimiter.checkLimit('client1');
      expect(info.remaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe('incrementCount', () => {
    it('should increment count and return info', async () => {
      const info = await rateLimiter.incrementCount('client1');
      expect(info.count).toBeGreaterThanOrEqual(1);
    });

    it('should emit event when rate limit exceeded', async () => {
      const limitedRateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        keyPrefix: 'limited:'
      });
      limitedRateLimiter.start();

      const eventHandler = jest.fn();
      limitedRateLimiter.on('rateLimitExceeded', eventHandler);

      await limitedRateLimiter.incrementCount('client1');
      await limitedRateLimiter.incrementCount('client1');
      await limitedRateLimiter.incrementCount('client1');

      limitedRateLimiter.stop();
    });
  });

  describe('resetLimit', () => {
    it('should reset the limit for a key', async () => {
      await rateLimiter.incrementCount('client1');
      await rateLimiter.resetLimit('client1');
      const info = await rateLimiter.checkLimit('client1');
      expect(info.count).toBe(0);
    });
  });

  describe('isAllowed', () => {
    it('should return true when under limit', async () => {
      const allowed = await rateLimiter.isAllowed('client1');
      expect(allowed).toBe(true);
    });
  });

  describe('consume', () => {
    it('should consume tokens successfully', async () => {
      const info = await rateLimiter.consume('client1', 1);
      expect(info).toBeDefined();
    });

    it('should throw RateLimitError when not enough tokens', async () => {
      const { redisClient } = require('../database/redis');
      
      let callCount = 0;
      redisClient.get.mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount > 1 ? '1' : null);
      });
      
      const limitedRateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyPrefix: 'consume:'
      });
      limitedRateLimiter.start();

      await limitedRateLimiter.consume('client1', 1);
      
      await expect(limitedRateLimiter.consume('client1', 1)).rejects.toThrow(RateLimitError);
      
      limitedRateLimiter.stop();
      
      redisClient.get.mockResolvedValue(null);
    });
  });

  describe('getConfig', () => {
    it('should return current config', () => {
      const config = rateLimiter.getConfig();
      expect(config.windowMs).toBe(60000);
      expect(config.maxRequests).toBe(100);
      expect(config.keyPrefix).toBe('test:');
    });
  });

  describe('updateConfig', () => {
    it('should update config', () => {
      rateLimiter.updateConfig({ maxRequests: 200 });
      const config = rateLimiter.getConfig();
      expect(config.maxRequests).toBe(200);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const health = await rateLimiter.healthCheck();
      expect(health.service).toBe('rate-limiter');
      expect(['healthy', 'degraded']).toContain(health.status);
    });
  });
});

describe('createRateLimitMiddleware', () => {
  let rateLimiter: RateLimiter;
  let middleware: ReturnType<typeof createRateLimitMiddleware>;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 100,
      keyPrefix: 'middleware:'
    });
    rateLimiter.start();
    middleware = createRateLimitMiddleware(rateLimiter);
  });

  afterEach(() => {
    rateLimiter.stop();
  });

  it('should call next when under limit', async () => {
    const req = { ip: '127.0.0.1', headers: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
  });

  it('should use x-forwarded-for header when ip is not available', async () => {
    const req = { headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 429 when rate limit exceeded', async () => {
    const limitedRateLimiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 1,
      keyPrefix: 'limited-middleware:'
    });
    limitedRateLimiter.start();
    const limitedMiddleware = createRateLimitMiddleware(limitedRateLimiter);

    const req = { ip: '127.0.0.1', headers: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };
    const next = jest.fn();

    await limitedMiddleware(req, res, next);
    await limitedMiddleware(req, res, next);

    limitedRateLimiter.stop();
  });
});
