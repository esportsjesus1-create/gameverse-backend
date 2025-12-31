import winston from 'winston';
import { config } from '../config';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

export enum EventType {
  LEADERBOARD_CREATED = 'LEADERBOARD_CREATED',
  LEADERBOARD_UPDATED = 'LEADERBOARD_UPDATED',
  LEADERBOARD_DELETED = 'LEADERBOARD_DELETED',
  LEADERBOARD_RESET = 'LEADERBOARD_RESET',
  LEADERBOARD_LOCKED = 'LEADERBOARD_LOCKED',
  LEADERBOARD_UNLOCKED = 'LEADERBOARD_UNLOCKED',
  LEADERBOARD_SNAPSHOT_CREATED = 'LEADERBOARD_SNAPSHOT_CREATED',
  
  ENTRY_CREATED = 'ENTRY_CREATED',
  ENTRY_UPDATED = 'ENTRY_UPDATED',
  ENTRY_DELETED = 'ENTRY_DELETED',
  ENTRY_RANK_CHANGED = 'ENTRY_RANK_CHANGED',
  ENTRY_TIER_CHANGED = 'ENTRY_TIER_CHANGED',
  
  SCORE_SUBMITTED = 'SCORE_SUBMITTED',
  SCORE_VALIDATED = 'SCORE_VALIDATED',
  SCORE_APPROVED = 'SCORE_APPROVED',
  SCORE_REJECTED = 'SCORE_REJECTED',
  SCORE_DISPUTED = 'SCORE_DISPUTED',
  SCORE_ROLLED_BACK = 'SCORE_ROLLED_BACK',
  BATCH_SCORE_SUBMITTED = 'BATCH_SCORE_SUBMITTED',
  
  RANK_PROMOTION = 'RANK_PROMOTION',
  RANK_DEMOTION = 'RANK_DEMOTION',
  RANK_DECAY_STARTED = 'RANK_DECAY_STARTED',
  RANK_DECAY_APPLIED = 'RANK_DECAY_APPLIED',
  RANK_DECAY_PREVENTED = 'RANK_DECAY_PREVENTED',
  
  PLAYER_BANNED = 'PLAYER_BANNED',
  PLAYER_UNBANNED = 'PLAYER_UNBANNED',
  PLAYER_SUSPENDED = 'PLAYER_SUSPENDED',
  PLAYER_UNSUSPENDED = 'PLAYER_UNSUSPENDED',
  
  ANTI_CHEAT_TRIGGERED = 'ANTI_CHEAT_TRIGGERED',
  ANTI_CHEAT_CLEARED = 'ANTI_CHEAT_CLEARED',
  SUSPICIOUS_ACTIVITY_DETECTED = 'SUSPICIOUS_ACTIVITY_DETECTED',
  
  CACHE_HIT = 'CACHE_HIT',
  CACHE_MISS = 'CACHE_MISS',
  CACHE_SET = 'CACHE_SET',
  CACHE_INVALIDATED = 'CACHE_INVALIDATED',
  CACHE_ERROR = 'CACHE_ERROR',
  
  WEBSOCKET_CONNECTED = 'WEBSOCKET_CONNECTED',
  WEBSOCKET_DISCONNECTED = 'WEBSOCKET_DISCONNECTED',
  WEBSOCKET_SUBSCRIBED = 'WEBSOCKET_SUBSCRIBED',
  WEBSOCKET_UNSUBSCRIBED = 'WEBSOCKET_UNSUBSCRIBED',
  WEBSOCKET_MESSAGE_SENT = 'WEBSOCKET_MESSAGE_SENT',
  WEBSOCKET_ERROR = 'WEBSOCKET_ERROR',
  
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  RATE_LIMIT_WARNING = 'RATE_LIMIT_WARNING',
  
  QUERY_EXECUTED = 'QUERY_EXECUTED',
  QUERY_SLOW = 'QUERY_SLOW',
  QUERY_TIMEOUT = 'QUERY_TIMEOUT',
  
  API_REQUEST = 'API_REQUEST',
  API_RESPONSE = 'API_RESPONSE',
  API_ERROR = 'API_ERROR',
  
  FRIEND_CHALLENGE_CREATED = 'FRIEND_CHALLENGE_CREATED',
  FRIEND_CHALLENGE_COMPLETED = 'FRIEND_CHALLENGE_COMPLETED',
  FRIEND_CHALLENGE_EXPIRED = 'FRIEND_CHALLENGE_EXPIRED',
  
  SEASON_STARTED = 'SEASON_STARTED',
  SEASON_ENDED = 'SEASON_ENDED',
  SEASON_REWARDS_DISTRIBUTED = 'SEASON_REWARDS_DISTRIBUTED',
  
  HEALTH_CHECK = 'HEALTH_CHECK',
  SERVICE_STARTED = 'SERVICE_STARTED',
  SERVICE_STOPPED = 'SERVICE_STOPPED',
  
