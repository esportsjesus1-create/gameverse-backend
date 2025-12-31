import { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';
import { errorHandler, notFoundHandler, asyncHandler } from '../../src/middleware/errorHandler';
import { validate, validateBody, validateQuery, validateParams } from '../../src/middleware/validation';
import { AppError, NotFoundError, ValidationError, RateLimitError } from '../../src/utils/errors';

describe('Middleware', () => {
  describe('errorHandler', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
      jsonMock = jest.fn();
      statusMock = jest.fn().mockReturnValue({ json: jsonMock });
      mockReq = {
        headers: { 'x-request-id': 'test-request-id' },
        path: '/test',
        method: 'GET',
      };
      mockRes = {
        status: statusMock,
        setHeader: jest.fn(),
      };
      mockNext = jest.fn();
    });

    it('should handle AppError', () => {
      const error = new NotFoundError('Resource');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Resource not found',
          }),
        })
      );
    });

    it('should handle ValidationError with errors object', () => {
      const error = new ValidationError('Validation failed', { email: ['Invalid email'] });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(422);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            errors: { email: ['Invalid email'] },
          }),
        })
      );
    });

    it('should handle RateLimitError with retryAfter header', () => {
      const error = new RateLimitError('Too many requests', 120);

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', 120);
      expect(statusMock).toHaveBeenCalledWith(429);
    });

    it('should handle ZodError', () => {
      const schema = z.object({ name: z.string() });
      let zodError: ZodError;
      try {
        schema.parse({ name: 123 });
      } catch (e) {
        zodError = e as ZodError;
      }

      errorHandler(zodError!, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(422);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
          }),
        })
      );
    });

    it('should handle generic Error', () => {
      const error = new Error('Something went wrong');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
          }),
        })
      );
    });

    it('should include stack trace in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            stack: expect.any(String),
          }),
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should not include stack trace in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Test error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      const callArg = jsonMock.mock.calls[0][0];
      expect(callArg.error.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('notFoundHandler', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        path: '/unknown-path',
        method: 'GET',
      };
      mockRes = {};
      mockNext = jest.fn();
    });

    it('should call next with NotFoundError', () => {
      notFoundHandler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: expect.stringContaining('/unknown-path'),
        })
      );
    });
  });

  describe('asyncHandler', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {};
      mockRes = {
        json: jest.fn(),
      };
      mockNext = jest.fn();
    });

    it('should handle successful async function', async () => {
      const handler = asyncHandler(async (_req, res) => {
        res.json({ success: true });
      });

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch and forward errors', async () => {
      const error = new Error('Async error');
      const handler = asyncHandler(async () => {
        throw error;
      });

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('validation middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        body: {},
        query: {},
        params: {},
      };
      mockRes = {};
      mockNext = jest.fn();
    });

    describe('validate', () => {
      const testSchema = z.object({
        name: z.string().min(1),
        age: z.number().positive(),
      });

      it('should validate body and call next on success', () => {
        mockReq.body = { name: 'Test', age: 25 };

        const middleware = validate(testSchema, 'body');
        middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith();
        expect(mockReq.body).toEqual({ name: 'Test', age: 25 });
      });

      it('should call next with error on validation failure', () => {
        mockReq.body = { name: '', age: -5 };

        const middleware = validate(testSchema, 'body');
        middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    describe('validateBody', () => {
      const testSchema = z.object({
        email: z.string().email(),
      });

      it('should validate request body', () => {
        mockReq.body = { email: 'test@example.com' };

        const middleware = validateBody(testSchema);
        middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith();
      });

      it('should reject invalid body', () => {
        mockReq.body = { email: 'invalid-email' };

        const middleware = validateBody(testSchema);
        middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    describe('validateQuery', () => {
      const testSchema = z.object({
        page: z.coerce.number().positive().default(1),
        limit: z.coerce.number().positive().max(100).default(10),
      });

      it('should validate query parameters', () => {
        mockReq.query = { page: '2', limit: '20' };

        const middleware = validateQuery(testSchema);
        middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith();
        expect(mockReq.query).toEqual({ page: 2, limit: 20 });
      });

      it('should apply defaults for missing query params', () => {
        mockReq.query = {};

        const middleware = validateQuery(testSchema);
        middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith();
        expect(mockReq.query).toEqual({ page: 1, limit: 10 });
      });
    });

    describe('validateParams', () => {
      const testSchema = z.object({
        id: z.string().uuid(),
      });

      it('should validate route parameters', () => {
        mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

        const middleware = validateParams(testSchema);
        middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith();
      });

      it('should reject invalid params', () => {
        mockReq.params = { id: 'invalid-uuid' };

        const middleware = validateParams(testSchema);
        middleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });
});
