import { Logger } from '@nestjs/common';

/**
 * Tournament event types for structured logging
 */
export enum TournamentEventType {
  TOURNAMENT_CREATED = 'TOURNAMENT_CREATED',
  TOURNAMENT_UPDATED = 'TOURNAMENT_UPDATED',
  TOURNAMENT_STATUS_CHANGED = 'TOURNAMENT_STATUS_CHANGED',
  TOURNAMENT_DELETED = 'TOURNAMENT_DELETED',
  REGISTRATION_CREATED = 'REGISTRATION_CREATED',
  REGISTRATION_CANCELLED = 'REGISTRATION_CANCELLED',
  REGISTRATION_CHECKED_IN = 'REGISTRATION_CHECKED_IN',
  BRACKET_GENERATED = 'BRACKET_GENERATED',
  BRACKET_RESEEDED = 'BRACKET_RESEEDED',
  MATCH_SCHEDULED = 'MATCH_SCHEDULED',
  MATCH_STARTED = 'MATCH_STARTED',
  MATCH_RESULT_SUBMITTED = 'MATCH_RESULT_SUBMITTED',
  MATCH_RESULT_CONFIRMED = 'MATCH_RESULT_CONFIRMED',
  MATCH_DISPUTED = 'MATCH_DISPUTED',
  MATCH_DISPUTE_RESOLVED = 'MATCH_DISPUTE_RESOLVED',
  MATCH_ADMIN_OVERRIDE = 'MATCH_ADMIN_OVERRIDE',
  PARTICIPANT_DISQUALIFIED = 'PARTICIPANT_DISQUALIFIED',
  PRIZE_CALCULATED = 'PRIZE_CALCULATED',
  PRIZE_DISTRIBUTED = 'PRIZE_DISTRIBUTED',
  LEADERBOARD_UPDATED = 'LEADERBOARD_UPDATED',
  SECURITY_ALERT = 'SECURITY_ALERT',
  PERFORMANCE_WARNING = 'PERFORMANCE_WARNING',
}

/**
 * Structured log entry for tournament events
 */
export interface TournamentLogEntry {
  eventType: TournamentEventType;
  tournamentId?: string;
  participantId?: string;
  matchId?: string;
  bracketId?: string;
  prizeId?: string;
  adminId?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  duration?: number;
}

/**
 * Tournament Logger utility for structured logging and audit trails
 * Provides consistent logging format across all tournament operations
 */
export class TournamentLogger {
  private readonly logger: Logger;
  private readonly serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.logger = new Logger(serviceName);
  }

  /**
   * Log a tournament event with structured data
   */
  logEvent(entry: Omit<TournamentLogEntry, 'timestamp'>): void {
    const logEntry: TournamentLogEntry = {
      ...entry,
      timestamp: new Date(),
    };

    const message = this.formatLogMessage(logEntry);
    this.logger.log(message);
  }

  /**
   * Log an error with context
   */
  logError(
    eventType: TournamentEventType,
    error: Error,
    context?: Partial<TournamentLogEntry>,
  ): void {
    const logEntry: TournamentLogEntry = {
      eventType,
      ...context,
      metadata: {
        ...context?.metadata,
        errorMessage: error.message,
        errorStack: error.stack,
      },
      timestamp: new Date(),
    };

    const message = this.formatLogMessage(logEntry);
    this.logger.error(message, error.stack);
  }

  /**
   * Log a warning
   */
  logWarning(
    eventType: TournamentEventType,
    message: string,
    context?: Partial<TournamentLogEntry>,
  ): void {
    const logEntry: TournamentLogEntry = {
      eventType,
      ...context,
      metadata: {
        ...context?.metadata,
        warningMessage: message,
      },
      timestamp: new Date(),
    };

    const formattedMessage = this.formatLogMessage(logEntry);
    this.logger.warn(formattedMessage);
  }

  /**
   * Log a security alert
   */
  logSecurityAlert(
    alertType: string,
    details: Record<string, unknown>,
    context?: Partial<TournamentLogEntry>,
  ): void {
    const logEntry: TournamentLogEntry = {
      eventType: TournamentEventType.SECURITY_ALERT,
      ...context,
      metadata: {
        ...context?.metadata,
        alertType,
        alertDetails: details,
      },
      timestamp: new Date(),
    };

    const message = this.formatLogMessage(logEntry);
    this.logger.warn(`[SECURITY] ${message}`);
  }

  /**
   * Log performance metrics
   */
  logPerformance(
    operation: string,
    durationMs: number,
    context?: Partial<TournamentLogEntry>,
  ): void {
    const isSlowOperation = durationMs > 1000;
    const logEntry: TournamentLogEntry = {
      eventType: isSlowOperation
        ? TournamentEventType.PERFORMANCE_WARNING
        : TournamentEventType.TOURNAMENT_UPDATED,
      ...context,
      metadata: {
        ...context?.metadata,
        operation,
        durationMs,
      },
      duration: durationMs,
      timestamp: new Date(),
    };

    const message = this.formatLogMessage(logEntry);
    if (isSlowOperation) {
      this.logger.warn(`[SLOW] ${message}`);
    } else {
      this.logger.debug(message);
    }
  }

  /**
   * Create a timer for measuring operation duration
   */
  startTimer(): () => number {
    const startTime = Date.now();
    return () => Date.now() - startTime;
  }

  /**
   * Log audit trail for admin actions
   */
  logAuditTrail(
    action: string,
    adminId: string,
    targetId: string,
    targetType: 'tournament' | 'match' | 'registration' | 'prize',
    details?: Record<string, unknown>,
  ): void {
    const logEntry: TournamentLogEntry = {
      eventType: TournamentEventType.MATCH_ADMIN_OVERRIDE,
      adminId,
      metadata: {
        action,
        targetId,
        targetType,
        ...details,
      },
      timestamp: new Date(),
    };

    const message = this.formatLogMessage(logEntry);
    this.logger.log(`[AUDIT] ${message}`);
  }

  private formatLogMessage(entry: TournamentLogEntry): string {
    const parts: string[] = [
      `[${entry.eventType}]`,
      entry.tournamentId ? `tournament=${entry.tournamentId}` : '',
      entry.participantId ? `participant=${entry.participantId}` : '',
      entry.matchId ? `match=${entry.matchId}` : '',
      entry.bracketId ? `bracket=${entry.bracketId}` : '',
      entry.prizeId ? `prize=${entry.prizeId}` : '',
      entry.adminId ? `admin=${entry.adminId}` : '',
      entry.duration ? `duration=${entry.duration}ms` : '',
      entry.metadata ? `metadata=${JSON.stringify(entry.metadata)}` : '',
    ];

    return parts.filter(Boolean).join(' ');
  }
}

/**
 * Create a logger instance for a service
 */
export function createTournamentLogger(serviceName: string): TournamentLogger {
  return new TournamentLogger(serviceName);
}
