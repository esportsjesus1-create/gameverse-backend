import { Request, Response, NextFunction } from 'express';
import {
  rateLimit,
  rateLimiters,
  rateLimitStore,
  authenticate,
  authorize,
  authorizeOwnerOrAdmin,
  sanitizeInput,
  securityHeaders,
  requestId,
  AuthRole,
  Permissions,
  getPermissionsForRole,
  hasPermission,
  AuthenticatedRequest,
} from '../../src/middleware/security';
import { RateLimitError, UnauthorizedError, ForbiddenError } from '../../src/utils/errors';

describe('Security Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      headers: {},
      body: {},
      query: {},
      params: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as any,
    };
    mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      end: jest.fn().mockReturnThis(),
      statusCode: 200,
      on: jest.fn(),
    };
    mockNext = jest.fn();
    rateLimitStore.reset();
  });

  describe('rateLimit', () => {
    it('should allow requests under the limit', () => {
      const limiter = rateLimit({ windowMs: 60000, maxRequests: 10 });
      
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 9);
    });

    it('should block requests over the limit', () => {
      const limiter = rateLimit({ windowMs: 60000, maxRequests: 2 });
      
      limiter(mockReq as Request, mockRes as Response, mockNext);
      limiter(mockReq as Request, mockRes as Response, mockNext);
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(3);
      const lastCall = mockNext.mock.calls[2][0];
      expect(lastCall).toBeInstanceOf(RateLimitError);
    });

    it('should use custom key generator', () => {
      const keyGen = jest.fn().mockReturnValue('custom-key');
      const limiter = rateLimit({ windowMs: 60000, maxRequests: 10, keyGenerator: keyGen });
      
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(keyGen).toHaveBeenCalledWith(mockReq);
    });

    it('should use x-forwarded-for header when available', () => {
      mockReq.headers = { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' };
      const limiter = rateLimit({ windowMs: 60000, maxRequests: 10 });
      
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set Retry-After header when rate limited', () => {
      const limiter = rateLimit({ windowMs: 60000, maxRequests: 1 });
      
      limiter(mockReq as Request, mockRes as Response, mockNext);
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    });
  });

  describe('rateLimiters', () => {
    it('should have standard limiter configured', () => {
      expect(rateLimiters.standard).toBeDefined();
    });

    it('should have strict limiter configured', () => {
      expect(rateLimiters.strict).toBeDefined();
    });

    it('should have auth limiter configured', () => {
      expect(rateLimiters.auth).toBeDefined();
    });

    it('should have admin limiter configured', () => {
      expect(rateLimiters.admin).toBeDefined();
    });

    it('should have leaderboard limiter configured', () => {
      expect(rateLimiters.leaderboard).toBeDefined();
    });

    it('should have mmrUpdate limiter configured', () => {
      expect(rateLimiters.mmrUpdate).toBeDefined();
    });
  });

  describe('authenticate', () => {
    it('should pass with valid system API key', () => {
      mockReq.headers = { 'x-api-key': 'system_test_key' };
      const middleware = authenticate();
      
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as AuthenticatedRequest).auth?.role).toBe(AuthRole.SYSTEM);
    });

    it('should fail without authentication', () => {
      const middleware = authenticate();
      
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should pass with optional authentication when not provided', () => {
      const middleware = authenticate({ optional: true });
      
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should fail with invalid authorization header format', () => {
      mockReq.headers = { authorization: 'InvalidFormat' };
      const middleware = authenticate();
      
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should decode valid JWT token', () => {
      const payload = { sub: 'user123', role: 'admin' };
      const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.signature`;
      mockReq.headers = { authorization: `Bearer ${token}` };
      const middleware = authenticate();
      
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as AuthenticatedRequest).auth?.userId).toBe('user123');
    });

    it('should fail with invalid token', () => {
      mockReq.headers = { authorization: 'Bearer invalid.token' };
      const middleware = authenticate();
      
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });
  });

  describe('authorize', () => {
    it('should pass when user has required permission', () => {
      (mockReq as AuthenticatedRequest).auth = {
        userId: 'user123',
        role: AuthRole.ADMIN,
        permissions: [Permissions.SEASON_CREATE, Permissions.SEASON_VIEW],
      };
      const middleware = authorize(Permissions.SEASON_CREATE);
      
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should fail when user lacks required permission', () => {
      (mockReq as AuthenticatedRequest).auth = {
        userId: 'user123',
        role: AuthRole.PLAYER,
        permissions: [Permissions.SEASON_VIEW],
      };
      const middleware = authorize(Permissions.SEASON_CREATE);
      
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('should fail when not authenticated', () => {
      const middleware = authorize(Permissions.SEASON_VIEW);
      
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should require all permissions', () => {
      (mockReq as AuthenticatedRequest).auth = {
        userId: 'user123',
        role: AuthRole.ADMIN,
        permissions: [Permissions.SEASON_CREATE],
      };
      const middleware = authorize(Permissions.SEASON_CREATE, Permissions.SEASON_DELETE);
      
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });

  describe('authorizeOwnerOrAdmin', () => {
    it('should pass when user is owner', () => {
      (mockReq as AuthenticatedRequest).auth = {
        userId: 'user123',
        role: AuthRole.PLAYER,
        permissions: [Permissions.SEASON_VIEW],
      };
      mockReq.params = { playerId: 'user123' };
      const middleware = authorizeOwnerOrAdmin((req) => req.params?.playerId);
      
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should pass when user is admin', () => {
      (mockReq as AuthenticatedRequest).auth = {
        userId: 'admin456',
        role: AuthRole.ADMIN,
        permissions: [Permissions.ADMIN_ACCESS],
      };
      mockReq.params = { playerId: 'user123' };
      const middleware = authorizeOwnerOrAdmin((req) => req.params?.playerId);
      
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should fail when user is neither owner nor admin', () => {
      (mockReq as AuthenticatedRequest).auth = {
        userId: 'other789',
        role: AuthRole.PLAYER,
        permissions: [Permissions.SEASON_VIEW],
      };
      mockReq.params = { playerId: 'user123' };
      const middleware = authorizeOwnerOrAdmin((req) => req.params?.playerId);
      
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it('should fail when not authenticated', () => {
      mockReq.params = { playerId: 'user123' };
      const middleware = authorizeOwnerOrAdmin((req) => req.params?.playerId);
      
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize body strings', () => {
      mockReq.body = { name: '<script>alert("xss")</script>' };
      
      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.body.name).not.toContain('<script>');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize query strings', () => {
      mockReq.query = { search: 'test<img onerror=alert(1)>' };
      
      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.query.search).not.toContain('<img');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize nested objects', () => {
      mockReq.body = { user: { name: '<div onclick=evil()>test</div>' } };
      
      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.body.user.name).not.toContain('<div');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize arrays', () => {
      mockReq.body = { tags: ['<script>bad</script>', 'good'] };
      
      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.body.tags[0]).not.toContain('<script>');
      expect(mockReq.body.tags[1]).toBe('good');
    });

    it('should remove javascript: protocol', () => {
      mockReq.body = { url: 'javascript:alert(1)' };
      
      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.body.url).not.toContain('javascript:');
    });

    it('should preserve non-string values', () => {
      mockReq.body = { count: 42, active: true, data: null };
      
      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.body.count).toBe(42);
      expect(mockReq.body.active).toBe(true);
      expect(mockReq.body.data).toBeNull();
    });
  });

  describe('securityHeaders', () => {
    it('should set security headers', () => {
      securityHeaders(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requestId', () => {
    it('should use existing request ID', () => {
      mockReq.headers = { 'x-request-id': 'existing-id' };
      
      requestId(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', 'existing-id');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should generate new request ID if not provided', () => {
      requestId(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
      expect(mockReq.headers!['x-request-id']).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getPermissionsForRole', () => {
    it('should return player permissions', () => {
      const permissions = getPermissionsForRole(AuthRole.PLAYER);
      expect(permissions).toContain(Permissions.SEASON_VIEW);
      expect(permissions).toContain(Permissions.LEADERBOARD_VIEW);
      expect(permissions).not.toContain(Permissions.SEASON_CREATE);
    });

    it('should return admin permissions', () => {
      const permissions = getPermissionsForRole(AuthRole.ADMIN);
      expect(permissions).toContain(Permissions.SEASON_CREATE);
      expect(permissions).toContain(Permissions.ADMIN_ACCESS);
    });

    it('should return all permissions for super admin', () => {
      const permissions = getPermissionsForRole(AuthRole.SUPER_ADMIN);
      expect(permissions).toContain(Permissions.ADMIN_EMERGENCY);
      expect(permissions.length).toBe(Object.values(Permissions).length);
    });

    it('should return all permissions for system', () => {
      const permissions = getPermissionsForRole(AuthRole.SYSTEM);
      expect(permissions.length).toBe(Object.values(Permissions).length);
    });
  });

  describe('hasPermission', () => {
    it('should return true when role has permission', () => {
      expect(hasPermission(AuthRole.ADMIN, Permissions.SEASON_CREATE)).toBe(true);
    });

    it('should return false when role lacks permission', () => {
      expect(hasPermission(AuthRole.PLAYER, Permissions.SEASON_CREATE)).toBe(false);
    });
  });
});
