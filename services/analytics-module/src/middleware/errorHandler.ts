/**
 * GameVerse Analytics Module - Error Handler Middleware
 * Global error handling with structured responses
 */

import { Request, Response, NextFunction } from 'express';
import { logger, LogEventType } from '../utils/logger';
import {
  AnalyticsError,
  isAnalyticsError,
  toAnalyticsError,
  AnalyticsErrorCode,
} from '../utils/errors';
import { AuthenticatedRequest } from './rbac';

/**
 * Async handler wrapper to catch async errors
 */
export function asyncHandler(
  fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  const error = new AnalyticsError(
    AnalyticsErrorCode.ANALYTICS_SERVICE_UNAVAILABLE,
    `Route ${req.method} ${req.path} not found`,
    { method: req.method, path: req.path }
  );

  logger.warn(LogEventType.QUERY_FAILED, `Route not found: ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
  });

  res.status(404).json(error.toResponse(
    req.headers['x-request-id'] as string,
    req.path
  ));
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string;

  // Convert to AnalyticsError if not already
  const analyticsError = isAnalyticsError(err) ? err : toAnalyticsError(err);

  // Log the error
  if (analyticsError.isOperational) {
    logger.warn(LogEventType.QUERY_FAILED, analyticsError.message, {
      code: analyticsError.code,
      statusCode: analyticsError.statusCode,
      path: req.path,
      method: req.method,
      requestId,
    });
  } else {
    logger.error(LogEventType.QUERY_FAILED, analyticsError.message, err, {
      code: analyticsError.code,
      statusCode: analyticsError.statusCode,
      path: req.path,
      method: req.method,
      requestId,
      stack: err.stack,
    });
  }

  // Send error response
  res.status(analyticsError.statusCode).json(
    analyticsError.toResponse(requestId, req.path)
  );
}

/**
 * Uncaught exception handler
 */
export function setupUncaughtExceptionHandler(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error(LogEventType.QUERY_FAILED, 'Uncaught exception', error, {
      type: 'uncaughtException',
    });

    // Give time for logs to flush before exiting
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error(LogEventType.QUERY_FAILED, 'Unhandled rejection', error, {
      type: 'unhandledRejection',
    });
  });
}

export default {
  asyncHandler,
  notFoundHandler,
  errorHandler,
  setupUncaughtExceptionHandler,
};
