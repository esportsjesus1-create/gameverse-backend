import { Request, Response, NextFunction } from 'express';
import { jwtService } from '../services/jwt.service';
import { authService } from '../services/auth.service';
import { JwtPayload, Role, Permission, InsufficientPermissionsError, InvalidTokenError } from '../types';

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
  sessionId: string;
}

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new InvalidTokenError('No token provided');
    }

    const token = authHeader.substring(7);
    const payload = jwtService.verifyAccessToken(token);

    const session = authService.getSessionById(payload.sessionId);
    if (!session || session.isRevoked) {
      throw new InvalidTokenError('Session expired or revoked');
    }

    (req as AuthenticatedRequest).user = payload;
    (req as AuthenticatedRequest).sessionId = payload.sessionId;

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    
    if (!authReq.user) {
      return next(new InvalidTokenError('Not authenticated'));
    }

    const hasRole = roles.some(role => authReq.user.roles.includes(role));
    if (!hasRole) {
      return next(new InsufficientPermissionsError(`Required roles: ${roles.join(', ')}`));
    }

    next();
  };
}

export function requirePermissions(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    
    if (!authReq.user) {
      return next(new InvalidTokenError('Not authenticated'));
    }

    const hasPermission = permissions.every(permission => 
      authReq.user.permissions.includes(permission) || 
      authReq.user.permissions.includes('admin:all')
    );

    if (!hasPermission) {
      return next(new InsufficientPermissionsError(`Required permissions: ${permissions.join(', ')}`));
    }

    next();
  };
}

export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const payload = jwtService.verifyAccessToken(token);

    (req as AuthenticatedRequest).user = payload;
    (req as AuthenticatedRequest).sessionId = payload.sessionId;

    next();
  } catch {
    next();
  }
}
