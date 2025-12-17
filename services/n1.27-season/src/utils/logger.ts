import winston from 'winston';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    const ts = String(timestamp);
    const lvl = String(level).toUpperCase();
    const msg = String(message);
    if (stack) {
      return `${ts} [${lvl}]: ${msg}\n${String(stack)}`;
    }
    return `${ts} [${lvl}]: ${msg}`;
  })
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: config.NODE_ENV === 'production' ? jsonFormat : logFormat,
  transports: [
    new winston.transports.Console({
      format: config.NODE_ENV === 'production' ? jsonFormat : logFormat,
    }),
  ],
});

export default logger;
