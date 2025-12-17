import { Request, Response, NextFunction } from 'express';
import { GatewayError, RateLimitError, formatError } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('Request error', {
    method: req.method,
    path: req.path,
    error: error.message,
    stack: error.stack
  });

  if (error instanceof RateLimitError) {
    res.setHeader('Retry-After', error.retryAfter.toString());
    res.status(429).json({
      jsonrpc: '2.0',
      error: {
        code: -32029,
        message: error.message,
        data: { retryAfter: error.retryAfter }
      },
      id: null
    });
    return;
  }

  if (error instanceof GatewayError) {
    res.status(error.statusCode).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: error.message,
        data: error.details
      },
      id: null
    });
    return;
  }

  res.status(500).json({
    jsonrpc: '2.0',
    error: {
      code: -32603,
      message: 'Internal error',
      data: process.env.NODE_ENV === 'development' ? error.message : undefined
    },
    id: null
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    jsonrpc: '2.0',
    error: {
      code: -32601,
      message: 'Method not found',
      data: { path: req.path }
    },
    id: null
  });
}
