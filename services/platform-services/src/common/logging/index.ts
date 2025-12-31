import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
} as const;

export type LogLevelType = (typeof LogLevel)[keyof typeof LogLevel];

export const EventTypes = {
  EMAIL_SEND_INITIATED: 'EMAIL_SEND_INITIATED',
  EMAIL_SEND_SUCCESS: 'EMAIL_SEND_SUCCESS',
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  EMAIL_TEMPLATE_CREATED: 'EMAIL_TEMPLATE_CREATED',
  EMAIL_TEMPLATE_UPDATED: 'EMAIL_TEMPLATE_UPDATED',
  EMAIL_TEMPLATE_DELETED: 'EMAIL_TEMPLATE_DELETED',
  EMAIL_TEMPLATE_RENDERED: 'EMAIL_TEMPLATE_RENDERED',
  EMAIL_DELIVERY_STATUS_UPDATED: 'EMAIL_DELIVERY_STATUS_UPDATED',
  EMAIL_BOUNCE_RECEIVED: 'EMAIL_BOUNCE_RECEIVED',
  EMAIL_COMPLAINT_RECEIVED: 'EMAIL_COMPLAINT_RECEIVED',
  EMAIL_QUEUED: 'EMAIL_QUEUED',
  EMAIL_DEQUEUED: 'EMAIL_DEQUEUED',
  SMS_SEND_INITIATED: 'SMS_SEND_INITIATED',
  SMS_SEND_SUCCESS: 'SMS_SEND_SUCCESS',
  SMS_SEND_FAILED: 'SMS_SEND_FAILED',
  SMS_TEMPLATE_CREATED: 'SMS_TEMPLATE_CREATED',
  SMS_TEMPLATE_UPDATED: 'SMS_TEMPLATE_UPDATED',
  SMS_TEMPLATE_DELETED: 'SMS_TEMPLATE_DELETED',
  SMS_VERIFICATION_CREATED: 'SMS_VERIFICATION_CREATED',
  SMS_VERIFICATION_VALIDATED: 'SMS_VERIFICATION_VALIDATED',
  SMS_VERIFICATION_FAILED: 'SMS_VERIFICATION_FAILED',
  SMS_VERIFICATION_EXPIRED: 'SMS_VERIFICATION_EXPIRED',
  SMS_DELIVERY_STATUS_UPDATED: 'SMS_DELIVERY_STATUS_UPDATED',
  STORAGE_UPLOAD_INITIATED: 'STORAGE_UPLOAD_INITIATED',
  STORAGE_UPLOAD_SUCCESS: 'STORAGE_UPLOAD_SUCCESS',
  STORAGE_UPLOAD_FAILED: 'STORAGE_UPLOAD_FAILED',
  STORAGE_DOWNLOAD_INITIATED: 'STORAGE_DOWNLOAD_INITIATED',
  STORAGE_DOWNLOAD_SUCCESS: 'STORAGE_DOWNLOAD_SUCCESS',
  STORAGE_DOWNLOAD_FAILED: 'STORAGE_DOWNLOAD_FAILED',
  STORAGE_DELETE_INITIATED: 'STORAGE_DELETE_INITIATED',
  STORAGE_DELETE_SUCCESS: 'STORAGE_DELETE_SUCCESS',
  STORAGE_DELETE_FAILED: 'STORAGE_DELETE_FAILED',
  STORAGE_SIGNED_URL_GENERATED: 'STORAGE_SIGNED_URL_GENERATED',
  STORAGE_METADATA_UPDATED: 'STORAGE_METADATA_UPDATED',
  CONFIG_LOADED: 'CONFIG_LOADED',
  CONFIG_UPDATED: 'CONFIG_UPDATED',
  CONFIG_VALIDATION_FAILED: 'CONFIG_VALIDATION_FAILED',
  CONFIG_SECRET_ACCESSED: 'CONFIG_SECRET_ACCESSED',
  CONFIG_SECRET_UPDATED: 'CONFIG_SECRET_UPDATED',
  CONFIG_SECRET_ROTATED: 'CONFIG_SECRET_ROTATED',
  FEATURE_FLAG_CHECKED: 'FEATURE_FLAG_CHECKED',
  FEATURE_FLAG_UPDATED: 'FEATURE_FLAG_UPDATED',
  SECRET_ACCESSED: 'SECRET_ACCESSED',
  SECRET_UPDATED: 'SECRET_UPDATED',
  SECRET_ROTATED: 'SECRET_ROTATED',
  RATE_LIMIT_CHECKED: 'RATE_LIMIT_CHECKED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SECURITY_VALIDATION_PASSED: 'SECURITY_VALIDATION_PASSED',
  SECURITY_VALIDATION_FAILED: 'SECURITY_VALIDATION_FAILED',
  SERVICE_INITIALIZED: 'SERVICE_INITIALIZED',
  SERVICE_SHUTDOWN: 'SERVICE_SHUTDOWN',
  SERVICE_STARTED: 'SERVICE_STARTED',
  SERVICE_STOPPED: 'SERVICE_STOPPED',
  SERVICE_HEALTH_CHECK: 'SERVICE_HEALTH_CHECK',
  ERROR_OCCURRED: 'ERROR_OCCURRED',
  PERFORMANCE_METRIC: 'PERFORMANCE_METRIC',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

export interface LogContext {
  correlationId?: string;
  userId?: string;
  service?: string;
  operation?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  emailId?: string;
  smsId?: string;
  fileId?: string;
  [key: string]: unknown;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  eventType: EventType;
  userId?: string;
  service: string;
  operation: string;
  resource?: string;
  resourceId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
  correlationId: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface PerformanceMetric {
  id: string;
  timestamp: Date;
  service: string;
  operation: string;
  duration: number;
  success: boolean;
  correlationId: string;
  metadata?: Record<string, unknown>;
}

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  })
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export class PlatformLogger {
  private logger: winston.Logger;
  private service: string;
  private auditLogs: AuditLogEntry[] = [];
  private performanceMetrics: PerformanceMetric[] = [];

  constructor(service: string, options?: { level?: string; json?: boolean }) {
    this.service = service;
    this.logger = winston.createLogger({
      level: options?.level || process.env.LOG_LEVEL || 'info',
      format: options?.json ? jsonFormat : customFormat,
      defaultMeta: { service },
      transports: [new winston.transports.Console()],
    });
  }

  private createContext(context?: LogContext): LogContext {
    return {
      correlationId: context?.correlationId || uuidv4(),
      service: this.service,
      ...context,
    };
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, this.createContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(message, this.createContext(context));
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, this.createContext(context));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.logger.error(message, {
      ...this.createContext(context),
      error: error ? { name: error.name, message: error.message, stack: error.stack } : undefined,
    });
  }

  event(eventType: EventType, data: Record<string, unknown>, context?: LogContext): void {
    this.logger.info(`Event: ${eventType}`, {
      ...this.createContext(context),
      eventType,
      eventData: data,
    });
  }

  audit(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'service'>): AuditLogEntry {
    const auditEntry: AuditLogEntry = {
      ...entry,
      id: uuidv4(),
      timestamp: new Date(),
      service: this.service,
      correlationId: entry.correlationId || uuidv4(),
    };

    this.auditLogs.push(auditEntry);
    this.logger.info(`Audit: ${entry.eventType}`, {
      correlationId: auditEntry.correlationId,
      audit: auditEntry,
    });

    return auditEntry;
  }

  performance(metric: Omit<PerformanceMetric, 'id' | 'timestamp' | 'service'>): PerformanceMetric {
    const perfMetric: PerformanceMetric = {
      id: uuidv4(),
      timestamp: new Date(),
      service: this.service,
      ...metric,
    };

    this.performanceMetrics.push(perfMetric);
    this.logger.debug(`Performance: ${metric.operation}`, {
      correlationId: perfMetric.correlationId,
      performance: perfMetric,
    });

    return perfMetric;
  }

  startTimer(
    operation: string,
    correlationId?: string
  ): (success?: boolean, metadata?: Record<string, unknown>) => PerformanceMetric {
    const startTime = Date.now();
    const corrId = correlationId || uuidv4();

    return (success = true, metadata?: Record<string, unknown>) => {
      const duration = Date.now() - startTime;
      return this.performance({
        operation,
        duration,
        success,
        correlationId: corrId,
        metadata,
      });
    };
  }

  getAuditLogs(filter?: {
    userId?: string;
    eventType?: EventType;
    startDate?: Date;
    endDate?: Date;
  }): AuditLogEntry[] {
    let logs = [...this.auditLogs];

    if (filter?.userId) {
      logs = logs.filter((log) => log.userId === filter.userId);
    }
    if (filter?.eventType) {
      logs = logs.filter((log) => log.eventType === filter.eventType);
    }
    if (filter?.startDate) {
      logs = logs.filter((log) => log.timestamp >= filter.startDate!);
    }
    if (filter?.endDate) {
      logs = logs.filter((log) => log.timestamp <= filter.endDate!);
    }

    return logs;
  }

  getPerformanceMetrics(filter?: {
    operation?: string;
    startDate?: Date;
    endDate?: Date;
  }): PerformanceMetric[] {
    let metrics = [...this.performanceMetrics];

    if (filter?.operation) {
      metrics = metrics.filter((m) => m.operation === filter.operation);
    }
    if (filter?.startDate) {
      metrics = metrics.filter((m) => m.timestamp >= filter.startDate!);
    }
    if (filter?.endDate) {
      metrics = metrics.filter((m) => m.timestamp <= filter.endDate!);
    }

    return metrics;
  }

  getAveragePerformance(operation: string): {
    avgDuration: number;
    successRate: number;
    count: number;
  } {
    const metrics = this.performanceMetrics.filter((m) => m.operation === operation);
    if (metrics.length === 0) {
      return { avgDuration: 0, successRate: 0, count: 0 };
    }

    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
    const successCount = metrics.filter((m) => m.success).length;

    return {
      avgDuration: totalDuration / metrics.length,
      successRate: (successCount / metrics.length) * 100,
      count: metrics.length,
    };
  }

  clearAuditLogs(): void {
    this.auditLogs = [];
  }

  clearPerformanceMetrics(): void {
    this.performanceMetrics = [];
  }
}

export const createLogger = (
  service: string,
  options?: { level?: string; json?: boolean }
): PlatformLogger => {
  return new PlatformLogger(service, options);
};

export default PlatformLogger;
