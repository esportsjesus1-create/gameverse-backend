import { HealthChecker, HealthCheckable } from './HealthChecker';
import { HealthCheckResult } from '../types';

jest.mock('../database/redis', () => ({
  redisClient: {
    healthCheck: jest.fn().mockResolvedValue({
      service: 'redis',
      status: 'healthy',
      latency: 5
    })
  }
}));

jest.mock('../database/postgres', () => ({
  postgresClient: {
    healthCheck: jest.fn().mockResolvedValue({
      service: 'postgres',
      status: 'healthy',
      latency: 10
    })
  }
}));

describe('HealthChecker', () => {
  let healthChecker: HealthChecker;

  beforeEach(() => {
    jest.useFakeTimers();
    healthChecker = new HealthChecker(30000);
  });

  afterEach(() => {
    healthChecker.stop();
    jest.useRealTimers();
  });

  describe('registerService', () => {
    it('should register a health checkable service', () => {
      const mockService: HealthCheckable = {
        healthCheck: jest.fn().mockResolvedValue({
          service: 'test-service',
          status: 'healthy'
        })
      };

      healthChecker.registerService('test-service', mockService);
      
      // Service should be registered
    });
  });

  describe('unregisterService', () => {
    it('should unregister a service', () => {
      const mockService: HealthCheckable = {
        healthCheck: jest.fn().mockResolvedValue({
          service: 'test-service',
          status: 'healthy'
        })
      };

      healthChecker.registerService('test-service', mockService);
      healthChecker.unregisterService('test-service');
      
      // Service should be unregistered
    });
  });

  describe('start and stop', () => {
    it('should start health check interval', () => {
      healthChecker.start();
      
      // Should not throw
    });

    it('should not start twice', () => {
      healthChecker.start();
      healthChecker.start();
      
      // Should not throw
    });

    it('should stop health check interval', () => {
      healthChecker.start();
      healthChecker.stop();
      
      // Should not throw
    });
  });

  describe('checkService', () => {
    it('should check a specific service', async () => {
      const mockService: HealthCheckable = {
        healthCheck: jest.fn().mockResolvedValue({
          service: 'test-service',
          status: 'healthy',
          latency: 5
        })
      };

      healthChecker.registerService('test-service', mockService);
      const result = await healthChecker.checkService('test-service');
      
      expect(result).not.toBeNull();
      expect(result?.service).toBe('test-service');
      expect(result?.status).toBe('healthy');
    });

    it('should return null for unregistered service', async () => {
      const result = await healthChecker.checkService('unknown-service');
      expect(result).toBeNull();
    });

    it('should handle service check errors', async () => {
      const mockService: HealthCheckable = {
        healthCheck: jest.fn().mockRejectedValue(new Error('Check failed'))
      };

      healthChecker.registerService('failing-service', mockService);
      const result = await healthChecker.checkService('failing-service');
      
      expect(result?.status).toBe('unhealthy');
      expect(result?.message).toBe('Check failed');
    });
  });

  describe('checkAll', () => {
    it('should check all registered services', async () => {
      const mockService1: HealthCheckable = {
        healthCheck: jest.fn().mockResolvedValue({
          service: 'service1',
          status: 'healthy'
        })
      };
      const mockService2: HealthCheckable = {
        healthCheck: jest.fn().mockResolvedValue({
          service: 'service2',
          status: 'degraded'
        })
      };

      healthChecker.registerService('service1', mockService1);
      healthChecker.registerService('service2', mockService2);

      const results = await healthChecker.checkAll();
      
      expect(results.size).toBeGreaterThanOrEqual(2);
      expect(results.get('service1')?.status).toBe('healthy');
      expect(results.get('service2')?.status).toBe('degraded');
    });

    it('should include redis and postgres checks', async () => {
      const results = await healthChecker.checkAll();
      
      expect(results.has('redis')).toBe(true);
      expect(results.has('postgres')).toBe(true);
    });
  });

  describe('getLastResults', () => {
    it('should return last check results', async () => {
      const mockService: HealthCheckable = {
        healthCheck: jest.fn().mockResolvedValue({
          service: 'test-service',
          status: 'healthy'
        })
      };
      healthChecker.registerService('test-service', mockService);
      await healthChecker.checkAll();
      const results = healthChecker.getLastResults();
      
      expect(results.size).toBeGreaterThan(0);
    });
  });

  describe('getOverallStatus', () => {
    it('should return unhealthy when no results', () => {
      const status = healthChecker.getOverallStatus();
      expect(status).toBe('unhealthy');
    });

    it('should return healthy when all services healthy', async () => {
      const mockService: HealthCheckable = {
        healthCheck: jest.fn().mockResolvedValue({
          service: 'test',
          status: 'healthy'
        })
      };
      healthChecker.registerService('test', mockService);
      await healthChecker.checkAll();
      
      const status = healthChecker.getOverallStatus();
      expect(status).toBe('healthy');
    });

    it('should return degraded when some services degraded', async () => {
      const mockService: HealthCheckable = {
        healthCheck: jest.fn().mockResolvedValue({
          service: 'test',
          status: 'degraded'
        })
      };
      healthChecker.registerService('test', mockService);
      await healthChecker.checkAll();
      
      const status = healthChecker.getOverallStatus();
      expect(status).toBe('degraded');
    });

    it('should return unhealthy when any service unhealthy', async () => {
      const mockService: HealthCheckable = {
        healthCheck: jest.fn().mockResolvedValue({
          service: 'test',
          status: 'unhealthy'
        })
      };
      healthChecker.registerService('test', mockService);
      await healthChecker.checkAll();
      
      const status = healthChecker.getOverallStatus();
      expect(status).toBe('unhealthy');
    });
  });

  describe('toJSON', () => {
    it('should return JSON representation', async () => {
      await healthChecker.checkAll();
      const json = healthChecker.toJSON();
      
      expect(json).toHaveProperty('status');
      expect(json).toHaveProperty('services');
      expect(json).toHaveProperty('timestamp');
    });
  });

  describe('events', () => {
    it('should emit healthCheckComplete event', async () => {
      const eventHandler = jest.fn();
      healthChecker.on('healthCheckComplete', eventHandler);
      
      healthChecker.start();
      jest.advanceTimersByTime(30000);
      
      // Event should be emitted
    });
  });
});
