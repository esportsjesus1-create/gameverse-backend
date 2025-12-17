import { StatusCodes } from 'http-status-codes';
import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  isAppError,
  formatZodError
} from '../../src/utils/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with default values', () => {
      const error = new AppError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create error with custom values', () => {
      const error = new AppError('Custom error', StatusCodes.BAD_REQUEST, 'CUSTOM_CODE', false);

      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.isOperational).toBe(false);
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with resource name', () => {
      const error = new NotFoundError('User');

      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should create not found error with resource name and id', () => {
      const error = new NotFoundError('User', '123');

      expect(error.message).toBe("User with id '123' not found");
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with errors object', () => {
      const errors = { email: ['Invalid email format'] };
      const error = new ValidationError('Validation failed', errors);

      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.errors).toEqual(errors);
    });
  });

  describe('UnauthorizedError', () => {
    it('should create unauthorized error with default message', () => {
      const error = new UnauthorizedError();

      expect(error.message).toBe('Unauthorized');
      expect(error.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    it('should create unauthorized error with custom message', () => {
      const error = new UnauthorizedError('Invalid token');

      expect(error.message).toBe('Invalid token');
    });
  });

  describe('ForbiddenError', () => {
    it('should create forbidden error', () => {
      const error = new ForbiddenError();

      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error', () => {
      const error = new ConflictError('Resource already exists');

      expect(error.message).toBe('Resource already exists');
      expect(error.statusCode).toBe(StatusCodes.CONFLICT);
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error', () => {
      const error = new RateLimitError();

      expect(error.message).toBe('Too many requests');
      expect(error.statusCode).toBe(StatusCodes.TOO_MANY_REQUESTS);
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      expect(isAppError(new AppError('test'))).toBe(true);
      expect(isAppError(new NotFoundError('test'))).toBe(true);
      expect(isAppError(new ValidationError('test'))).toBe(true);
    });

    it('should return false for non-AppError instances', () => {
      expect(isAppError(new Error('test'))).toBe(false);
      expect(isAppError('string')).toBe(false);
      expect(isAppError(null)).toBe(false);
    });
  });

  describe('formatZodError', () => {
    it('should format zod error issues', () => {
      const zodError = {
        issues: [
          { path: ['email'], message: 'Invalid email' },
          { path: ['name'], message: 'Required' },
          { path: ['email'], message: 'Too short' }
        ]
      };

      const result = formatZodError(zodError);

      expect(result).toEqual({
        email: ['Invalid email', 'Too short'],
        name: ['Required']
      });
    });

    it('should handle nested paths', () => {
      const zodError = {
        issues: [
          { path: ['user', 'profile', 'name'], message: 'Required' }
        ]
      };

      const result = formatZodError(zodError);

      expect(result).toEqual({
        'user.profile.name': ['Required']
      });
    });
  });
});
