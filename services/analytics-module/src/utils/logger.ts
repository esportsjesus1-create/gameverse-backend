/**
 * GameVerse Analytics Module - Structured Logging System
 * 30+ event types with audit trails and performance metrics
 */

import winston from 'winston';
import { config } from '../config';

// Log Event Types (30+ types)
export enum LogEventType {
  // Analytics Query Events
  QUERY_STARTED = 'QUERY_STARTED',
  QUERY_COMPLETED = 'QUERY_COMPLETED',
  QUERY_FAILED = 'QUERY_FAILED',
  QUERY_CACHED = 'QUERY_CACHED',
  QUERY_TIMEOUT = 'QUERY_TIMEOUT',

  // Metrics Events
  METRIC_RECORDED = 'METRIC_RECORDED',
  METRIC_UPDATED = 'METRIC_UPDATED',
  METRIC_DELETED = 'METRIC_DELETED',
  METRIC_BATCH_PROCESSED = 'METRIC_BATCH_PROCESSED',
  METRIC_AGGREGATED = 'METRIC_AGGREGATED',

  // Event Tracking Events
  EVENT_TRACKED = 'EVENT_TRACKED',
  EVENT_BATCH_TRACKED = 'EVENT_BATCH_TRACKED',
  EVENT_PROCESSED = 'EVENT_PROCESSED',
  EVENT_FAILED = 'EVENT_FAILED',
  EVENT_QUEUE_OVERFLOW = 'EVENT_QUEUE_OVERFLOW',

  // Performance Events
  LATENCY_RECORDED = 'LATENCY_RECORDED',
  THROUGHPUT_RECORDED = 'THROUGHPUT_RECORDED',
  ERROR_RATE_RECORDED = 'ERROR_RATE_RECORDED',
  MEMORY_USAGE_RECORDED = 'MEMORY_USAGE_RECORDED',
  CPU_USAGE_RECORDED = 'CPU_USAGE_RECORDED',

  // Security Events
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILURE = 'AUTH_FAILURE',
  RATE_LIMIT_HIT = 'RATE_LIMIT_HIT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  INPUT_SANITIZED = 'INPUT_SANITIZED',

  // Audit Events
  AUDIT_CREATE = 'AUDIT_CREATE',
  AUDIT_READ = 'AUDIT_READ',
  AUDIT_UPDATE = 'AUDIT_UPDATE',
  AUDIT_DELETE = 'AUDIT_DELETE',
  AUDIT_EXPORT = 'AUDIT_EXPORT',
  AUDIT_CONFIG_CHANGE = 'AUDIT_CONFIG_CHANGE',

  // Cache Events
  CACHE_HIT = 'CACHE_HIT',
  CACHE_MISS = 'CACHE_MISS',
  CACHE_SET = 'CACHE_SET',
  CACHE_EVICT = 'CACHE_EVICT',
  CACHE_INVALIDATE = 'CACHE_INVALIDATE',
  CACHE_ERROR = 'CACHE_ERROR',

  // System Events
  SERVICE_STARTED = 'SERVICE_STARTED',
  SERVICE_STOPPED = 'SERVICE_STOPPED',
  HEALTH_CHECK = 'HEALTH_CHECK',
  CONNECTION_ESTABLISHED = 'CONNECTION_ESTABLISHED',
  CONNECTION_LOST = 'CONNECTION_LOST',
  CONFIG_LOADED = 'CONFIG_LOADED',

  // Report Events
  REPORT_GENERATED = 'REPORT_GENERATED',
  REPORT_SCHEDULED = 'REPORT_SCHEDULED',
  REPORT_SENT = 'REPORT_SENT',
  REPORT_FAILED = 'REPORT_FAILED',

  // Alert Events
  ALERT_TRIGGERED = 'ALERT_TRIGGERED',
  ALERT_RESOLVED = 'ALERT_RESOLVED',
  ALERT_ACKNOWLEDGED = 'ALERT_ACKNOWLEDGED',

  // HTTP Events
  API_CALL = 'API_CALL',
}

// Log Levels
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug',
}

// Log Context Interface
export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  [key: string]: unknown;
}

// Structured Log Entry Interface
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  eventType: LogEventType;
  message: string;
  context?: LogContext;
  metadata?: Record<string, unknown>;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

