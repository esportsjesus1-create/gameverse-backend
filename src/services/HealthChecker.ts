import { EventEmitter } from 'events';
import { HealthCheckResult } from '../types';
import { redisClient } from '../database/redis';
import { postgresClient } from '../database/postgres';
import { logger } from '../utils/logger';

export interface HealthCheckable {
  healthCheck(): Promise<HealthCheckResult>;
}

export class HealthChecker extends EventEmitter {
  private services: Map<string, HealthCheckable> = new Map();
  private lastResults: Map<string, HealthCheckResult> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private intervalMs: number;

  constructor(intervalMs: number = 30000) {
    super();
    this.intervalMs = intervalMs;
  }

  registerService(name: string, service: HealthCheckable): void {
    this.services.set(name, service);
    logger.debug('Health check service registered', { name });
  }

  unregisterService(name: string): void {
    this.services.delete(name);
    this.lastResults.delete(name);
  }

  start(): void {
    if (this.checkInterval) {
      return;
    }

    this.performAllChecks();

    this.checkInterval = setInterval(() => {
      this.performAllChecks();
    }, this.intervalMs);

    logger.info('HealthChecker started', { intervalMs: this.intervalMs });
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info('HealthChecker stopped');
  }

  async checkService(name: string): Promise<HealthCheckResult | null> {
    const service = this.services.get(name);
    if (!service) {
      return null;
    }

    try {
      const result = await service.healthCheck();
      this.lastResults.set(name, result);
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        service: name,
        status: 'unhealthy',
        message: (error as Error).message
      };
      this.lastResults.set(name, result);
      return result;
    }
  }

  async checkAll(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();

    const redisResult = await this.checkRedis();
    results.set('redis', redisResult);

    const postgresResult = await this.checkPostgres();
    results.set('postgres', postgresResult);

    for (const [name, service] of this.services.entries()) {
      try {
        const result = await service.healthCheck();
        results.set(name, result);
        this.lastResults.set(name, result);
      } catch (error) {
        const result: HealthCheckResult = {
          service: name,
          status: 'unhealthy',
          message: (error as Error).message
        };
        results.set(name, result);
        this.lastResults.set(name, result);
      }
    }

    return results;
  }

  private async checkRedis(): Promise<HealthCheckResult> {
    return redisClient.healthCheck();
  }

  private async checkPostgres(): Promise<HealthCheckResult> {
    return postgresClient.healthCheck();
  }

  getLastResults(): Map<string, HealthCheckResult> {
    return new Map(this.lastResults);
  }

  getOverallStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    if (this.lastResults.size === 0) {
      return 'unhealthy';
    }

    let hasUnhealthy = false;
    let hasDegraded = false;

    for (const result of this.lastResults.values()) {
      if (result.status === 'unhealthy') {
        hasUnhealthy = true;
      } else if (result.status === 'degraded') {
        hasDegraded = true;
      }
    }

    if (hasUnhealthy) {
      return 'unhealthy';
    }
    if (hasDegraded) {
      return 'degraded';
    }
    return 'healthy';
  }

  private async performAllChecks(): Promise<void> {
    const results = await this.checkAll();
    const overallStatus = this.getOverallStatus();

    this.emit('healthCheckComplete', {
      results: Object.fromEntries(results),
      overallStatus,
      timestamp: new Date()
    });

    if (overallStatus !== 'healthy') {
      logger.warn('Health check detected issues', {
        overallStatus,
        unhealthyServices: Array.from(results.entries())
          .filter(([, r]) => r.status !== 'healthy')
          .map(([name]) => name)
      });
    }
  }

  toJSON(): {
    status: string;
    services: Record<string, HealthCheckResult>;
    timestamp: string;
  } {
    return {
      status: this.getOverallStatus(),
      services: Object.fromEntries(this.lastResults),
      timestamp: new Date().toISOString()
    };
  }
}
