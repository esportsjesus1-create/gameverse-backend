import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const logLevel = process.env.LOG_LEVEL || 'info';
const logFormat = process.env.LOG_FORMAT || 'json';
const logDir = process.env.LOG_DIR || './logs';

const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
    trace: 5,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
    trace: 'gray',
  },
};

winston.addColors(customLevels.colors);

const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

const transports: winston.transport[] = [];

if (process.env.NODE_ENV !== 'test') {
  transports.push(
    new winston.transports.Console({
      format: logFormat === 'json' ? jsonFormat : consoleFormat,
    })
  );

  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      format: jsonFormat,
    })
  );

  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      level: 'error',
      format: jsonFormat,
    })
  );
}

export const logger = winston.createLogger({
  levels: customLevels.levels,
  level: logLevel,
  transports,
  exitOnError: false,
});

if (process.env.NODE_ENV === 'test') {
  logger.silent = true;
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}

export function createChildLogger(context: LogContext): winston.Logger {
  return logger.child(context);
}

export function logRequest(
  method: string,
  url: string,
  statusCode: number,
  duration: number,
  context?: LogContext
): void {
  logger.http('HTTP Request', {
    method,
    url,
    statusCode,
    duration,
    ...context,
  });
}

export function logError(error: Error, context?: LogContext): void {
  logger.error(error.message, {
    stack: error.stack,
    name: error.name,
    ...context,
  });
}

export function logDatabaseQuery(
  query: string,
  duration: number,
  rowCount: number,
  context?: LogContext
): void {
  logger.debug('Database Query', {
    query: query.substring(0, 200),
    duration,
    rowCount,
    ...context,
  });
}

export function logCacheOperation(
  operation: string,
  key: string,
  hit: boolean,
  context?: LogContext
): void {
  logger.debug('Cache Operation', {
    operation,
    key,
    hit,
    ...context,
  });
}

export function logMetric(name: string, value: number, tags?: Record<string, string>): void {
  logger.info('Metric', {
    metric: name,
    value,
    tags,
  });
}

export default logger;
