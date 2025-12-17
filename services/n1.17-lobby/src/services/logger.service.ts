import winston from 'winston';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${level}] ${message} ${metaStr}`;
  })
);

export const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: config.serviceName },
  transports: [
    new winston.transports.Console({
      format: config.nodeEnv === 'production' ? logFormat : consoleFormat
    })
  ]
});

export class LoggerService {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, meta?: Record<string, unknown>): void {
    logger.info(message, { context: this.context, ...meta });
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    logger.error(message, { 
      context: this.context, 
      error: error?.message,
      stack: error?.stack,
      ...meta 
    });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    logger.warn(message, { context: this.context, ...meta });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    logger.debug(message, { context: this.context, ...meta });
  }
}