// Audit Log Entry Interface
export interface AuditLogEntry {
  timestamp: string;
  eventType: LogEventType;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

// Performance Log Entry Interface
export interface PerformanceLogEntry {
  timestamp: string;
  eventType: LogEventType;
  operation: string;
  durationMs: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

// Custom Winston format for structured logging
const structuredFormat = winston.format.printf((info) => {
  const logEntry: LogEntry = {
    timestamp: info.timestamp as string,
    level: info.level as LogLevel,
    eventType: info.eventType as LogEventType || LogEventType.SERVICE_STARTED,
    message: info.message as string,
    context: info.context as LogContext,
    metadata: info.metadata as Record<string, unknown>,
    duration: info.duration as number,
    error: info.error as LogEntry['error'],
  };

  return JSON.stringify(logEntry);
});

// Create Winston logger instance
const winstonLogger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    config.NODE_ENV === 'production' ? structuredFormat : winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp, eventType, context, duration }) => {
        const ts = String(timestamp);
        const et = eventType ? `[${String(eventType)}]` : '';
        const ctx = context ? ` ${JSON.stringify(context)}` : '';
        const dur = duration ? ` (${String(duration)}ms)` : '';
        return `${ts} ${level} ${et}: ${String(message)}${ctx}${dur}`;
      })
    )
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

/**
 * Analytics Logger Class
 * Provides structured logging with event types, audit trails, and performance metrics
 */
export class AnalyticsLogger {
  private context: LogContext = {};

