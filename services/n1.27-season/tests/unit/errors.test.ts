import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  InvalidStateTransitionError,
  DatabaseError,
  ExternalServiceError,
  SeasonErrorCode,
  isOperationalError,
  wrapError,
  createErrorFromCode,
} from '../../src/utils/errors';

describe('Error Utilities', () => {
  describe('AppError', () => {
    it('should create an AppError with all properties', () => {
      const error = new AppError(
        'Test error',
        400,
        SeasonErrorCode.SEASON_VALIDATION_FAILED,
        true,
        { field: 'name' }
      );

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(SeasonErrorCode.SEASON_VALIDATION_FAILED);
      expect(error.isOperational).toBe(true);
      expect(error.context).toEqual({ field: 'name' });
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should default to INTERNAL_ERROR code', () => {
      const error = new AppError('Test error', 500);
      expect(error.code).toBe(SeasonErrorCode.INTERNAL_ERROR);
    });

    it('should convert to JSON correctly', () => {
      const error = new AppError(
        'Test error',
        400,
        SeasonErrorCode.SEASON_NOT_FOUND,
        true,
        { seasonId: '123' }
      );

      const json = error.toJSON();
      expect(json.error).toBe('Test error');
      expect(json.code).toBe(SeasonErrorCode.SEASON_NOT_FOUND);
      expect(json.statusCode).toBe(400);
      expect(json.context).toEqual({ seasonId: '123' });
      expect(json.timestamp).toBeDefined();
    });

    it('should be an instance of Error', () => {
      const error = new AppError('Test', 500);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('NotFoundError', () => {
    it('should create a 404 error with correct code', () => {
      const error = new NotFoundError('Season not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(SeasonErrorCode.SEASON_NOT_FOUND);
      expect(error.isOperational).toBe(true);
    });

    it('should accept custom error code', () => {
      const error = new NotFoundError('Player not found', SeasonErrorCode.PLAYER_NOT_FOUND);
      expect(error.code).toBe(SeasonErrorCode.PLAYER_NOT_FOUND);
    });

    it('should accept context', () => {
      const error = new NotFoundError('Not found', SeasonErrorCode.SEASON_NOT_FOUND, { id: '123' });
      expect(error.context).toEqual({ id: '123' });
    });
  });

  describe('ValidationError', () => {
    it('should create a 400 error with validation errors', () => {
      const errors = { name: ['Name is required'], number: ['Must be positive'] };
      const error = new ValidationError('Validation failed', errors);

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(SeasonErrorCode.SEASON_VALIDATION_FAILED);
      expect(error.errors).toEqual(errors);
    });

    it('should be operational', () => {
      const error = new ValidationError('Invalid input', {});
      expect(error.isOperational).toBe(true);
    });
  });

  describe('UnauthorizedError', () => {
    it('should create a 401 error', () => {
      const error = new UnauthorizedError('Invalid token');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(SeasonErrorCode.UNAUTHORIZED);
    });
  });

  describe('ForbiddenError', () => {
    it('should create a 403 error', () => {
      const error = new ForbiddenError('Access denied');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(SeasonErrorCode.FORBIDDEN);
    });
  });

  describe('ConflictError', () => {
    it('should create a 409 error', () => {
      const error = new ConflictError('Season already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe(SeasonErrorCode.SEASON_ALREADY_EXISTS);
    });
  });

  describe('RateLimitError', () => {
    it('should create a 429 error with retry-after', () => {
      const error = new RateLimitError('Too many requests', 60);
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe(SeasonErrorCode.RATE_LIMIT_EXCEEDED);
      expect(error.retryAfter).toBe(60);
    });

    it('should default to 60 seconds retry-after', () => {
      const error = new RateLimitError('Rate limited');
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('InvalidStateTransitionError', () => {
    it('should create error with state transition details', () => {
      const error = new InvalidStateTransitionError(
        'DRAFT',
        'ENDED',
        ['SCHEDULED', 'ACTIVE']
      );

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(SeasonErrorCode.SEASON_INVALID_TRANSITION);
      expect(error.currentState).toBe('DRAFT');
      expect(error.targetState).toBe('ENDED');
      expect(error.allowedTransitions).toEqual(['SCHEDULED', 'ACTIVE']);
      expect(error.message).toContain('DRAFT');
      expect(error.message).toContain('ENDED');
    });
  });

  describe('DatabaseError', () => {
    it('should create a 500 error for database issues', () => {
      const error = new DatabaseError('Connection failed');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(SeasonErrorCode.DATABASE_ERROR);
      expect(error.isOperational).toBe(false);
    });
  });

  describe('ExternalServiceError', () => {
    it('should create a 502 error for external service issues', () => {
      const error = new ExternalServiceError('GamerStake API unavailable', 'gamerstake');
      expect(error.statusCode).toBe(502);
      expect(error.code).toBe(SeasonErrorCode.EXTERNAL_SERVICE_ERROR);
      expect(error.serviceName).toBe('gamerstake');
    });
  });

  describe('isOperationalError', () => {
    it('should return true for operational AppError', () => {
      const error = new AppError('Test', 400, SeasonErrorCode.SEASON_NOT_FOUND, true);
      expect(isOperationalError(error)).toBe(true);
    });

    it('should return false for non-operational AppError', () => {
      const error = new AppError('Test', 500, SeasonErrorCode.DATABASE_ERROR, false);
      expect(isOperationalError(error)).toBe(false);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Regular error');
      expect(isOperationalError(error)).toBe(false);
    });

    it('should return false for non-Error objects', () => {
      expect(isOperationalError('string error')).toBe(false);
      expect(isOperationalError(null)).toBe(false);
      expect(isOperationalError(undefined)).toBe(false);
    });
  });

  describe('wrapError', () => {
    it('should return AppError as-is', () => {
      const original = new NotFoundError('Not found');
      const wrapped = wrapError(original);
      expect(wrapped).toBe(original);
    });

    it('should wrap regular Error in AppError', () => {
      const original = new Error('Something went wrong');
      const wrapped = wrapError(original);

      expect(wrapped).toBeInstanceOf(AppError);
      expect(wrapped.message).toBe('Something went wrong');
      expect(wrapped.statusCode).toBe(500);
      expect(wrapped.isOperational).toBe(false);
    });

    it('should wrap string in AppError', () => {
      const wrapped = wrapError('String error');
      expect(wrapped).toBeInstanceOf(AppError);
      expect(wrapped.message).toBe('String error');
    });

    it('should handle unknown error types', () => {
      const wrapped = wrapError({ custom: 'error' });
      expect(wrapped).toBeInstanceOf(AppError);
      expect(wrapped.message).toBe('An unexpected error occurred');
    });
  });

  describe('createErrorFromCode', () => {
    it('should create NotFoundError for SEASON_NOT_FOUND', () => {
      const error = createErrorFromCode(SeasonErrorCode.SEASON_NOT_FOUND, 'Season not found');
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.statusCode).toBe(404);
    });

    it('should create NotFoundError for PLAYER_NOT_FOUND', () => {
      const error = createErrorFromCode(SeasonErrorCode.PLAYER_NOT_FOUND, 'Player not found');
      expect(error).toBeInstanceOf(NotFoundError);
    });

    it('should create ConflictError for SEASON_ALREADY_EXISTS', () => {
      const error = createErrorFromCode(SeasonErrorCode.SEASON_ALREADY_EXISTS, 'Already exists');
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.statusCode).toBe(409);
    });

    it('should create RateLimitError for RATE_LIMIT_EXCEEDED', () => {
      const error = createErrorFromCode(SeasonErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limited');
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.statusCode).toBe(429);
    });

    it('should create UnauthorizedError for UNAUTHORIZED', () => {
      const error = createErrorFromCode(SeasonErrorCode.UNAUTHORIZED, 'Unauthorized');
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.statusCode).toBe(401);
    });

    it('should create ForbiddenError for FORBIDDEN', () => {
      const error = createErrorFromCode(SeasonErrorCode.FORBIDDEN, 'Forbidden');
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.statusCode).toBe(403);
    });

    it('should create DatabaseError for DATABASE_ERROR', () => {
      const error = createErrorFromCode(SeasonErrorCode.DATABASE_ERROR, 'DB error');
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.statusCode).toBe(500);
    });

    it('should create generic AppError for unknown codes', () => {
      const error = createErrorFromCode(SeasonErrorCode.INTERNAL_ERROR, 'Internal error');
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(500);
    });
  });
});
