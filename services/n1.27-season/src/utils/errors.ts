/**
 * Error codes for the Season Module.
 * These codes help identify specific error conditions for debugging and monitoring.
 */
export enum SeasonErrorCode {
  SEASON_NOT_FOUND = 'SEASON_NOT_FOUND',
  SEASON_ALREADY_EXISTS = 'SEASON_ALREADY_EXISTS',
  SEASON_ALREADY_ACTIVE = 'SEASON_ALREADY_ACTIVE',
  SEASON_NOT_ACTIVE = 'SEASON_NOT_ACTIVE',
  SEASON_INVALID_STATE = 'SEASON_INVALID_STATE',
  SEASON_INVALID_TRANSITION = 'SEASON_INVALID_TRANSITION',
  SEASON_OVERLAP = 'SEASON_OVERLAP',
  SEASON_VALIDATION_FAILED = 'SEASON_VALIDATION_FAILED',
  PLAYER_NOT_FOUND = 'PLAYER_NOT_FOUND',
  PLAYER_SEASON_NOT_FOUND = 'PLAYER_SEASON_NOT_FOUND',
  PLAYER_ALREADY_REGISTERED = 'PLAYER_ALREADY_REGISTERED',
  REWARD_NOT_FOUND = 'REWARD_NOT_FOUND',
  REWARD_ALREADY_CLAIMED = 'REWARD_ALREADY_CLAIMED',
  REWARD_EXPIRED = 'REWARD_EXPIRED',
  REWARD_DISTRIBUTION_FAILED = 'REWARD_DISTRIBUTION_FAILED',
  QUEST_NOT_FOUND = 'QUEST_NOT_FOUND',
  QUEST_ALREADY_COMPLETED = 'QUEST_ALREADY_COMPLETED',
  QUEST_PREREQUISITES_NOT_MET = 'QUEST_PREREQUISITES_NOT_MET',
  ACHIEVEMENT_NOT_FOUND = 'ACHIEVEMENT_NOT_FOUND',
  ACHIEVEMENT_ALREADY_UNLOCKED = 'ACHIEVEMENT_ALREADY_UNLOCKED',
  CHALLENGE_NOT_FOUND = 'CHALLENGE_NOT_FOUND',
  CHALLENGE_NOT_ACTIVE = 'CHALLENGE_NOT_ACTIVE',
  INVALID_MMR_UPDATE = 'INVALID_MMR_UPDATE',
  INVALID_TIER_TRANSITION = 'INVALID_TIER_TRANSITION',
  PLACEMENT_NOT_COMPLETE = 'PLACEMENT_NOT_COMPLETE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Base application error class with support for error codes, context, and operational status.
 * Operational errors are expected errors that can be handled gracefully.
 * Non-operational errors indicate programming bugs or system failures.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: SeasonErrorCode;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    statusCode: number,
    code: SeasonErrorCode = SeasonErrorCode.INTERNAL_ERROR,
    isOperational = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Converts the error to a JSON-serializable object for API responses.
   */
  public toJSON(): Record<string, unknown> {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      ...(this.context && { context: this.context }),
    };
  }
}

/**
 * Error thrown when a requested resource is not found.
 */
export class NotFoundError extends AppError {
  constructor(
    message = 'Resource not found',
    code: SeasonErrorCode = SeasonErrorCode.SEASON_NOT_FOUND,
    context?: Record<string, unknown>
  ) {
    super(message, 404, code, true, context);
  }
}

/**
 * Error thrown when the request is malformed or contains invalid data.
 */
export class BadRequestError extends AppError {
  constructor(
    message = 'Bad request',
    code: SeasonErrorCode = SeasonErrorCode.SEASON_VALIDATION_FAILED,
    context?: Record<string, unknown>
  ) {
    super(message, 400, code, true, context);
  }
}

/**
 * Error thrown when there is a conflict with the current state of a resource.
 */
export class ConflictError extends AppError {
  constructor(
    message = 'Resource conflict',
    code: SeasonErrorCode = SeasonErrorCode.SEASON_ALREADY_EXISTS,
    context?: Record<string, unknown>
  ) {
    super(message, 409, code, true, context);
  }
}

