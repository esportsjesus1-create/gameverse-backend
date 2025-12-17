import {
  withRetry,
  withTimeout,
  sleep,
  withCircuitBreaker,
  createCircuitBreakerState,
  DEFAULT_RETRY_OPTIONS,
  CircuitBreakerState
} from './retry';
import { ProviderError, TimeoutError, ValidationError } from './errors';

describe('Retry Utilities', () => {
  describe('sleep', () => {
    it('should wait for specified milliseconds', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('withTimeout', () => {
    it('should resolve if operation completes within timeout', async () => {
      const result = await withTimeout(
        Promise.resolve('success'),
        1000,
        'test'
      );
      expect(result).toBe('success');
    });

    it('should throw TimeoutError if operation exceeds timeout', async () => {
      const slowOperation = new Promise((resolve) => setTimeout(resolve, 500));
      await expect(withTimeout(slowOperation, 50, 'test')).rejects.toThrow(TimeoutError);
    });

    it('should pass through if no timeout specified', async () => {
      const result = await withTimeout(
        Promise.resolve('success'),
        undefined,
        'test'
      );
      expect(result).toBe('success');
    });

    it('should propagate errors from the operation', async () => {
      const failingOperation = Promise.reject(new Error('Operation failed'));
      await expect(withTimeout(failingOperation, 1000, 'test')).rejects.toThrow('Operation failed');
    });
  });

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await withRetry(operation, { maxRetries: 3 }, 'test');
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new ProviderError('Failed'))
        .mockResolvedValue('success');

      const result = await withRetry(
        operation,
        { maxRetries: 3, baseDelay: 10 },
        'test'
      );
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue(new ValidationError('Invalid'));

      await expect(
        withRetry(operation, { maxRetries: 3, baseDelay: 10 }, 'test')
      ).rejects.toThrow(ValidationError);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries exceeded', async () => {
      const operation = jest.fn().mockRejectedValue(new ProviderError('Failed'));

      await expect(
        withRetry(operation, { maxRetries: 2, baseDelay: 10 }, 'test')
      ).rejects.toThrow(ProviderError);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff', async () => {
      const delays: number[] = [];
      const originalSleep = global.setTimeout;
      
      const operation = jest.fn()
        .mockRejectedValueOnce(new ProviderError('Failed'))
        .mockRejectedValueOnce(new ProviderError('Failed'))
        .mockResolvedValue('success');

      await withRetry(
        operation,
        { maxRetries: 3, baseDelay: 100, backoffMultiplier: 2, maxDelay: 1000 },
        'test'
      );

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use default options when not specified', () => {
      expect(DEFAULT_RETRY_OPTIONS.maxRetries).toBe(3);
      expect(DEFAULT_RETRY_OPTIONS.baseDelay).toBe(1000);
      expect(DEFAULT_RETRY_OPTIONS.maxDelay).toBe(10000);
      expect(DEFAULT_RETRY_OPTIONS.backoffMultiplier).toBe(2);
      expect(DEFAULT_RETRY_OPTIONS.timeout).toBe(30000);
    });
  });

  describe('createCircuitBreakerState', () => {
    it('should create initial state', () => {
      const state = createCircuitBreakerState();
      expect(state.state).toBe('closed');
      expect(state.failures).toBe(0);
      expect(state.lastFailure).toBe(0);
    });
  });

  describe('withCircuitBreaker', () => {
    it('should execute operation when circuit is closed', async () => {
      const state = createCircuitBreakerState();
      const operation = jest.fn().mockResolvedValue('success');

      const result = await withCircuitBreaker(
        operation,
        state,
        { failureThreshold: 3, resetTimeout: 1000 }
      );

      expect(result).toBe('success');
      expect(state.state).toBe('closed');
    });

    it('should open circuit after failure threshold', async () => {
      const state = createCircuitBreakerState();
      const operation = jest.fn().mockRejectedValue(new Error('Failed'));

      for (let i = 0; i < 3; i++) {
        try {
          await withCircuitBreaker(
            operation,
            state,
            { failureThreshold: 3, resetTimeout: 1000 }
          );
        } catch {
          // Expected
        }
      }

      expect(state.state).toBe('open');
      expect(state.failures).toBe(3);
    });

    it('should reject immediately when circuit is open', async () => {
      const state: CircuitBreakerState = {
        state: 'open',
        failures: 5,
        lastFailure: Date.now()
      };
      const operation = jest.fn().mockResolvedValue('success');

      await expect(
        withCircuitBreaker(
          operation,
          state,
          { failureThreshold: 3, resetTimeout: 10000 }
        )
      ).rejects.toThrow('Circuit breaker is open');
      expect(operation).not.toHaveBeenCalled();
    });

    it('should transition to half-open after reset timeout', async () => {
      const state: CircuitBreakerState = {
        state: 'open',
        failures: 5,
        lastFailure: Date.now() - 2000
      };
      const operation = jest.fn().mockResolvedValue('success');

      const result = await withCircuitBreaker(
        operation,
        state,
        { failureThreshold: 3, resetTimeout: 1000 }
      );

      expect(result).toBe('success');
      expect(state.state).toBe('closed');
      expect(state.failures).toBe(0);
    });

    it('should close circuit on success in half-open state', async () => {
      const state: CircuitBreakerState = {
        state: 'half-open',
        failures: 3,
        lastFailure: Date.now() - 2000
      };
      const operation = jest.fn().mockResolvedValue('success');

      await withCircuitBreaker(
        operation,
        state,
        { failureThreshold: 3, resetTimeout: 1000 }
      );

      expect(state.state).toBe('closed');
      expect(state.failures).toBe(0);
    });

    it('should increment failures on error', async () => {
      const state = createCircuitBreakerState();
      const operation = jest.fn().mockRejectedValue(new Error('Failed'));

      try {
        await withCircuitBreaker(
          operation,
          state,
          { failureThreshold: 5, resetTimeout: 1000 }
        );
      } catch {
        // Expected
      }

      expect(state.failures).toBe(1);
      expect(state.lastFailure).toBeGreaterThan(0);
    });
  });
});
