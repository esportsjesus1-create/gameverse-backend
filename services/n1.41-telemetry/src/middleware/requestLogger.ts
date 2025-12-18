import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { getCurrentTimestamp } from '../utils/helpers';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = getCurrentTimestamp();
  const requestId = `req_${startTime}_${Math.random().toString(36).substring(7)}`;

  res.on('finish', () => {
    const duration = getCurrentTimestamp() - startTime;
    
    logger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('user-agent')
    });
  });

  next();
}
