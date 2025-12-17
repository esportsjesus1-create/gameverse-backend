import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  authenticate,
  optionalAuth,
  requireRole,
  requireSameUser,
  generateToken,
  decodeToken,
  JwtPayload,
} from '../../middleware/auth.middleware';
import { config } from '../../config';

jest.mock('../../config', () => ({
  config: {
    jwt: {
      secret: 'test-secret',
      expiresIn: '1h',
    },
  },
}));

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  const validPayload: JwtPayload = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    role: 'user',
  };

  beforeEach(() => {
    mockReq = {
      headers: {},
      params: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('authenticate', () => {
    it('should authenticate valid token', () => {
      const token = jwt.sign(validPayload, config.jwt.secret);
      mockReq.headers = { authorization: `Bearer ${token}` };

      authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual(expect.objectContaining(validPayload));
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject missing authorization header', () => {
      authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('No authorization header');
    });

    it('should reject invalid authorization format', () => {
      mockReq.headers = { authorization: 'InvalidFormat token' };

      authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('Invalid authorization format');
    });

    it('should reject expired token', () => {
      const token = jwt.sign(validPayload, config.jwt.secret, { expiresIn: '-1h' });
      mockReq.headers = { authorization: `Bearer ${token}` };

      authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('Token expired');
    });

    it('should reject invalid token', () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('Invalid token');
    });

    it('should reject token with wrong secret', () => {
      const token = jwt.sign(validPayload, 'wrong-secret');
      mockReq.headers = { authorization: `Bearer ${token}` };

      authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('Invalid token');
    });

    it('should reject malformed Bearer token', () => {
      mockReq.headers = { authorization: 'Bearer' };

      authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('Invalid authorization format');
    });
  });

  describe('optionalAuth', () => {
    it('should set user for valid token', () => {
      const token = jwt.sign(validPayload, config.jwt.secret);
      mockReq.headers = { authorization: `Bearer ${token}` };

      optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual(expect.objectContaining(validPayload));
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without user for missing header', () => {
      optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without user for invalid format', () => {
      mockReq.headers = { authorization: 'InvalidFormat token' };

      optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without user for invalid token', () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without user for malformed Bearer', () => {
      mockReq.headers = { authorization: 'Bearer' };

      optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requireRole', () => {
    it('should allow user with required role', () => {
      mockReq.user = { ...validPayload, role: 'admin' };

      const middleware = requireRole('admin');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow user with one of multiple roles', () => {
      mockReq.user = { ...validPayload, role: 'moderator' };

      const middleware = requireRole('admin', 'moderator');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject user without required role', () => {
      mockReq.user = validPayload;

      const middleware = requireRole('admin');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('Insufficient permissions');
    });

    it('should reject unauthenticated user', () => {
      const middleware = requireRole('admin');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('Authentication required');
    });
  });

  describe('requireSameUser', () => {
    it('should allow same user', () => {
      mockReq.user = validPayload;
      mockReq.params = { id: validPayload.userId };

      requireSameUser(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow admin to access other users', () => {
      mockReq.user = { ...validPayload, role: 'admin' };
      mockReq.params = { id: 'different-user-id' };

      requireSameUser(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject different user', () => {
      mockReq.user = validPayload;
      mockReq.params = { id: 'different-user-id' };

      requireSameUser(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('Access denied');
    });

    it('should reject unauthenticated user', () => {
      mockReq.params = { id: validPayload.userId };

      requireSameUser(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toBe('Authentication required');
    });

    it('should use userId param if id not present', () => {
      mockReq.user = validPayload;
      mockReq.params = { userId: validPayload.userId };

      requireSameUser(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const token = generateToken(validPayload);

      expect(token).toBeDefined();
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      expect(decoded.userId).toBe(validPayload.userId);
      expect(decoded.email).toBe(validPayload.email);
      expect(decoded.role).toBe(validPayload.role);
    });
  });

  describe('decodeToken', () => {
    it('should decode valid token', () => {
      const token = jwt.sign(validPayload, config.jwt.secret);

      const decoded = decodeToken(token);

      expect(decoded).toEqual(expect.objectContaining(validPayload));
    });

    it('should return null for invalid token', () => {
      const decoded = decodeToken('invalid-token');

      expect(decoded).toBeNull();
    });

    it('should return null for expired token', () => {
      const token = jwt.sign(validPayload, config.jwt.secret, { expiresIn: '-1h' });

      const decoded = decodeToken(token);

      expect(decoded).toBeNull();
    });
  });
});
