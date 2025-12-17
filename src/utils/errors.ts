export class GatewayError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ProviderError extends GatewayError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PROVIDER_ERROR', 502, details);
    this.name = 'ProviderError';
  }
}

export class RateLimitError extends GatewayError {
  public readonly retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, { retryAfter });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class NonceError extends GatewayError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'NONCE_ERROR', 400, details);
    this.name = 'NonceError';
  }
}

export class ChainNotSupportedError extends GatewayError {
  constructor(chainId: number) {
    super(`Chain ID ${chainId} is not supported`, 'CHAIN_NOT_SUPPORTED', 400, { chainId });
    this.name = 'ChainNotSupportedError';
  }
}

export class ConnectionError extends GatewayError {
  constructor(service: string, details?: Record<string, unknown>) {
    super(`Failed to connect to ${service}`, 'CONNECTION_ERROR', 503, details);
    this.name = 'ConnectionError';
  }
}

export class TimeoutError extends GatewayError {
  constructor(operation: string, timeout: number) {
    super(`Operation ${operation} timed out after ${timeout}ms`, 'TIMEOUT_ERROR', 504, {
      operation,
      timeout
    });
    this.name = 'TimeoutError';
  }
}

export class ValidationError extends GatewayError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class ReorgError extends GatewayError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'REORG_DETECTED', 409, details);
    this.name = 'ReorgError';
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof GatewayError) {
    return (
      error instanceof ProviderError ||
      error instanceof ConnectionError ||
      error instanceof TimeoutError
    );
  }
  return false;
}

export function formatError(error: unknown): { code: string; message: string; details?: unknown } {
  if (error instanceof GatewayError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details
    };
  }
  if (error instanceof Error) {
    return {
      code: 'INTERNAL_ERROR',
      message: error.message
    };
  }
  return {
    code: 'UNKNOWN_ERROR',
    message: String(error)
  };
}
