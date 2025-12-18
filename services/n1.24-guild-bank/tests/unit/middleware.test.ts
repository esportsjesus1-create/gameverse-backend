import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  authenticate,
  requireGuildMember,
  requireRole,
  requireApprover,
  generateToken,
  AuthenticatedRequest,
} from '../../src/middleware/auth';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler';
import { validateBody } from '../../src/middleware/validation';
import { GuildMemberModel, clearAllData, MemberRole } from '../../src/models';
import { AppError } from '../../src/utils/errors';
import { z } from 'zod';
import { config } from '../../src/config';

describe('Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    clearAllData();
    mockReq = {
      headers: {},
      params: {},
      body: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('authenticate', () => {
    it('should authenticate valid token', () => {
      const token = generateToken('user-123', 'guild-123');
      mockReq.headers = { authorization: `Bearer ${token}` };

      authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.userId).toBe('user-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject missing token', () => {
      authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reject invalid token', () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reject malformed authorization header', () => {
      mockReq.headers = { authorization: 'InvalidFormat token' };

      authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('requireGuildMember', () => {
    it('should pass for guild member', () => {
      const guildId = 'guild-123';
      const userId = 'user-456';

      GuildMemberModel.create({
        guildId,
        userId,
        role: MemberRole.MEMBER,
        canApprove: false,
      });

      mockReq.user = { userId };
      mockReq.params = { guildId };

      requireGuildMember(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockReq.user.memberRole).toBe(MemberRole.MEMBER);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject non-member', () => {
      mockReq.user = { userId: 'user-456' };
      mockReq.params = { guildId: 'guild-123' };

      requireGuildMember(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reject unauthenticated request', () => {
      requireGuildMember(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('requireRole', () => {
    it('should pass for correct role', () => {
      mockReq.user = { userId: 'user-123', memberRole: MemberRole.LEADER };

      const middleware = requireRole(MemberRole.LEADER, MemberRole.TREASURER);
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject incorrect role', () => {
      mockReq.user = { userId: 'user-123', memberRole: MemberRole.MEMBER };

      const middleware = requireRole(MemberRole.LEADER);
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('requireApprover', () => {
    it('should pass for approver', () => {
      const guildId = 'guild-123';
      const userId = 'user-456';

      GuildMemberModel.create({
        guildId,
        userId,
        role: MemberRole.OFFICER,
        canApprove: true,
      });

      mockReq.user = { userId, guildId };

      requireApprover(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject non-approver', () => {
      const guildId = 'guild-123';
      const userId = 'user-456';

      GuildMemberModel.create({
        guildId,
        userId,
        role: MemberRole.MEMBER,
        canApprove: false,
      });

      mockReq.user = { userId, guildId };

      requireApprover(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const token = generateToken('user-123', 'guild-456');
      const decoded = jwt.verify(token, config.jwt.secret) as { userId: string; guildId: string };

      expect(decoded.userId).toBe('user-123');
      expect(decoded.guildId).toBe('guild-456');
    });
  });

  describe('errorHandler', () => {
    it('should handle AppError', () => {
      const error = new AppError('Test error', 400);

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Test error',
      });
    });

    it('should handle unknown errors', () => {
      const error = new Error('Unknown error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
      });
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 response', () => {
      notFoundHandler(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Resource not found',
      });
    });
  });

  describe('validateBody', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      amount: z.number().positive(),
    });

    it('should pass valid body', () => {
      mockReq.body = { name: 'Test', amount: 100 };

      const middleware = validateBody(testSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject invalid body', () => {
      mockReq.body = { name: '', amount: -1 };

      const middleware = validateBody(testSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      const calledError = (mockNext as jest.Mock).mock.calls[0][0];
      expect(calledError.message).toContain('name');
    });
  });
});
