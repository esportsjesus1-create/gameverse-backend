import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError, ApiResponse } from '../types';
import logger from '../utils/logger';
import { config } from '../config';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as { requestId?: string }).requestId;

  if (err instanceof AppError) {
    const response: ApiResponse = {
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
      requestId,
    };

    if (err instanceof ValidationError) {
      (response as ApiResponse & { errors: Record<string, string[]> }).errors = err.errors;
    }

    if (!err.isOperational) {
      logger.error('Non-operational error', {
        error: err.message,
        stack: err.stack,
        requestId,
      });
    }

    res.status(err.statusCode).json(response);
    return;
  }

  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    requestId,
  });

  const response: ApiResponse = {
    success: false,
    error: config.nodeEnv === 'production' ? 'Internal server error' : err.message,
    timestamp: new Date().toISOString(),
    requestId,
  };

  res.status(500).json(response);
}

export function notFoundHandler(req: Request, res: Response): void {
  const requestId = (req as { requestId?: string }).requestId;

  const response: ApiResponse = {
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
    requestId,
  };

  res.status(404).json(response);
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
