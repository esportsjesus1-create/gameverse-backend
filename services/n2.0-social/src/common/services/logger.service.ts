import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  operation?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface AuditLogEntry {
  timestamp: string;
  correlationId: string;
  userId: string;
  operation: string;
  targetUserId?: string;
  details?: Record<string, unknown>;
  success: boolean;
  errorCode?: string;
}

@Injectable({ scope: Scope.TRANSIENT })
export class SocialLoggerService implements NestLoggerService {
  private context: string = 'SocialModule';
  private correlationId: string = uuidv4();

  setContext(context: string): void {
    this.context = context;
  }

  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  getCorrelationId(): string {
    return this.correlationId;
  }

  log(message: string, context?: LogContext): void {
    this.writeLog('INFO', message, context);
  }

  error(message: string, trace?: string, context?: LogContext): void {
    this.writeLog('ERROR', message, { ...context, metadata: { ...context?.metadata, trace } });
  }

  warn(message: string, context?: LogContext): void {
    this.writeLog('WARN', message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.writeLog('DEBUG', message, context);
  }

  verbose(message: string, context?: LogContext): void {
    this.writeLog('VERBOSE', message, context);
  }

  logSocialOperation(
    operation: string,
    userId: string,
    targetUserId?: string,
    success: boolean = true,
    details?: Record<string, unknown>,
    errorCode?: string,
  ): void {
    const auditEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId,
      userId,
      operation,
      targetUserId,
      details,
      success,
      errorCode,
    };

    const level = success ? 'INFO' : 'ERROR';
    this.writeLog(level, `Social operation: ${operation}`, {
      correlationId: this.correlationId,
      userId,
      operation,
      metadata: { ...auditEntry } as Record<string, unknown>,
    });
  }

  logFriendRequest(
    action: 'send' | 'accept' | 'reject' | 'cancel',
    requesterId: string,
    addresseeId: string,
    success: boolean = true,
    errorCode?: string,
  ): void {
    this.logSocialOperation(
      `friend_request_${action}`,
      requesterId,
      addresseeId,
      success,
      { action },
      errorCode,
    );
  }

  logFriendshipChange(
    action: 'add' | 'remove',
    userId1: string,
    userId2: string,
    success: boolean = true,
    errorCode?: string,
  ): void {
    this.logSocialOperation(
      `friendship_${action}`,
      userId1,
      userId2,
      success,
      { action },
      errorCode,
    );
  }

  logBlockAction(
    action: 'block' | 'unblock',
    blockerId: string,
    blockedId: string,
    success: boolean = true,
    errorCode?: string,
  ): void {
    this.logSocialOperation(
      `user_${action}`,
      blockerId,
      blockedId,
      success,
      { action },
      errorCode,
    );
  }

  logProfileUpdate(
    userId: string,
    fields: string[],
    success: boolean = true,
    errorCode?: string,
  ): void {
    this.logSocialOperation(
      'profile_update',
      userId,
      undefined,
      success,
      { updatedFields: fields },
      errorCode,
    );
  }

  logPresenceChange(
    userId: string,
    status: string,
    success: boolean = true,
    errorCode?: string,
  ): void {
    this.logSocialOperation(
      'presence_change',
      userId,
      undefined,
      success,
      { newStatus: status },
      errorCode,
    );
  }

  logQueryPerformance(
    queryName: string,
    durationMs: number,
    rowCount?: number,
  ): void {
    const level = durationMs > 1000 ? 'WARN' : 'DEBUG';
    this.writeLog(level, `Query performance: ${queryName}`, {
      correlationId: this.correlationId,
      operation: queryName,
      duration: durationMs,
      metadata: { rowCount, slow: durationMs > 1000 },
    });
  }

  private writeLog(level: string, message: string, context?: LogContext): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      correlationId: context?.correlationId || this.correlationId,
      userId: context?.userId,
      operation: context?.operation,
      duration: context?.duration,
      message,
      ...context?.metadata,
    };

    const cleanedEntry = Object.fromEntries(
      Object.entries(logEntry).filter(([, v]) => v !== undefined),
    );

    console.log(JSON.stringify(cleanedEntry));
  }
}
