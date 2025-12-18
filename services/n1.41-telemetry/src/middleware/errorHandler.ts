import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('Request error', {
    message: err.message,
    stack: err.stack,
    code: err.code
  });

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation Error',
      code: 'VALIDATION_ERROR',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }))
    });
    return;
  }

  const statusCode = err.statusCode ?? 500;
  const message = statusCode === 500 ? 'Internal Server Error' : err.message;

  res.status(statusCode).json({
    error: message,
    code: err.code ?? 'INTERNAL_ERROR'
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not Found',
    code: 'NOT_FOUND'
  });
}

export function createError(message: string, statusCode: number, code?: string): ApiError {
  const error: ApiError = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
