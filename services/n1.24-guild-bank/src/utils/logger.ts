import winston from 'winston';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
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
      ),
    }),
  ],
});

export function logTransaction(
  action: string,
  transactionId: string,
  userId: string,
  details: Record<string, unknown>
): void {
  logger.info(`Transaction ${action}`, {
    transactionId,
    userId,
    ...details,
  });
}

export function logApproval(
  transactionId: string,
  approverId: string,
  approved: boolean
): void {
  logger.info(`Approval ${approved ? 'granted' : 'denied'}`, {
    transactionId,
    approverId,
    approved,
  });
}

export function logVaultAccess(
  vaultId: string,
  userId: string,
  action: string
): void {
  logger.info(`Vault access: ${action}`, {
    vaultId,
    userId,
  });
}
