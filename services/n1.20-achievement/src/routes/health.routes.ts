import { Router, Request, Response } from 'express';
import { healthCheck as dbHealthCheck } from '../config/database.js';
import { healthCheck as redisHealthCheck } from '../config/redis.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { StatusCodes } from 'http-status-codes';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  sendSuccess(res, {
    status: 'ok',
    service: 'achievement',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

router.get('/ready', (_req: Request, res: Response) => {
  Promise.all([
    dbHealthCheck(),
    redisHealthCheck()
  ])
    .then(([dbOk, redisOk]) => {
      const isReady = dbOk && redisOk;

      if (isReady) {
        sendSuccess(res, {
          status: 'ready',
          checks: {
            database: dbOk ? 'ok' : 'fail',
            redis: redisOk ? 'ok' : 'fail'
          }
        });
      } else {
        sendError(
          res,
          StatusCodes.SERVICE_UNAVAILABLE,
          'SERVICE_UNAVAILABLE',
          'Service is not ready',
          {
            database: [dbOk ? 'ok' : 'fail'],
            redis: [redisOk ? 'ok' : 'fail']
          }
        );
      }
    })
    .catch(() => {
      sendError(
        res,
        StatusCodes.SERVICE_UNAVAILABLE,
        'SERVICE_UNAVAILABLE',
        'Health check failed'
      );
    });
});

router.get('/live', (_req: Request, res: Response) => {
  sendSuccess(res, { status: 'alive' });
});

export default router;
