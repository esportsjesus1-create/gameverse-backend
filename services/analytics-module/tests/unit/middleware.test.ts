/**
 * GameVerse Analytics Module - Middleware Tests
 * Tests for rate limiting, RBAC, validation, and error handling
 */

import { Request, Response, NextFunction } from 'express';
import {
  rateLimiter,
  getRateLimitStatus,
  resetRateLimit,
  clearAllRateLimits,
} from '../../src/middleware/rateLimiter';
import {
  requirePermission,
  requireRole,
  getRolePermissions,
  AuthenticatedRequest,
} from '../../src/middleware/rbac';
import {
  validate,
  validateRequestId,
  sanitizeString,
  sanitizeObject,
} from '../../src/middleware/validation';
import {
  asyncHandler,
  notFoundHandler,
  errorHandler,
} from '../../src/middleware/errorHandler';
import { Permission, UserRole, UserTier } from '../../src/types';
import { AnalyticsError, AnalyticsErrorCode } from '../../src/utils/errors';
import { z } from 'zod';

const mockRequest = (overrides = {}): Partial<Request> => ({
  headers: {},
  body: {},
  query: {},
  params: {},
  path: '/test',
  method: 'GET',
  ip: '127.0.0.1',
  ...overrides,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = (): NextFunction => jest.fn();

describe('Rate Limiter Middleware', () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  describe('rateLimiter', () => {
    it('should allow requests within rate limit', () => {
      const middleware = rateLimiter();
      const req = mockRequest({
        user: { id: 'user-1', tier: UserTier.BASIC },
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(429);
    });

    it('should set rate limit headers', () => {
      const middleware = rateLimiter();
      const req = mockRequest({
        user: { id: 'user-2', tier: UserTier.BASIC },
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      middleware(req, res, next);

      // Implementation uses setHeader instead of set
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(String));
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
    });

    it('should skip rate limiting for specified paths', () => {
      const middleware = rateLimiter({ skipPaths: ['/health'] });
      const req = mockRequest({
        path: '/health',
        user: { id: 'user-3', tier: UserTier.BASIC },
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should use IP for anonymous users', () => {
      const middleware = rateLimiter();
      const req = mockRequest({
        ip: '192.168.1.1',
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return rate limit status for a user', () => {
      const middleware = rateLimiter();
      const req = mockRequest({
        user: { id: 'status-user', tier: UserTier.STANDARD },
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      middleware(req, res, next);

      const status = getRateLimitStatus('status-user', UserTier.STANDARD);

      expect(status).toBeDefined();
      expect(status?.current).toBeDefined();
      expect(status?.remaining).toBeDefined();
      expect(status?.limits).toBeDefined();
    });

    it('should return default status for unknown user', () => {
      const status = getRateLimitStatus('unknown-user', UserTier.BASIC);
      // Function returns a default status with zero counts for unknown users
      expect(status).toBeDefined();
      expect(status?.tier).toBe(UserTier.BASIC);
      expect(status?.current.minuteCount).toBe(0);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for a user', () => {
      const middleware = rateLimiter();
      const req = mockRequest({
        user: { id: 'reset-user', tier: UserTier.BASIC },
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      middleware(req, res, next);

      resetRateLimit('reset-user');

      const status = getRateLimitStatus('reset-user', UserTier.BASIC);
      // After reset, the status should have zero counts
      expect(status).toBeDefined();
      expect(status?.current.minuteCount).toBe(0);
    });
  });
});

describe('RBAC Middleware', () => {
  describe('requirePermission', () => {
    it('should allow access with required permission', () => {
      const middleware = requirePermission(Permission.METRICS_READ);
      const req = mockRequest({
        user: { id: 'user-1', role: UserRole.ADMIN, permissions: [] },
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access without required permission', () => {
      const middleware = requirePermission(Permission.ADMIN_CONFIG);
      const req = mockRequest({
        user: { id: 'user-1', role: UserRole.VIEWER, permissions: [] },
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      middleware(req, res, next);

      // Middleware sends response directly, doesn't call next with error
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access for unauthenticated users', () => {
      const middleware = requirePermission(Permission.METRICS_READ);
      const req = mockRequest() as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      middleware(req, res, next);

      // Middleware sends response directly, doesn't call next with error
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should allow access with required role', () => {
      const middleware = requireRole(UserRole.ADMIN);
      const req = mockRequest({
        user: { id: 'user-1', role: UserRole.ADMIN, permissions: [] },
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access without required role', () => {
      const middleware = requireRole(UserRole.ADMIN);
      const req = mockRequest({
        user: { id: 'user-1', role: UserRole.VIEWER, permissions: [] },
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      middleware(req, res, next);

      // Middleware sends response directly, doesn't call next with error
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getRolePermissions', () => {
    it('should get role permissions', () => {
      const adminPermissions = getRolePermissions(UserRole.ADMIN);
      const viewerPermissions = getRolePermissions(UserRole.VIEWER);

      expect(adminPermissions.length).toBeGreaterThan(viewerPermissions.length);
      expect(adminPermissions).toContain(Permission.ADMIN_CONFIG);
      expect(viewerPermissions).not.toContain(Permission.ADMIN_CONFIG);
    });
  });
});

describe('Validation Middleware', () => {
  describe('validate', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      value: z.number().positive(),
    });

    it('should pass validation for valid body', () => {
      const middleware = validate(testSchema, 'body');
      const req = mockRequest({
        body: { name: 'test', value: 10 },
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should fail validation for invalid body', () => {
      const middleware = validate(testSchema, 'body');
      const req = mockRequest({
        body: { name: '', value: -5 },
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      middleware(req, res, next);

      // Middleware sends response directly, doesn't call next with error
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validateRequestId', () => {
    it('should generate request ID if not provided', () => {
      const req = mockRequest() as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      validateRequestId(req, res, next);

      expect(req.requestId).toBeDefined();
      expect(req.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(next).toHaveBeenCalled();
    });

    it('should sanitize provided request ID', () => {
      const req = mockRequest({
        headers: { 'x-request-id': '<script>alert("xss")</script>' },
      }) as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      validateRequestId(req, res, next);

      // The sanitized ID is stored in req.requestId, not req.headers
      expect(req.requestId).not.toContain('<script>');
      expect(req.requestId).toContain('&lt;script&gt;');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('sanitizeString', () => {
    it('should remove null bytes', () => {
      const result = sanitizeString('test\x00string');
      expect(result).toBe('teststring');
    });

    it('should escape HTML entities', () => {
      const result = sanitizeString('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;');
    });

    it('should remove script injections', () => {
      const result = sanitizeString('javascript:alert("xss")');
      expect(result).not.toContain('javascript:');
    });

    it('should trim whitespace', () => {
      const result = sanitizeString('  test  ');
      expect(result).toBe('test');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize nested objects', () => {
      const obj = {
        name: '<script>alert("xss")</script>',
        nested: {
          value: 'javascript:alert("xss")',
        },
      };

      const result = sanitizeObject(obj) as { name: string; nested: { value: string } };

      expect(result.name).not.toContain('<script>');
      expect(result.nested.value).not.toContain('javascript:');
    });

    it('should sanitize arrays', () => {
      const obj = {
        items: ['<script>xss</script>', 'normal'],
      };

      const result = sanitizeObject(obj) as { items: string[] };

      expect(result.items[0]).not.toContain('<script>');
      expect(result.items[1]).toBe('normal');
    });

    it('should preserve non-string values', () => {
      const obj = {
        number: 42,
        boolean: true,
        nullValue: null,
      };

      const result = sanitizeObject(obj) as { number: number; boolean: boolean; nullValue: null };

      expect(result.number).toBe(42);
      expect(result.boolean).toBe(true);
      expect(result.nullValue).toBeNull();
    });
  });
});

describe('Error Handler Middleware', () => {
  describe('asyncHandler', () => {
    it('should pass successful async function result', async () => {
      const handler = asyncHandler(async (req, res) => {
        res.json({ success: true });
      });

      const req = mockRequest() as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should catch async errors and pass to next', async () => {
      const error = new Error('Async error');
      const handler = asyncHandler(async () => {
        throw error;
      });

      const req = mockRequest() as AuthenticatedRequest;
      const res = mockResponse() as Response;
      const next = mockNext();

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 response', () => {
      const req = mockRequest({
        method: 'GET',
        path: '/unknown',
      }) as Request;
      const res = mockResponse() as Response;

      notFoundHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });
  });

  describe('errorHandler', () => {
    it('should handle AnalyticsError', () => {
      const error = new AnalyticsError(
        AnalyticsErrorCode.METRICS_NOT_FOUND,
        'Metric not found'
      );
      const req = mockRequest({
        headers: { 'x-request-id': 'req-123' },
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: AnalyticsErrorCode.METRICS_NOT_FOUND,
          }),
        })
      );
    });

    it('should convert regular Error to AnalyticsError', () => {
      const error = new Error('Regular error');
      const req = mockRequest() as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });
  });
});
