import { config, validateConfig } from '../../src/config';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('config object', () => {
    it('should have default values', () => {
      expect(config.port).toBeDefined();
      expect(config.nodeEnv).toBeDefined();
      expect(config.jwt.secret).toBeDefined();
      expect(config.multiSignature.defaultApprovalThreshold).toBeDefined();
      expect(config.withdrawalLimits.defaultDailyLimit).toBeDefined();
    });

    it('should have database configuration', () => {
      expect(config.database.url).toBeDefined();
    });

    it('should have logging configuration', () => {
      expect(config.logging.level).toBeDefined();
    });
  });

  describe('validateConfig', () => {
    it('should not throw in non-production environment', () => {
      process.env.NODE_ENV = 'development';
      expect(() => validateConfig()).not.toThrow();
    });

    it('should validate required env vars in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'test-secret';
      
      // This should not throw because JWT_SECRET is set
      expect(() => validateConfig()).not.toThrow();
    });
  });
});
