import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { AppError, ValidationError, formatZodError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';
import { config } from '../config/index.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    const errors = formatZodError(err);
    sendError(
      res,
      StatusCodes.BAD_REQUEST,
      'VALIDATION_ERROR',
      'Validation failed',
      errors
    );
    return;
  }

  if (err instanceof ValidationError) {
    sendError(
      res,
      err.statusCode,
      err.code,
      err.message,
      err.errors
    );
    return;
  }

  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message);
    return;
  }

  console.error('Unhandled error:', err);

  const isDevelopment = config.nodeEnv === 'development';
  sendError(
    res,
    StatusCodes.INTERNAL_SERVER_ERROR,
    'INTERNAL_ERROR',
    isDevelopment ? err.message : 'An unexpected error occurred'
  );
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(
    res,
    StatusCodes.NOT_FOUND,
    'NOT_FOUND',
    `Route ${req.method} ${req.path} not found`
  );
}