  ADMIN_ACTION = 'ADMIN_ACTION',
  AUDIT_LOG_CREATED = 'AUDIT_LOG_CREATED',
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  playerId?: string;
  leaderboardId?: string;
  seasonId?: string;
  gameId?: string;
  region?: string;
  ip?: string;
  userAgent?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface StructuredLog {
  level: LogLevel;
  eventType: EventType;
  message: string;
  context?: LogContext;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  timestamp: string;
  service: string;
  version: string;
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    const ts = String(timestamp);
    const lvl = String(level).toUpperCase();
    const msg = String(message);
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    if (stack) {
      return `${ts} [${lvl}]: ${msg}${metaStr}\n${String(stack)}`;
    }
    return `${ts} [${lvl}]: ${msg}${metaStr}`;
  })
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const winstonLogger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: config.NODE_ENV === 'production' ? jsonFormat : logFormat,
  defaultMeta: {
    service: 'gameverse-leaderboard',
    version: '1.0.0',
  },
  transports: [
    new winston.transports.Console({
      format: config.NODE_ENV === 'production' ? jsonFormat : logFormat,
    }),
  ],
});

class Logger {
  private static instance: Logger;
  private requestContext: Map<string, LogContext> = new Map();

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setRequestContext(requestId: string, context: LogContext): void {
    this.requestContext.set(requestId, context);
  }

  public clearRequestContext(requestId: string): void {
    this.requestContext.delete(requestId);
  }

  public getRequestContext(requestId: string): LogContext | undefined {
    return this.requestContext.get(requestId);
  }

