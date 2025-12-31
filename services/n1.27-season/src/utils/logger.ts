import winston from 'winston';
import { config } from '../config';

/**
 * Log context interface for structured logging.
 */
export interface LogContext {
  seasonId?: string;
  playerId?: string;
  actorId?: string;
  operation?: string;
  duration?: number;
  [key: string]: unknown;
}

/**
 * Season event types for monitoring.
 */
export enum SeasonLogEvent {
  SEASON_CREATED = 'season.created',
  SEASON_ACTIVATED = 'season.activated',
  SEASON_PAUSED = 'season.paused',
  SEASON_RESUMED = 'season.resumed',
  SEASON_ENDED = 'season.ended',
  SEASON_EXTENDED = 'season.extended',
  SEASON_TERMINATED = 'season.terminated',
  SEASON_ARCHIVED = 'season.archived',
  SEASON_TRANSITION = 'season.transition',
  PLAYER_REGISTERED = 'player.registered',
  PLAYER_MMR_UPDATED = 'player.mmr_updated',
  PLAYER_TIER_CHANGED = 'player.tier_changed',
  PLAYER_PLACEMENT_COMPLETE = 'player.placement_complete',
  PLAYER_PROMO_STARTED = 'player.promo_started',
  PLAYER_PROMO_COMPLETED = 'player.promo_completed',
  REWARD_CREATED = 'reward.created',
  REWARD_DISTRIBUTED = 'reward.distributed',
  REWARD_CLAIMED = 'reward.claimed',
  MILESTONE_ACHIEVED = 'milestone.achieved',
  CHALLENGE_CREATED = 'challenge.created',
  CHALLENGE_COMPLETED = 'challenge.completed',
  LEADERBOARD_UPDATED = 'leaderboard.updated',
  CACHE_HIT = 'cache.hit',
  CACHE_MISS = 'cache.miss',
  CACHE_INVALIDATED = 'cache.invalidated',
  API_REQUEST = 'api.request',
  API_RESPONSE = 'api.response',
  API_ERROR = 'api.error',
  DATABASE_QUERY = 'database.query',
  DATABASE_ERROR = 'database.error',
  HEALTH_CHECK = 'health.check',
  AUDIT_LOG = 'audit.log',
}

/**
 * Metrics collector for monitoring season module performance.
 */
