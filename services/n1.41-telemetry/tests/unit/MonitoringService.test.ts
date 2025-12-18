import { MonitoringService } from '../../src/services/MonitoringService';
import { metricsService } from '../../src/services/MetricsService';

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;

  beforeEach(() => {
    monitoringService = new MonitoringService();
    metricsService.clearMetrics();
  });

  afterEach(() => {
    monitoringService.stopMonitoring();
    monitoringService.clearAlerts();
  });

  describe('getHealthStatus', () => {
    it('should return healthy status', () => {
      const health = monitoringService.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(health.version).toBe('1.41.0');
      expect(health.checks).toBeDefined();
    });

    it('should include all health checks', () => {
      const health = monitoringService.getHealthStatus();

      expect(health.checks['memory']).toBeDefined();
      expect(health.checks['events']).toBeDefined();
      expect(health.checks['metrics']).toBeDefined();
      expect(health.checks['sessions']).toBeDefined();
    });
  });

  describe('getSystemStatus', () => {
    it('should return system status', () => {
      const status = monitoringService.getSystemStatus();

      expect(status.eventsProcessed).toBeDefined();
      expect(status.metricsRecorded).toBeDefined();
      expect(status.activeSessions).toBeDefined();
      expect(status.memoryUsage).toBeDefined();
      expect(status.cpuUsage).toBeDefined();
    });
  });

  describe('addAlertThreshold', () => {
    it('should add an alert threshold', () => {
      const threshold = monitoringService.addAlertThreshold({
        metricName: 'cpu_usage',
        operator: 'gt',
        value: 80,
        severity: 'warning',
        enabled: true
      });

      expect(threshold.id).toBeDefined();
      expect(threshold.metricName).toBe('cpu_usage');
      expect(threshold.operator).toBe('gt');
      expect(threshold.value).toBe(80);
      expect(threshold.severity).toBe('warning');
    });
  });

  describe('updateAlertThreshold', () => {
    it('should update an existing threshold', () => {
      const threshold = monitoringService.addAlertThreshold({
        metricName: 'cpu_usage',
        operator: 'gt',
        value: 80,
        severity: 'warning',
        enabled: true
      });

      const updated = monitoringService.updateAlertThreshold(threshold.id, {
        value: 90,
        severity: 'critical'
      });

      expect(updated?.value).toBe(90);
      expect(updated?.severity).toBe('critical');
    });

    it('should return undefined for non-existent threshold', () => {
      const updated = monitoringService.updateAlertThreshold('non-existent', { value: 90 });
      expect(updated).toBeUndefined();
    });
  });

  describe('deleteAlertThreshold', () => {
    it('should delete an existing threshold', () => {
      const threshold = monitoringService.addAlertThreshold({
        metricName: 'cpu_usage',
        operator: 'gt',
        value: 80,
        severity: 'warning',
        enabled: true
      });

      const deleted = monitoringService.deleteAlertThreshold(threshold.id);

      expect(deleted).toBe(true);
      expect(monitoringService.getAlertThreshold(threshold.id)).toBeUndefined();
    });

    it('should return false for non-existent threshold', () => {
      const deleted = monitoringService.deleteAlertThreshold('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('getAlertThresholds', () => {
    it('should return all thresholds', () => {
      monitoringService.addAlertThreshold({
        metricName: 'cpu_usage',
        operator: 'gt',
        value: 80,
        severity: 'warning',
        enabled: true
      });
      monitoringService.addAlertThreshold({
        metricName: 'memory_usage',
        operator: 'gt',
        value: 90,
        severity: 'critical',
        enabled: true
      });

      const thresholds = monitoringService.getAlertThresholds();

      expect(thresholds).toHaveLength(2);
    });
  });

  describe('checkAlertThresholds', () => {
    it('should trigger alert when threshold is exceeded', () => {
      monitoringService.addAlertThreshold({
        metricName: 'test_metric',
        operator: 'gt',
        value: 50,
        severity: 'warning',
        enabled: true
      });

      metricsService.setGauge('test_metric', 75);

      const alerts = monitoringService.checkAlertThresholds();

      expect(alerts).toHaveLength(1);
      expect(alerts[0]?.metricName).toBe('test_metric');
      expect(alerts[0]?.currentValue).toBe(75);
    });

    it('should not trigger alert when threshold is not exceeded', () => {
      monitoringService.addAlertThreshold({
        metricName: 'test_metric',
        operator: 'gt',
        value: 50,
        severity: 'warning',
        enabled: true
      });

      metricsService.setGauge('test_metric', 25);

      const alerts = monitoringService.checkAlertThresholds();

      expect(alerts).toHaveLength(0);
    });

    it('should not trigger alert for disabled threshold', () => {
      monitoringService.addAlertThreshold({
        metricName: 'test_metric',
        operator: 'gt',
        value: 50,
        severity: 'warning',
        enabled: false
      });

      metricsService.setGauge('test_metric', 75);

      const alerts = monitoringService.checkAlertThresholds();

      expect(alerts).toHaveLength(0);
    });

    it('should handle different operators', () => {
      monitoringService.addAlertThreshold({
        metricName: 'test_lt',
        operator: 'lt',
        value: 50,
        severity: 'warning',
        enabled: true
      });

      metricsService.setGauge('test_lt', 25);

      const alerts = monitoringService.checkAlertThresholds();

      expect(alerts).toHaveLength(1);
    });

    it('should resolve alerts when condition is no longer met', () => {
      monitoringService.addAlertThreshold({
        metricName: 'test_metric',
        operator: 'gt',
        value: 50,
        severity: 'warning',
        enabled: true
      });

      metricsService.setGauge('test_metric', 75);
      monitoringService.checkAlertThresholds();

      metricsService.setGauge('test_metric', 25);
      monitoringService.checkAlertThresholds();

      const alerts = monitoringService.getAlerts(false);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('getAlerts', () => {
    it('should return active alerts by default', () => {
      monitoringService.addAlertThreshold({
        metricName: 'test_metric',
        operator: 'gt',
        value: 50,
        severity: 'warning',
        enabled: true
      });

      metricsService.setGauge('test_metric', 75);
      monitoringService.checkAlertThresholds();

      const alerts = monitoringService.getAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0]?.resolved).toBe(false);
    });

    it('should include resolved alerts when requested', () => {
      monitoringService.addAlertThreshold({
        metricName: 'test_metric',
        operator: 'gt',
        value: 50,
        severity: 'warning',
        enabled: true
      });

      metricsService.setGauge('test_metric', 75);
      monitoringService.checkAlertThresholds();

      metricsService.setGauge('test_metric', 25);
      monitoringService.checkAlertThresholds();

      const allAlerts = monitoringService.getAlerts(true);
      expect(allAlerts).toHaveLength(1);
      expect(allAlerts[0]?.resolved).toBe(true);
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge an alert', () => {
      monitoringService.addAlertThreshold({
        metricName: 'test_metric',
        operator: 'gt',
        value: 50,
        severity: 'warning',
        enabled: true
      });

      metricsService.setGauge('test_metric', 75);
      const [alert] = monitoringService.checkAlertThresholds();

      if (alert) {
        const acknowledged = monitoringService.acknowledgeAlert(alert.id);
        expect(acknowledged?.resolved).toBe(true);
        expect(acknowledged?.resolvedAt).toBeDefined();
      }
    });

    it('should return undefined for non-existent alert', () => {
      const acknowledged = monitoringService.acknowledgeAlert('non-existent');
      expect(acknowledged).toBeUndefined();
    });
  });

  describe('getUptime', () => {
    it('should return uptime in milliseconds', () => {
      const uptime = monitoringService.getUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getVersion', () => {
    it('should return version string', () => {
      const version = monitoringService.getVersion();
      expect(version).toBe('1.41.0');
    });
  });

  describe('startMonitoring and stopMonitoring', () => {
    it('should start and stop monitoring', () => {
      monitoringService.startMonitoring(60000);
      monitoringService.stopMonitoring();
    });

    it('should not start monitoring twice', () => {
      monitoringService.startMonitoring(60000);
      monitoringService.startMonitoring(60000);
      monitoringService.stopMonitoring();
    });
  });

  describe('clearAlerts', () => {
    it('should clear all alerts', () => {
      monitoringService.addAlertThreshold({
        metricName: 'test_metric',
        operator: 'gt',
        value: 50,
        severity: 'warning',
        enabled: true
      });

      metricsService.setGauge('test_metric', 75);
      monitoringService.checkAlertThresholds();

      monitoringService.clearAlerts();

      expect(monitoringService.getAlerts(true)).toHaveLength(0);
    });
  });
});