/**
 * Error thrown when an internal server error occurs.
 * These are non-operational errors that indicate system failures.
 */
export class InternalServerError extends AppError {
  constructor(
    message = 'Internal server error',
    code: SeasonErrorCode = SeasonErrorCode.INTERNAL_ERROR,
    context?: Record<string, unknown>
  ) {
    super(message, 500, code, false, context);
  }
}

/**
 * Error thrown when input validation fails.
 * Contains detailed field-level error information.
 */
export class ValidationError extends AppError {
  public readonly errors: Record<string, string[]>;

  constructor(
    message: string,
    errors: Record<string, string[]> = {},
    context?: Record<string, unknown>
  ) {
    super(message, 400, SeasonErrorCode.SEASON_VALIDATION_FAILED, true, context);
    this.errors = errors;
  }

  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      validationErrors: this.errors,
    };
  }
}

/**
 * Error thrown when the user is not authenticated.
 */
export class UnauthorizedError extends AppError {
  constructor(
    message = 'Authentication required',
    context?: Record<string, unknown>
  ) {
    super(message, 401, SeasonErrorCode.UNAUTHORIZED, true, context);
  }
}

/**
 * Error thrown when the user does not have permission to perform an action.
 */
export class ForbiddenError extends AppError {
  constructor(
    message = 'Access denied',
    context?: Record<string, unknown>
  ) {
    super(message, 403, SeasonErrorCode.FORBIDDEN, true, context);
  }
}

/**
 * Error thrown when rate limiting is exceeded.
 */
export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(
    message = 'Rate limit exceeded',
    retryAfter = 60,
    context?: Record<string, unknown>
  ) {
    super(message, 429, SeasonErrorCode.RATE_LIMIT_EXCEEDED, true, context);
    this.retryAfter = retryAfter;
  }

  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter,
    };
  }
}

/**
 * Error thrown when a season state transition is invalid.
 */
export class InvalidStateTransitionError extends AppError {
  public readonly currentState: string;
  public readonly targetState: string;
  public readonly allowedTransitions: string[];

  constructor(
    currentState: string,
    targetState: string,
    allowedTransitions: string[],
    context?: Record<string, unknown>
  ) {
    super(
      `Invalid state transition from ${currentState} to ${targetState}. Allowed: ${allowedTransitions.join(', ')}`,
      400,
      SeasonErrorCode.SEASON_INVALID_TRANSITION,
      true,
      context
    );
    this.currentState = currentState;
    this.targetState = targetState;
    this.allowedTransitions = allowedTransitions;
  }

  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      currentState: this.currentState,
      targetState: this.targetState,
      allowedTransitions: this.allowedTransitions,
    };
  }
}

/**
 * Error thrown when a database operation fails.
 */
export class DatabaseError extends AppError {
  public readonly operation: string;

  constructor(
    message: string,
    operation: string,
    context?: Record<string, unknown>
  ) {
    super(message, 500, SeasonErrorCode.DATABASE_ERROR, false, context);
    this.operation = operation;
  }
}

/**
 * Error thrown when a cache operation fails.
 */
export class CacheError extends AppError {
  public readonly operation: string;

  constructor(
    message: string,
    operation: string,
    context?: Record<string, unknown>
  ) {
    super(message, 500, SeasonErrorCode.CACHE_ERROR, true, context);
    this.operation = operation;
  }
}

/**
 * Error thrown when an external service call fails.
 */
export class ExternalServiceError extends AppError {
  public readonly serviceName: string;

  constructor(
    message: string,
    serviceName: string,
    context?: Record<string, unknown>
  ) {
    super(message, 502, SeasonErrorCode.EXTERNAL_SERVICE_ERROR, true, context);
    this.serviceName = serviceName;
  }
}

/**
 * Utility function to check if an error is an operational error.
 * Operational errors are expected and can be handled gracefully.
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Utility function to wrap unknown errors into AppError instances.
 */
export function wrapError(error: unknown, defaultMessage = 'An unexpected error occurred'): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof Error) {
    return new InternalServerError(error.message || defaultMessage);
  }
  return new InternalServerError(defaultMessage);
}
