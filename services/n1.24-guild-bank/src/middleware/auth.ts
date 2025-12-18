import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { MemberRole, RequestContext } from '../types';
import { GuildMemberModel } from '../models';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    guildId?: string;
    memberRole?: MemberRole;
  };
}

export interface JwtPayload {
  userId: string;
  guildId?: string;
  iat?: number;
  exp?: number;
}

export function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    req.user = {
      userId: decoded.userId,
      guildId: decoded.guildId,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(error);
    }
  }
}

export function requireGuildMember(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const guildId = req.params.guildId || req.body.guildId || req.user.guildId;
    
    if (!guildId) {
      throw new ForbiddenError('Guild ID required');
    }

    const member = GuildMemberModel.findByGuildAndUser(guildId, req.user.userId);
    
    if (!member) {
      throw new ForbiddenError('You are not a member of this guild');
    }

    req.user.guildId = guildId;
    req.user.memberRole = member.role;

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: MemberRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user || !req.user.memberRole) {
        throw new UnauthorizedError('Authentication required');
      }

      if (!roles.includes(req.user.memberRole)) {
        throw new ForbiddenError(`Required role: ${roles.join(' or ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireApprover(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  try {
    if (!req.user || !req.user.guildId) {
      throw new UnauthorizedError('Authentication required');
    }

    const member = GuildMemberModel.findByGuildAndUser(req.user.guildId, req.user.userId);
    
    if (!member || !member.canApprove) {
      throw new ForbiddenError('Approval permission required');
    }

    next();
  } catch (error) {
    next(error);
  }
}

// Generate JWT token (for testing purposes)
export function generateToken(userId: string, guildId?: string): string {
  const expiresInSeconds = 86400; // 24 hours
  return jwt.sign({ userId, guildId }, config.jwt.secret, {
    expiresIn: expiresInSeconds,
  });
}

// Extract request context
export function getRequestContext(req: AuthenticatedRequest): RequestContext {
  if (!req.user || !req.user.guildId || !req.user.memberRole) {
    throw new UnauthorizedError('Invalid request context');
  }

  return {
    userId: req.user.userId,
    guildId: req.user.guildId,
    memberRole: req.user.memberRole,
  };
}
