import { logger } from './logger';
import { isRetryableError, TimeoutError } from './errors';

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  timeout?: number;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  timeout: 30000
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  operationName: string = 'operation'
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;
  let delay = opts.baseDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await withTimeout(operation(), opts.timeout, operationName);
      return result;
    } catch (error) {
      lastError = error as Error;

      if (attempt === opts.maxRetries) {
        logger.error(`${operationName} failed after ${opts.maxRetries + 1} attempts`, {
          error: lastError.message
        });
        throw lastError;
      }

      if (!isRetryableError(error)) {
        logger.warn(`${operationName} failed with non-retryable error`, {
          error: lastError.message
        });
        throw lastError;
      }

      logger.warn(`${operationName} attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
        error: lastError.message
      });

      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  throw lastError;
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeout: number | undefined,
  operationName: string
): Promise<T> {
  if (!timeout) {
    return promise;
  }

  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(operationName, timeout));
    }, timeout);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withCircuitBreaker<T>(
  operation: () => Promise<T>,
  circuitState: CircuitBreakerState,
  options: CircuitBreakerOptions
): Promise<T> {
  if (circuitState.state === 'open') {
    if (Date.now() - circuitState.lastFailure < options.resetTimeout) {
      throw new Error('Circuit breaker is open');
    }
    circuitState.state = 'half-open';
  }

  try {
    const result = await operation();
    if (circuitState.state === 'half-open') {
      circuitState.state = 'closed';
      circuitState.failures = 0;
    }
    return result;
  } catch (error) {
    circuitState.failures++;
    circuitState.lastFailure = Date.now();

    if (circuitState.failures >= options.failureThreshold) {
      circuitState.state = 'open';
    }

    throw error;
  }
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure: number;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
}

export function createCircuitBreakerState(): CircuitBreakerState {
  return {
    state: 'closed',
    failures: 0,
    lastFailure: 0
  };
}
