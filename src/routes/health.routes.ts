import { Router, Request, Response } from 'express';
import { HealthCheckResponse, HealthCheck } from '../types';
import { config } from '../config';

const router = Router();
const startTime = Date.now();

export interface HealthCheckFunction {
  name: string;
  check: () => Promise<HealthCheck>;
}

const healthChecks: HealthCheckFunction[] = [];

export function registerHealthCheck(name: string, check: () => Promise<HealthCheck>): void {
  healthChecks.push({ name, check });
}

router.get('/health', async (_req: Request, res: Response): Promise<void> => {
  const checks: HealthCheck[] = [];
  let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

  for (const healthCheck of healthChecks) {
    try {
      const startCheck = Date.now();
      const result = await healthCheck.check();
      result.responseTime = Date.now() - startCheck;
      checks.push(result);

      if (result.status === 'fail') {
        overallStatus = 'unhealthy';
      } else if (result.status === 'warn' && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    } catch (error) {
      checks.push({
        name: healthCheck.name,
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      overallStatus = 'unhealthy';
    }
  }

  const response: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    service: config.serviceName,
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
  res.status(statusCode).json(response);
});

router.get('/ready', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

router.get('/live', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

export default router;
