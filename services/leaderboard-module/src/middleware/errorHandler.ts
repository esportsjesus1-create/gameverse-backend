import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger, EventType } from '../utils/logger';
import { ValidationError, isAppError, handleError } from '../utils/errors';

export interface ErrorResponse {
  success: false;
  error: string;
  errorCode: string;
  details?: unknown;
  stack?: string;
  requestId?: string;
  timestamp: string;
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string | undefined;

  if (err instanceof ZodError) {
    const validationErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.');
      if (!validationErrors[path]) {
        validationErrors[path] = [];
      }
      validationErrors[path].push(issue.message);
    }

    const validationError = new ValidationError('Validation failed', validationErrors);

    logger.error(EventType.API_ERROR, 'Validation error', validationError, {
      requestId,
      path: req.path,
      method: req.method,
    });

    const response: ErrorResponse = {
      success: false,
      error: validationError.message,
      errorCode: validationError.code,
      details: validationError.errors,
      requestId,
      timestamp: new Date().toISOString(),
    };

    res.status(validationError.statusCode).json(response);
    return;
  }

  const appError = isAppError(err) ? err : handleError(err);

  logger.error(EventType.API_ERROR, appError.message, appError, {
    requestId,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  const response: ErrorResponse = {
    success: false,
    error: appError.message,
    errorCode: appError.code,
    details: appError.details,
    requestId,
    timestamp: new Date().toISOString(),
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = appError.stack;
  }

  res.status(appError.statusCode).json(response);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  const requestId = req.headers['x-request-id'] as string | undefined;

  logger.warn(EventType.API_ERROR, `Route not found: ${req.method} ${req.path}`, {
    requestId,
    path: req.path,
    method: req.method,
  });

  const response: ErrorResponse = {
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
    errorCode: 'NOT_FOUND',
    requestId,
    timestamp: new Date().toISOString(),
  };

  res.status(404).json(response);
};

export const asyncHandler = <T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default errorHandler;
