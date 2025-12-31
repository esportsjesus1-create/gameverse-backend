import { Request, Response, NextFunction } from 'express';
import {
  AppError,
  ValidationError,
  RateLimitError,
  InvalidStateTransitionError,
  isOperationalError,
  wrapError,
  SeasonErrorCode,
} from '../utils/errors';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';
import { config } from '../config';

/**
 * Extended API error response interface.
 */
interface ApiErrorResponse extends ApiResponse<null> {
  code?: string;
  validationErrors?: Record<string, string[]>;
  retryAfter?: number;
  requestId?: string;
  timestamp?: string;
}

/**
 * Global error handler middleware.
 * Handles all errors thrown in the application and returns appropriate responses.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response<ApiErrorResponse>,
  _next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string | undefined;
  const timestamp = new Date().toISOString();

  const appError = wrapError(err);

  if (!isOperationalError(err)) {
    logger.error('Non-operational error occurred', err, {
      requestId,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.warn(`Operational error: ${err.message}`, {
      requestId,
      path: req.path,
      method: req.method,
      statusCode: appError.statusCode,
      code: appError.code,
    });
  }

  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      validationErrors: err.errors,
      requestId,
      timestamp,
    });
    return;
  }

  if (err instanceof RateLimitError) {
    res.setHeader('Retry-After', err.retryAfter);
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      retryAfter: err.retryAfter,
      requestId,
      timestamp,
    });
    return;
  }

  if (err instanceof InvalidStateTransitionError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      message: `Current state: ${err.currentState}, allowed transitions: ${err.allowedTransitions.join(', ')}`,
      requestId,
      timestamp,
    });
    return;
  }

  if (err instanceof AppError) {
    const response: ApiErrorResponse = {
      success: false,
      error: err.message,
      code: err.code,
      requestId,
      timestamp,
    };

    if (config.NODE_ENV === 'development' && err.context) {
      response.message = JSON.stringify(err.context);
    }

    res.status(err.statusCode).json(response);
    return;
  }

  const statusCode = isOperationalError(err) ? appError.statusCode : 500;
  const message = isOperationalError(err) ? err.message : 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: message,
    code: SeasonErrorCode.INTERNAL_ERROR,
    requestId,
    timestamp,
  });
};

/**
 * 404 Not Found handler for undefined routes.
 */
export const notFoundHandler = (
  req: Request,
  res: Response<ApiErrorResponse>
): void => {
  const requestId = req.headers['x-request-id'] as string | undefined;
  
  logger.warn(`Route not found: ${req.method} ${req.path}`, {
    requestId,
    path: req.path,
    method: req.method,
  });

  res.status(404).json({
    success: false,
    error: 'Resource not found',
    code: SeasonErrorCode.SEASON_NOT_FOUND,
    requestId,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Async handler wrapper to catch errors in async route handlers.
 */
export const asyncHandler = <T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Request logging middleware.
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logApiRequest(req.method, req.path, res.statusCode, duration, {
      requestId: req.headers['x-request-id'] as string,
    });
  });

  next();
};
