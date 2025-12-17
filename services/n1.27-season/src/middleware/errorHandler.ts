import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response<ApiResponse<null>>,
  _next: NextFunction
): void => {
  logger.error('Error:', err);

  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      message: JSON.stringify(err.errors),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
};

export const notFoundHandler = (
  _req: Request,
  res: Response<ApiResponse<null>>
): void => {
  res.status(404).json({
    success: false,
    error: 'Resource not found',
  });
};
