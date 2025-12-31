import { ThreeTierRateLimiter } from '../../../src/common/security/rate-limiter';
import { PlatformLogger, LogLevel } from '../../../src/common/logging';
import { RateLimitError } from '../../../src/common/errors';

describe('ThreeTierRateLimiter', () => {
  let rateLimiter: ThreeTierRateLimiter;
  let logger: PlatformLogger;

  beforeEach(() => {
    logger = new PlatformLogger({
      serviceName: 'test-service',
      level: LogLevel.ERROR,
    });

    rateLimiter = new ThreeTierRateLimiter(
      {
        global: { maxRequests: 100, windowMs: 60000 },
        service: { maxRequests: 50, windowMs: 60000 },
        user: { maxRequests: 10, windowMs: 60000 },
      },
      logger
    );
  });

  afterEach(() => {
    rateLimiter.reset();
  });

  describe('check', () => {
    it('should allow requests within global limit', () => {
      const result = rateLimiter.check('platform');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });

    it('should allow requests within service limit', () => {
      const result = rateLimiter.check('platform', 'email');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(49);
    });

    it('should allow requests within user limit', () => {
      const result = rateLimiter.check('platform', 'email', 'user-123');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should block requests exceeding global limit', () => {
      for (let i = 0; i < 100; i++) {
        rateLimiter.check('platform');
      }
      const result = rateLimiter.check('platform');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should block requests exceeding service limit', () => {
      for (let i = 0; i < 50; i++) {
        rateLimiter.check('platform', 'email');
      }
      const result = rateLimiter.check('platform', 'email');
      expect(result.allowed).toBe(false);
    });

    it('should block requests exceeding user limit', () => {
      for (let i = 0; i < 10; i++) {
        rateLimiter.check('platform', 'email', 'user-123');
      }
      const result = rateLimiter.check('platform', 'email', 'user-123');
      expect(result.allowed).toBe(false);
    });

    it('should track different users separately', () => {
      for (let i = 0; i < 10; i++) {
        rateLimiter.check('platform', 'email', 'user-1');
      }
      const result1 = rateLimiter.check('platform', 'email', 'user-1');
      const result2 = rateLimiter.check('platform', 'email', 'user-2');

      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(true);
    });

    it('should track different services separately', () => {
      for (let i = 0; i < 50; i++) {
        rateLimiter.check('platform', 'email');
      }
      const result1 = rateLimiter.check('platform', 'email');
      const result2 = rateLimiter.check('platform', 'sms');

      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(true);
    });

    it('should return retry-after when rate limited', () => {
      for (let i = 0; i < 10; i++) {
        rateLimiter.check('platform', 'email', 'user-123');
      }
      const result = rateLimiter.check('platform', 'email', 'user-123');
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('checkOrThrow', () => {
    it('should not throw when within limits', () => {
      expect(() => {
        rateLimiter.checkOrThrow('platform', 'email', 'user-123');
      }).not.toThrow();
    });

    it('should throw RateLimitError when exceeding limits', () => {
      for (let i = 0; i < 10; i++) {
        rateLimiter.check('platform', 'email', 'user-123');
      }
      expect(() => {
        rateLimiter.checkOrThrow('platform', 'email', 'user-123');
      }).toThrow(RateLimitError);
    });
  });

  describe('checkAll', () => {
    it('should check all tiers and return combined result', () => {
      const result = rateLimiter.checkAll('platform', 'email', 'user-123');
      expect(result.allowed).toBe(true);
      expect(result.global).toBeDefined();
      expect(result.service).toBeDefined();
      expect(result.user).toBeDefined();
    });

    it('should block if any tier is exceeded', () => {
      for (let i = 0; i < 10; i++) {
        rateLimiter.check('platform', 'email', 'user-123');
      }
      const result = rateLimiter.checkAll('platform', 'email', 'user-123');
      expect(result.allowed).toBe(false);
    });
  });

  describe('checkAllOrThrow', () => {
    it('should not throw when all tiers are within limits', () => {
      expect(() => {
        rateLimiter.checkAllOrThrow('platform', 'email', 'user-123');
      }).not.toThrow();
    });

    it('should throw when any tier is exceeded', () => {
      for (let i = 0; i < 10; i++) {
        rateLimiter.check('platform', 'email', 'user-123');
      }
      expect(() => {
        rateLimiter.checkAllOrThrow('platform', 'email', 'user-123');
      }).toThrow(RateLimitError);
    });
  });

  describe('reset', () => {
    it('should reset all rate limit counters', () => {
      for (let i = 0; i < 10; i++) {
        rateLimiter.check('platform', 'email', 'user-123');
      }
      const beforeReset = rateLimiter.check('platform', 'email', 'user-123');
      expect(beforeReset.allowed).toBe(false);

      rateLimiter.reset();

      const afterReset = rateLimiter.check('platform', 'email', 'user-123');
      expect(afterReset.allowed).toBe(true);
    });

    it('should reset specific tier', () => {
      for (let i = 0; i < 10; i++) {
        rateLimiter.check('platform', 'email', 'user-123');
      }
      rateLimiter.reset('user');

      const result = rateLimiter.check('platform', 'email', 'user-123');
      expect(result.allowed).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return current rate limit status', () => {
      rateLimiter.check('platform', 'email', 'user-123');
      rateLimiter.check('platform', 'email', 'user-123');

      const status = rateLimiter.getStatus('platform', 'email', 'user-123');
      expect(status.global).toBeDefined();
      expect(status.service).toBeDefined();
      expect(status.user).toBeDefined();
    });
  });

  describe('updateConfig', () => {
    it('should update rate limit configuration', () => {
      rateLimiter.updateConfig({
        user: { maxRequests: 5, windowMs: 60000 },
      });

      for (let i = 0; i < 5; i++) {
        rateLimiter.check('platform', 'email', 'user-123');
      }
      const result = rateLimiter.check('platform', 'email', 'user-123');
      expect(result.allowed).toBe(false);
    });
  });
});
