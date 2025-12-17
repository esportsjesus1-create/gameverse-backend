import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { redis } from '../config/redis';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    postgres: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
  };
  uptime: number;
}

router.get('/', async (_req: Request, res: Response) => {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      postgres: 'disconnected',
      redis: 'disconnected'
    },
    uptime: process.uptime()
  };

  try {
    await pool.query('SELECT 1');
    health.services.postgres = 'connected';
  } catch {
    health.status = 'unhealthy';
  }

  try {
    await redis.ping();
    health.services.redis = 'connected';
  } catch {
    health.status = 'unhealthy';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

router.get('/ready', async (_req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    await redis.ping();
    res.status(200).json({ ready: true });
  } catch {
    res.status(503).json({ ready: false });
  }
});

router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ live: true });
});

export default router;
