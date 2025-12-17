import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers['x-user-id'] as string;

  if (!userId) {
    throw new AppError('User ID is required in x-user-id header', 401);
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    throw new AppError('Invalid user ID format', 400);
  }

  req.userId = userId;
  next();
}

export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers['x-user-id'] as string;

  if (userId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(userId)) {
      req.userId = userId;
    }
  }

  next();
}
