import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export interface RequestWithId extends Request {
  requestId: string;
  startTime: number;
}

export function requestIdMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const requestWithId = req as RequestWithId;
  requestWithId.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  requestWithId.startTime = Date.now();
  next();
}

export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestWithId = req as RequestWithId;

  logger.info('Incoming request', {
    requestId: requestWithId.requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.on('finish', () => {
    const duration = Date.now() - requestWithId.startTime;
    logger.info('Request completed', {
      requestId: requestWithId.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
}

export function responseWrapper(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  const originalJson = res.json.bind(res);

  res.json = function (body: unknown): Response {
    if (body && typeof body === 'object' && !('timestamp' in body)) {
      const wrappedBody = {
        ...body,
        timestamp: new Date().toISOString(),
      };
      return originalJson(wrappedBody);
    }
    return originalJson(body);
  };

  next();
}
