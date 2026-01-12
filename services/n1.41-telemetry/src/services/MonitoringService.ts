import {
  HealthStatus,
  SystemStatus,
  AlertThreshold,
  Alert
} from '../types';
import { logger } from '../utils/logger';
import { generateId, getCurrentTimestamp } from '../utils/helpers';
import { eventService } from './EventService';
import { metricsService } from './MetricsService';
import { sessionService } from './SessionService';

const VERSION = '1.41.0';

export class MonitoringService {
  private startTime: number;
  private alertThresholds: Map<string, AlertThreshold> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startTime = getCurrentTimestamp();
  }

  public startMonitoring(intervalMs = 60000): void {
    if (this.checkInterval !== null) {
      return;
    }

    this.checkInterval = setInterval(() => {
      this.checkAlertThresholds();
    }, intervalMs);

    logger.info('Monitoring started', { intervalMs });
  }

  public stopMonitoring(): void {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Monitoring stopped');
    }
  }

  public getHealthStatus(): HealthStatus {
    const now = getCurrentTimestamp();
    const checks: Record<string, { status: 'pass' | 'fail'; message?: string }> = {};

    checks['memory'] = this.checkMemory();
    checks['events'] = this.checkEventsService();
    checks['metrics'] = this.checkMetricsService();
    checks['sessions'] = this.checkSessionsService();

    const allPassing = Object.values(checks).every(c => c.status === 'pass');
    const anyFailing = Object.values(checks).some(c => c.status === 'fail');

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (allPassing) {
      status = 'healthy';
    } else if (anyFailing) {
      status = 'unhealthy';
    } else {
      status = 'degraded';
    }

    return {
      status,
      timestamp: now,
      uptime: now - this.startTime,
      version: VERSION,
      checks
    };
  }

  private checkMemory(): { status: 'pass' | 'fail'; message?: string } {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const usagePercent = (heapUsedMB / heapTotalMB) * 100;

    if (usagePercent > 90) {
      return { status: 'fail', message: `Memory usage at ${usagePercent.toFixed(1)}%` };
    }
    return { status: 'pass' };
  }

  private checkEventsService(): { status: 'pass' | 'fail'; message?: string } {
    try {
      eventService.getEventCount();
      return { status: 'pass' };
    } catch {
      return { status: 'fail', message: 'Events service unavailable' };
    }
  }

  private checkMetricsService(): { status: 'pass' | 'fail'; message?: string } {
    try {
      metricsService.getMetricCount();
      return { status: 'pass' };
    } catch {
      return { status: 'fail', message: 'Metrics service unavailable' };
    }
  }

  private checkSessionsService(): { status: 'pass' | 'fail'; message?: string } {
    try {
      sessionService.getSessionCount();
      return { status: 'pass' };
    } catch {
      return { status: 'fail', message: 'Sessions service unavailable' };
    }
  }

  public getSystemStatus(): SystemStatus {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000;

    return {
      eventsProcessed: eventService.getEventCount(),
      metricsRecorded: metricsService.getMetricCount(),
      activeSessions: sessionService.getActiveSessions().length,
      memoryUsage: memUsage,
      cpuUsage: cpuPercent
    };
  }

  public addAlertThreshold(threshold: Omit<AlertThreshold, 'id'>): AlertThreshold {
    const alertThreshold: AlertThreshold = {
      ...threshold,
      id: generateId()
    };

    this.alertThresholds.set(alertThreshold.id, alertThreshold);
    logger.info('Alert threshold added', { id: alertThreshold.id, metricName: threshold.metricName });

    return alertThreshold;
  }

  public updateAlertThreshold(
    id: string,
    updates: Partial<Omit<AlertThreshold, 'id'>>
  ): AlertThreshold | undefined {
    const threshold = this.alertThresholds.get(id);
    
    if (threshold === undefined) {
      return undefined;
    }

    const updated: AlertThreshold = { ...threshold, ...updates };
    this.alertThresholds.set(id, updated);
    
    return updated;
  }

  public deleteAlertThreshold(id: string): boolean {
    return this.alertThresholds.delete(id);
  }

  public getAlertThresholds(): AlertThreshold[] {
    return Array.from(this.alertThresholds.values());
  }

  public getAlertThreshold(id: string): AlertThreshold | undefined {
    return this.alertThresholds.get(id);
  }

  public checkAlertThresholds(): Alert[] {
    const triggeredAlerts: Alert[] = [];

    for (const threshold of this.alertThresholds.values()) {
      if (!threshold.enabled) {
        continue;
      }

      const metrics = metricsService.getMetrics(threshold.metricName);
      if (metrics.length === 0) {
        continue;
      }

      const latestMetric = metrics[metrics.length - 1];
      if (latestMetric === undefined) {
        continue;
      }

      const currentValue = latestMetric.value;
      const isTriggered = this.evaluateThreshold(currentValue, threshold.operator, threshold.value);

      if (isTriggered) {
        const existingAlert = this.findActiveAlertForThreshold(threshold.id);
        
        if (existingAlert === undefined) {
          const alert: Alert = {
            id: generateId(),
            thresholdId: threshold.id,
            metricName: threshold.metricName,
            currentValue,
            thresholdValue: threshold.value,
            severity: threshold.severity,
            triggeredAt: getCurrentTimestamp(),
            resolved: false
          };

          this.alerts.set(alert.id, alert);
          triggeredAlerts.push(alert);
          
          logger.warn('Alert triggered', {
            alertId: alert.id,
            metricName: threshold.metricName,
            currentValue,
            thresholdValue: threshold.value
          });
        }
      } else {
        const existingAlert = this.findActiveAlertForThreshold(threshold.id);
        if (existingAlert !== undefined) {
          existingAlert.resolved = true;
          existingAlert.resolvedAt = getCurrentTimestamp();
          this.alerts.set(existingAlert.id, existingAlert);
          
          logger.info('Alert resolved', { alertId: existingAlert.id });
        }
      }
    }

    return triggeredAlerts;
  }

  private evaluateThreshold(
    currentValue: number,
    operator: AlertThreshold['operator'],
    thresholdValue: number
  ): boolean {
    switch (operator) {
      case 'gt':
        return currentValue > thresholdValue;
      case 'lt':
        return currentValue < thresholdValue;
      case 'eq':
        return currentValue === thresholdValue;
      case 'gte':
        return currentValue >= thresholdValue;
      case 'lte':
        return currentValue <= thresholdValue;
    }
  }

  private findActiveAlertForThreshold(thresholdId: string): Alert | undefined {
    for (const alert of this.alerts.values()) {
      if (alert.thresholdId === thresholdId && !alert.resolved) {
        return alert;
      }
    }
    return undefined;
  }

  public getAlerts(includeResolved = false): Alert[] {
    const alerts = Array.from(this.alerts.values());
    
    if (includeResolved) {
      return alerts;
    }
    
    return alerts.filter(a => !a.resolved);
  }

  public getAlert(id: string): Alert | undefined {
    return this.alerts.get(id);
  }

  public acknowledgeAlert(id: string): Alert | undefined {
    const alert = this.alerts.get(id);
    
    if (alert === undefined) {
      return undefined;
    }

    alert.resolved = true;
    alert.resolvedAt = getCurrentTimestamp();
    this.alerts.set(id, alert);
    
    return alert;
  }

  public clearAlerts(): void {
    this.alerts.clear();
    logger.info('All alerts cleared');
  }

  public getUptime(): number {
    return getCurrentTimestamp() - this.startTime;
  }

  public getVersion(): string {
    return VERSION;
  }
}

export const monitoringService = new MonitoringService();
