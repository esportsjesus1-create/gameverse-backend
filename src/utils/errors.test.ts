import {
  GatewayError,
  ProviderError,
  RateLimitError,
  NonceError,
  ChainNotSupportedError,
  ConnectionError,
  TimeoutError,
  ValidationError,
  ReorgError,
  isRetryableError,
  formatError
} from './errors';

describe('Error Classes', () => {
  describe('GatewayError', () => {
    it('should create error with all properties', () => {
      const error = new GatewayError('Test error', 'TEST_CODE', 400, { key: 'value' });
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ key: 'value' });
      expect(error.name).toBe('GatewayError');
    });

    it('should use default status code', () => {
      const error = new GatewayError('Test error', 'TEST_CODE');
      expect(error.statusCode).toBe(500);
    });
  });

  describe('ProviderError', () => {
    it('should create provider error', () => {
      const error = new ProviderError('Provider failed', { endpoint: 'test' });
      expect(error.message).toBe('Provider failed');
      expect(error.code).toBe('PROVIDER_ERROR');
      expect(error.statusCode).toBe(502);
      expect(error.details).toEqual({ endpoint: 'test' });
      expect(error.name).toBe('ProviderError');
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with retry after', () => {
      const error = new RateLimitError('Too many requests', 60);
      expect(error.message).toBe('Too many requests');
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
      expect(error.name).toBe('RateLimitError');
    });
  });

  describe('NonceError', () => {
    it('should create nonce error', () => {
      const error = new NonceError('Nonce conflict', { address: '0x123' });
      expect(error.message).toBe('Nonce conflict');
      expect(error.code).toBe('NONCE_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ address: '0x123' });
      expect(error.name).toBe('NonceError');
    });
  });

  describe('ChainNotSupportedError', () => {
    it('should create chain not supported error', () => {
      const error = new ChainNotSupportedError(999);
      expect(error.message).toBe('Chain ID 999 is not supported');
      expect(error.code).toBe('CHAIN_NOT_SUPPORTED');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ chainId: 999 });
      expect(error.name).toBe('ChainNotSupportedError');
    });
  });

  describe('ConnectionError', () => {
    it('should create connection error', () => {
      const error = new ConnectionError('Redis', { host: 'localhost' });
      expect(error.message).toBe('Failed to connect to Redis');
      expect(error.code).toBe('CONNECTION_ERROR');
      expect(error.statusCode).toBe(503);
      expect(error.details).toEqual({ host: 'localhost' });
      expect(error.name).toBe('ConnectionError');
    });
  });

  describe('TimeoutError', () => {
    it('should create timeout error', () => {
      const error = new TimeoutError('eth_call', 30000);
      expect(error.message).toBe('Operation eth_call timed out after 30000ms');
      expect(error.code).toBe('TIMEOUT_ERROR');
      expect(error.statusCode).toBe(504);
      expect(error.details).toEqual({ operation: 'eth_call', timeout: 30000 });
      expect(error.name).toBe('TimeoutError');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError('Invalid address', { address: 'invalid' });
      expect(error.message).toBe('Invalid address');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ address: 'invalid' });
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('ReorgError', () => {
    it('should create reorg error', () => {
      const error = new ReorgError('Chain reorganization detected', { depth: 3 });
      expect(error.message).toBe('Chain reorganization detected');
      expect(error.code).toBe('REORG_DETECTED');
      expect(error.statusCode).toBe(409);
      expect(error.details).toEqual({ depth: 3 });
      expect(error.name).toBe('ReorgError');
    });
  });

  describe('isRetryableError', () => {
    it('should return true for ProviderError', () => {
      const error = new ProviderError('Provider failed');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for ConnectionError', () => {
      const error = new ConnectionError('Redis');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for TimeoutError', () => {
      const error = new TimeoutError('eth_call', 30000);
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for ValidationError', () => {
      const error = new ValidationError('Invalid');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for RateLimitError', () => {
      const error = new RateLimitError('Too many requests', 60);
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for non-GatewayError', () => {
      const error = new Error('Generic error');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isRetryableError('string')).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });

  describe('formatError', () => {
    it('should format GatewayError', () => {
      const error = new GatewayError('Test error', 'TEST_CODE', 400, { key: 'value' });
      const formatted = formatError(error);
      expect(formatted).toEqual({
        code: 'TEST_CODE',
        message: 'Test error',
        details: { key: 'value' }
      });
    });

    it('should format regular Error', () => {
      const error = new Error('Generic error');
      const formatted = formatError(error);
      expect(formatted).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'Generic error'
      });
    });

    it('should format non-error values', () => {
      const formatted = formatError('string error');
      expect(formatted).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'string error'
      });
    });
  });
});
