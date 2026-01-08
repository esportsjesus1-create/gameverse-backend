import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { config } from '../config';
import { ApiResponse } from '../types';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response<ApiResponse<null>>,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    logger.warn('Application error', {
      message: err.message,
      statusCode: err.statusCode,
      isOperational: err.isOperational,
    });

    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  logger.error('Unexpected error', {
    message: err.message,
    stack: err.stack,
  });

  const statusCode = 500;
  const message = config.nodeEnv === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}

export function notFoundHandler(
  req: Request,
  res: Response<ApiResponse<null>>
): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
}
