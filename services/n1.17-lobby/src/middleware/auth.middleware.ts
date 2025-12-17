import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { LoggerService } from '../services/logger.service';

const logger = new LoggerService('AuthMiddleware');

interface TokenPayload {
  playerId: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  playerId?: string;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authorization header missing or invalid',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;

    req.playerId = decoded.playerId;
    next();
  } catch (error) {
    logger.warn('Authentication failed', { error: (error as Error).message });
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      timestamp: new Date().toISOString()
    });
  }
}

export function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;
      req.playerId = decoded.playerId;
    }

    next();
  } catch {
    next();
  }
}