class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  /**
   * Increment a counter metric.
   */
  public increment(name: string, value = 1, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * Record a histogram value (e.g., latency).
   */
  public recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    const values = this.histograms.get(key) || [];
    values.push(value);
    if (values.length > 1000) {
      values.shift();
    }
    this.histograms.set(key, values);
  }

  /**
   * Get current counter value.
   */
  public getCounter(name: string, tags?: Record<string, string>): number {
    const key = this.buildKey(name, tags);
    return this.counters.get(key) || 0;
  }

  /**
   * Get histogram statistics.
   */
  public getHistogramStats(name: string, tags?: Record<string, string>): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const key = this.buildKey(name, tags);
    const values = this.histograms.get(key);
    if (!values || values.length === 0) {
      return null;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      avg: sorted.reduce((a, b) => a + b, 0) / count,
      p50: sorted[Math.floor(count * 0.5)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
    };
  }

  /**
   * Reset all metrics.
   */
  public reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }

  /**
   * Get all metrics as a snapshot.
   */
  public getSnapshot(): {
    counters: Record<string, number>;
    histograms: Record<string, ReturnType<MetricsCollector['getHistogramStats']>>;
  } {
    const counters: Record<string, number> = {};
    const histograms: Record<string, ReturnType<MetricsCollector['getHistogramStats']>> = {};
    
    this.counters.forEach((value, key) => {
      counters[key] = value;
    });
    
    this.histograms.forEach((_, key) => {
      histograms[key] = this.getHistogramStats(key);
    });
    
    return { counters, histograms };
  }

  private buildKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name;
    }
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${tagStr}}`;
  }
}

export const metrics = new MetricsCollector();

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
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

const baseLogger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: config.NODE_ENV === 'production' ? jsonFormat : logFormat,
  defaultMeta: { service: 'gameverse-season' },
  transports: [
    new winston.transports.Console({
      format: config.NODE_ENV === 'production' ? jsonFormat : logFormat,
    }),
  ],
});

/**
 * Enhanced logger with structured logging and metrics support.
 */
class SeasonLogger {
  private winstonLogger: winston.Logger;

  constructor(winstonLogger: winston.Logger) {
    this.winstonLogger = winstonLogger;
  }

  /**
   * Log an info message with optional context.
   */
  public info(message: string, context?: LogContext): void {
    this.winstonLogger.info(message, context);
  }

  /**
   * Log a warning message with optional context.
   */
  public warn(message: string, context?: LogContext): void {
    this.winstonLogger.warn(message, context);
  }

  /**
   * Log an error message with optional context.
   */
  public error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (error instanceof Error) {
      this.winstonLogger.error(message, { ...context, error: error.message, stack: error.stack });
    } else {
      this.winstonLogger.error(message, { ...context, error: String(error) });
    }
  }

  /**
   * Log a debug message with optional context.
   */
  public debug(message: string, context?: LogContext): void {
    this.winstonLogger.debug(message, context);
  }

  /**
   * Log a season event with structured data and metrics.
   */
  public logEvent(event: SeasonLogEvent, message: string, context?: LogContext): void {
    metrics.increment(`season.events.${event}`);
    this.winstonLogger.info(message, { event, ...context });
  }

  /**
   * Log an API request with timing.
   */
  public logApiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    metrics.increment('api.requests.total', 1, { method, path: this.normalizePath(path) });
    metrics.increment(`api.requests.status.${statusCode}`, 1);
    metrics.recordHistogram('api.request.duration', duration, { method });
    
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.winstonLogger.log(level, `${method} ${path} ${statusCode} ${duration}ms`, {
      event: SeasonLogEvent.API_REQUEST,
      method,
      path,
      statusCode,
      duration,
      ...context,
    });
  }

  /**
   * Log a database query with timing.
   */
  public logDatabaseQuery(operation: string, table: string, duration: number, context?: LogContext): void {
    metrics.increment('database.queries.total', 1, { operation, table });
    metrics.recordHistogram('database.query.duration', duration, { operation });
    
    this.winstonLogger.debug(`Database ${operation} on ${table} took ${duration}ms`, {
      event: SeasonLogEvent.DATABASE_QUERY,
      operation,
      table,
      duration,
      ...context,
    });
  }

  /**
   * Log a cache operation.
   */
  public logCacheOperation(operation: 'hit' | 'miss' | 'set' | 'invalidate', key: string, context?: LogContext): void {
    metrics.increment(`cache.${operation}`, 1);
    
    const event = operation === 'hit' ? SeasonLogEvent.CACHE_HIT :
                  operation === 'miss' ? SeasonLogEvent.CACHE_MISS :
                  SeasonLogEvent.CACHE_INVALIDATED;
    
    this.winstonLogger.debug(`Cache ${operation}: ${key}`, { event, key, ...context });
  }

  /**
   * Log a season lifecycle event.
   */
  public logSeasonEvent(
    event: SeasonLogEvent,
    seasonId: string,
    message: string,
    context?: LogContext
  ): void {
    metrics.increment('season.lifecycle.events', 1, { event });
    this.winstonLogger.info(message, { event, seasonId, ...context });
  }

  /**
   * Log a player event.
   */
  public logPlayerEvent(
    event: SeasonLogEvent,
    playerId: string,
    seasonId: string,
    message: string,
    context?: LogContext
  ): void {
    metrics.increment('player.events', 1, { event });
    this.winstonLogger.info(message, { event, playerId, seasonId, ...context });
  }

  /**
   * Log a reward event.
   */
  public logRewardEvent(
    event: SeasonLogEvent,
    seasonId: string,
    message: string,
    context?: LogContext
  ): void {
    metrics.increment('reward.events', 1, { event });
    this.winstonLogger.info(message, { event, seasonId, ...context });
  }

  /**
   * Create a child logger with preset context.
   */
  public child(context: LogContext): SeasonLogger {
    const childWinston = this.winstonLogger.child(context);
    return new SeasonLogger(childWinston);
  }

  /**
   * Measure and log the duration of an async operation.
   */
  public async measureAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      metrics.recordHistogram('operation.duration', duration, { operation });
      this.debug(`${operation} completed in ${duration}ms`, { ...context, duration, operation });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      metrics.increment('operation.errors', 1, { operation });
      this.error(`${operation} failed after ${duration}ms`, error, { ...context, duration, operation });
      throw error;
    }
  }

  private normalizePath(path: string): string {
    return path
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\/\d+/g, '/:num');
  }
}

export const logger = new SeasonLogger(baseLogger);

export default logger;