  constructor(context?: LogContext) {
    if (context) {
      this.context = context;
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): AnalyticsLogger {
    const childLogger = new AnalyticsLogger({
      ...this.context,
      ...additionalContext,
    });
    return childLogger;
  }

  /**
   * Set context for the logger
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Log an info message
   */
  info(eventType: LogEventType, message: string, metadata?: Record<string, unknown>): void {
    winstonLogger.info(message, {
      eventType,
      context: this.context,
      metadata,
    });
  }

  /**
   * Log a warning message
   */
  warn(eventType: LogEventType, message: string, metadata?: Record<string, unknown>): void {
    winstonLogger.warn(message, {
      eventType,
      context: this.context,
      metadata,
    });
  }

  /**
   * Log an error message
   */
  error(eventType: LogEventType, message: string, error?: Error, metadata?: Record<string, unknown>): void {
    winstonLogger.error(message, {
      eventType,
      context: this.context,
      metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as { code?: string }).code,
      } : undefined,
    });
  }

  /**
   * Log a debug message
   */
  debug(eventType: LogEventType, message: string, metadata?: Record<string, unknown>): void {
    winstonLogger.debug(message, {
      eventType,
      context: this.context,
      metadata,
    });
  }

  /**
   * Log an HTTP request
   */
  http(eventType: LogEventType, message: string, metadata?: Record<string, unknown>): void {
    winstonLogger.http(message, {
      eventType,
      context: this.context,
      metadata,
    });
  }

  /**
   * Log a query event with timing
   */
  logQuery(
    queryId: string,
    operation: string,
    durationMs: number,
    success: boolean,
    metadata?: Record<string, unknown>
  ): void {
    const eventType = success ? LogEventType.QUERY_COMPLETED : LogEventType.QUERY_FAILED;
    winstonLogger.info(`Query ${operation} ${success ? 'completed' : 'failed'}`, {
      eventType,
      context: this.context,
      duration: durationMs,
      metadata: {
        queryId,
        operation,
        success,
        ...metadata,
      },
    });
  }

  /**
   * Log a metric event
   */
  logMetric(
    metricName: string,
    operation: 'record' | 'update' | 'delete' | 'aggregate',
    metadata?: Record<string, unknown>
  ): void {
    const eventTypeMap = {
      record: LogEventType.METRIC_RECORDED,
      update: LogEventType.METRIC_UPDATED,
      delete: LogEventType.METRIC_DELETED,
      aggregate: LogEventType.METRIC_AGGREGATED,
    };
    winstonLogger.info(`Metric ${operation}: ${metricName}`, {
      eventType: eventTypeMap[operation],
      context: this.context,
      metadata: {
        metricName,
        operation,
        ...metadata,
      },
    });
  }

  /**
   * Log an event tracking event
   */
  logEventTracking(
    eventId: string,
    eventType: string,
    success: boolean,
    metadata?: Record<string, unknown>
  ): void {
    const logEventType = success ? LogEventType.EVENT_TRACKED : LogEventType.EVENT_FAILED;
    winstonLogger.info(`Event ${success ? 'tracked' : 'failed'}: ${eventType}`, {
      eventType: logEventType,
      context: this.context,
      metadata: {
        eventId,
        eventType,
        success,
        ...metadata,
      },
    });
  }

  /**
   * Log a cache event
   */
  logCache(
    operation: 'hit' | 'miss' | 'set' | 'evict' | 'invalidate' | 'error',
    key: string,
    metadata?: Record<string, unknown>
  ): void {
    const eventTypeMap = {
      hit: LogEventType.CACHE_HIT,
      miss: LogEventType.CACHE_MISS,
      set: LogEventType.CACHE_SET,
      evict: LogEventType.CACHE_EVICT,
      invalidate: LogEventType.CACHE_INVALIDATE,
      error: LogEventType.CACHE_ERROR,
    };
    const level = operation === 'error' ? 'warn' : 'debug';
    winstonLogger.log(level, `Cache ${operation}: ${key}`, {
      eventType: eventTypeMap[operation],
      context: this.context,
      metadata: {
        key,
        operation,
        ...metadata,
      },
    });
  }

  /**
   * Log a security event
   */
  logSecurity(
    eventType: LogEventType.AUTH_SUCCESS | LogEventType.AUTH_FAILURE | LogEventType.RATE_LIMIT_HIT | LogEventType.PERMISSION_DENIED | LogEventType.SUSPICIOUS_ACTIVITY | LogEventType.INPUT_SANITIZED,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    const level = eventType === LogEventType.AUTH_SUCCESS ? 'info' : 'warn';
    winstonLogger.log(level, message, {
      eventType,
      context: this.context,
      metadata,
    });
  }

  /**
   * Log an audit event
   */
  logAudit(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    winstonLogger.info(`Audit: ${entry.action} on ${entry.resourceType}`, {
      eventType: entry.eventType,
      context: this.context,
      metadata: {
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        previousState: entry.previousState,
        newState: entry.newState,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        ...entry.metadata,
      },
    });
  }

  /**
   * Log a performance metric
   */
  logPerformance(entry: Omit<PerformanceLogEntry, 'timestamp'>): void {
    winstonLogger.info(`Performance: ${entry.operation}`, {
      eventType: entry.eventType,
      context: this.context,
      duration: entry.durationMs,
      metadata: {
        operation: entry.operation,
        success: entry.success,
        ...entry.metadata,
      },
    });
  }

  /**
   * Log service lifecycle event
   */
  logServiceLifecycle(
    event: 'started' | 'stopped',
    serviceName: string,
    metadata?: Record<string, unknown>
  ): void {
    const eventType = event === 'started' ? LogEventType.SERVICE_STARTED : LogEventType.SERVICE_STOPPED;
    winstonLogger.info(`Service ${event}: ${serviceName}`, {
      eventType,
      context: this.context,
      metadata: {
        serviceName,
        event,
        ...metadata,
      },
    });
  }

  /**
   * Log health check
   */
  logHealthCheck(
    status: 'healthy' | 'degraded' | 'unhealthy',
    checks: Array<{ name: string; status: string; latencyMs?: number }>,
    metadata?: Record<string, unknown>
  ): void {
    const level = status === 'healthy' ? 'info' : status === 'degraded' ? 'warn' : 'error';
    winstonLogger.log(level, `Health check: ${status}`, {
      eventType: LogEventType.HEALTH_CHECK,
      context: this.context,
      metadata: {
        status,
        checks,
        ...metadata,
      },
    });
  }

  /**
   * Log report event
   */
  logReport(
    operation: 'generated' | 'scheduled' | 'sent' | 'failed',
    reportId: string,
    metadata?: Record<string, unknown>
  ): void {
    const eventTypeMap = {
      generated: LogEventType.REPORT_GENERATED,
      scheduled: LogEventType.REPORT_SCHEDULED,
      sent: LogEventType.REPORT_SENT,
      failed: LogEventType.REPORT_FAILED,
    };
    const level = operation === 'failed' ? 'error' : 'info';
    winstonLogger.log(level, `Report ${operation}: ${reportId}`, {
      eventType: eventTypeMap[operation],
      context: this.context,
      metadata: {
        reportId,
        operation,
        ...metadata,
      },
    });
  }

  /**
   * Log alert event
   */
  logAlert(
    operation: 'triggered' | 'resolved' | 'acknowledged',
    alertId: string,
    metadata?: Record<string, unknown>
  ): void {
    const eventTypeMap = {
      triggered: LogEventType.ALERT_TRIGGERED,
      resolved: LogEventType.ALERT_RESOLVED,
      acknowledged: LogEventType.ALERT_ACKNOWLEDGED,
    };
    const level = operation === 'triggered' ? 'warn' : 'info';
    winstonLogger.log(level, `Alert ${operation}: ${alertId}`, {
      eventType: eventTypeMap[operation],
      context: this.context,
      metadata: {
        alertId,
        operation,
        ...metadata,
      },
    });
  }

  /**
   * Create a timer for measuring operation duration
   */
  startTimer(): () => number {
    const start = process.hrtime.bigint();
    return () => {
      const end = process.hrtime.bigint();
      return Number(end - start) / 1_000_000; // Convert to milliseconds
    };
  }
}

// Default logger instance
export const logger = new AnalyticsLogger();

// Export Winston logger for advanced use cases
export { winstonLogger };

export default logger;
