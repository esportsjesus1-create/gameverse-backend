import winston from 'winston';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { level, message, timestamp, stack } = info;
    const ts = String(timestamp);
    const msg = String(message);
    const lvl = String(level).toUpperCase();
    if (stack) {
      return `${ts} [${lvl}]: ${msg}\n${String(stack)}`;
    }
    return `${ts} [${lvl}]: ${msg}`;
  })
);

export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ]
});

export default logger;