  private formatLog(
    level: LogLevel,
    eventType: EventType,
    message: string,
    context?: LogContext,
    data?: Record<string, unknown>,
    error?: Error
  ): StructuredLog {
    const log: StructuredLog = {
      level,
      eventType,
      message,
      timestamp: new Date().toISOString(),
      service: 'gameverse-leaderboard',
      version: '1.0.0',
    };

    if (context) {
      log.context = context;
    }

    if (data) {
      log.data = data;
    }

    if (error) {
      log.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as { code?: string }).code,
      };
    }

    return log;
  }

  public info(
    eventType: EventType,
    message: string,
    context?: LogContext,
    data?: Record<string, unknown>
  ): void {
    const log = this.formatLog(LogLevel.INFO, eventType, message, context, data);
    winstonLogger.info(message, log);
  }

  public warn(
    eventType: EventType,
    message: string,
    context?: LogContext,
    data?: Record<string, unknown>
  ): void {
    const log = this.formatLog(LogLevel.WARN, eventType, message, context, data);
    winstonLogger.warn(message, log);
  }

  public error(
    eventType: EventType,
    message: string,
    error?: Error,
    context?: LogContext,
    data?: Record<string, unknown>
  ): void {
    const log = this.formatLog(LogLevel.ERROR, eventType, message, context, data, error);
    winstonLogger.error(message, log);
  }

  public debug(
    eventType: EventType,
    message: string,
    context?: LogContext,
    data?: Record<string, unknown>
  ): void {
    const log = this.formatLog(LogLevel.DEBUG, eventType, message, context, data);
    winstonLogger.debug(message, log);
  }

  public verbose(
    eventType: EventType,
    message: string,
    context?: LogContext,
    data?: Record<string, unknown>
  ): void {
    const log = this.formatLog(LogLevel.VERBOSE, eventType, message, context, data);
    winstonLogger.verbose(message, log);
  }

  public logLeaderboardCreated(leaderboardId: string, name: string, context?: LogContext): void {
    this.info(EventType.LEADERBOARD_CREATED, `Leaderboard created: ${name}`, {
      ...context,
      leaderboardId,
    });
  }

  public logLeaderboardUpdated(leaderboardId: string, changes: Record<string, unknown>, context?: LogContext): void {
    this.info(EventType.LEADERBOARD_UPDATED, `Leaderboard updated: ${leaderboardId}`, {
      ...context,
      leaderboardId,
    }, { changes });
  }

  public logLeaderboardReset(leaderboardId: string, entriesAffected: number, context?: LogContext): void {
    this.info(EventType.LEADERBOARD_RESET, `Leaderboard reset: ${leaderboardId}`, {
      ...context,
      leaderboardId,
    }, { entriesAffected });
  }

  public logScoreSubmitted(
    playerId: string,
    leaderboardId: string,
    score: number,
    context?: LogContext
  ): void {
    this.info(EventType.SCORE_SUBMITTED, `Score submitted: ${score} by player ${playerId}`, {
      ...context,
      playerId,
      leaderboardId,
    }, { score });
  }

  public logScoreValidated(submissionId: string, isValid: boolean, context?: LogContext): void {
    this.info(EventType.SCORE_VALIDATED, `Score validation: ${isValid ? 'passed' : 'failed'}`, {
      ...context,
    }, { submissionId, isValid });
  }

  public logScoreRejected(submissionId: string, reason: string, context?: LogContext): void {
    this.warn(EventType.SCORE_REJECTED, `Score rejected: ${reason}`, {
      ...context,
    }, { submissionId, reason });
  }

  public logRankChange(
    playerId: string,
    leaderboardId: string,
    oldRank: number,
    newRank: number,
    context?: LogContext
  ): void {
    const eventType = newRank < oldRank ? EventType.RANK_PROMOTION : EventType.RANK_DEMOTION;
    this.info(eventType, `Rank changed: ${oldRank} -> ${newRank}`, {
      ...context,
      playerId,
      leaderboardId,
    }, { oldRank, newRank, change: oldRank - newRank });
  }

  public logTierChange(
    playerId: string,
    oldTier: string,
    newTier: string,
    context?: LogContext
  ): void {
    this.info(EventType.ENTRY_TIER_CHANGED, `Tier changed: ${oldTier} -> ${newTier}`, {
      ...context,
      playerId,
    }, { oldTier, newTier });
  }

  public logAntiCheatTriggered(
    playerId: string,
    violationType: string,
    details: Record<string, unknown>,
    context?: LogContext
  ): void {
    this.warn(EventType.ANTI_CHEAT_TRIGGERED, `Anti-cheat triggered for player ${playerId}`, {
      ...context,
      playerId,
    }, { violationType, ...details });
  }

  public logCacheHit(key: string, context?: LogContext): void {
    this.debug(EventType.CACHE_HIT, `Cache hit: ${key}`, context);
  }

  public logCacheMiss(key: string, context?: LogContext): void {
    this.debug(EventType.CACHE_MISS, `Cache miss: ${key}`, context);
  }

  public logCacheSet(key: string, ttl: number, context?: LogContext): void {
    this.debug(EventType.CACHE_SET, `Cache set: ${key} (TTL: ${ttl}s)`, context, { ttl });
  }

  public logCacheInvalidated(keys: string[], context?: LogContext): void {
    this.debug(EventType.CACHE_INVALIDATED, `Cache invalidated: ${keys.length} keys`, context, { keys });
  }

  public logWebSocketConnected(connectionId: string, playerId?: string, context?: LogContext): void {
    this.info(EventType.WEBSOCKET_CONNECTED, `WebSocket connected: ${connectionId}`, {
      ...context,
      playerId,
    }, { connectionId });
  }

  public logWebSocketDisconnected(connectionId: string, reason?: string, context?: LogContext): void {
    this.info(EventType.WEBSOCKET_DISCONNECTED, `WebSocket disconnected: ${connectionId}`, context, {
      connectionId,
      reason,
    });
  }

  public logWebSocketSubscribed(
    connectionId: string,
    leaderboardIds: string[],
    context?: LogContext
  ): void {
    this.info(EventType.WEBSOCKET_SUBSCRIBED, `WebSocket subscribed to ${leaderboardIds.length} leaderboards`, context, {
      connectionId,
      leaderboardIds,
    });
  }

  public logRateLimitExceeded(
    playerId: string,
    endpoint: string,
    limit: number,
    context?: LogContext
  ): void {
    this.warn(EventType.RATE_LIMIT_EXCEEDED, `Rate limit exceeded for player ${playerId}`, {
      ...context,
      playerId,
    }, { endpoint, limit });
  }

  public logQueryExecuted(
    queryType: string,
    duration: number,
    context?: LogContext
  ): void {
    const eventType = duration > 100 ? EventType.QUERY_SLOW : EventType.QUERY_EXECUTED;
    this.debug(eventType, `Query executed: ${queryType} (${duration}ms)`, {
      ...context,
      duration,
    }, { queryType });
  }

  public logApiRequest(
    method: string,
    path: string,
    context?: LogContext
  ): void {
    this.info(EventType.API_REQUEST, `${method} ${path}`, context);
  }

  public logApiResponse(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    this.info(EventType.API_RESPONSE, `${method} ${path} ${statusCode} (${duration}ms)`, {
      ...context,
      duration,
    }, { statusCode });
  }

  public logApiError(
    method: string,
    path: string,
    error: Error,
    context?: LogContext
  ): void {
    this.error(EventType.API_ERROR, `${method} ${path} failed`, error, context);
  }

  public logAdminAction(
    adminId: string,
    action: string,
    target: string,
    details: Record<string, unknown>,
    context?: LogContext
  ): void {
    this.info(EventType.ADMIN_ACTION, `Admin action: ${action} on ${target}`, {
      ...context,
      userId: adminId,
    }, { action, target, ...details });
  }

  public logHealthCheck(status: 'healthy' | 'unhealthy', details: Record<string, unknown>): void {
    const eventType = EventType.HEALTH_CHECK;
    if (status === 'healthy') {
      this.info(eventType, 'Health check passed', undefined, details);
    } else {
      this.warn(eventType, 'Health check failed', undefined, details);
    }
  }

  public logServiceStarted(port: number): void {
    this.info(EventType.SERVICE_STARTED, `Leaderboard service started on port ${port}`, undefined, { port });
  }

  public logServiceStopped(reason?: string): void {
    this.info(EventType.SERVICE_STOPPED, `Leaderboard service stopped${reason ? `: ${reason}` : ''}`, undefined, { reason });
  }
}

export const logger = Logger.getInstance();
export default logger;
