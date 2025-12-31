/**
 * GameVerse Analytics Module - Rate Limiting Middleware
 * 3-tier rate limiting (basic, standard, premium)
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger, LogEventType } from '../utils/logger';
import { RateLimitError, AnalyticsErrorCode } from '../utils/errors';
import { UserTier, RateLimitConfig, RateLimitState } from '../types';

// Rate limit configurations by tier
const RATE_LIMIT_CONFIGS: Record<UserTier, RateLimitConfig> = {
  [UserTier.BASIC]: {
    tier: UserTier.BASIC,
    requestsPerMinute: config.RATE_LIMIT_BASIC_RPM,
    requestsPerHour: config.RATE_LIMIT_BASIC_RPH,
    requestsPerDay: config.RATE_LIMIT_BASIC_RPD,
    burstLimit: config.RATE_LIMIT_BASIC_RPM * config.RATE_LIMIT_BURST_MULTIPLIER,
  },
  [UserTier.STANDARD]: {
    tier: UserTier.STANDARD,
    requestsPerMinute: config.RATE_LIMIT_STANDARD_RPM,
    requestsPerHour: config.RATE_LIMIT_STANDARD_RPH,
    requestsPerDay: config.RATE_LIMIT_STANDARD_RPD,
    burstLimit: config.RATE_LIMIT_STANDARD_RPM * config.RATE_LIMIT_BURST_MULTIPLIER,
  },
  [UserTier.PREMIUM]: {
    tier: UserTier.PREMIUM,
    requestsPerMinute: config.RATE_LIMIT_PREMIUM_RPM,
    requestsPerHour: config.RATE_LIMIT_PREMIUM_RPH,
    requestsPerDay: config.RATE_LIMIT_PREMIUM_RPD,
    burstLimit: config.RATE_LIMIT_PREMIUM_RPM * config.RATE_LIMIT_BURST_MULTIPLIER,
  },
};

// In-memory rate limit state storage
const rateLimitStates: Map<string, RateLimitState> = new Map();

// Time window constants
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Get or create rate limit state for a user
 */
function getRateLimitState(userId: string, tier: UserTier): RateLimitState {
  const existing = rateLimitStates.get(userId);
  const now = new Date();

  if (existing) {
    // Reset counters if windows have expired
    const windowStart = existing.windowStart.getTime();
    const nowMs = now.getTime();

    if (nowMs - windowStart >= DAY_MS) {
      // Reset all counters for new day
      return {
        userId,
        tier,
        minuteCount: 0,
        hourCount: 0,
        dayCount: 0,
        lastRequestAt: now,
        windowStart: now,
      };
    }

    if (nowMs - windowStart >= HOUR_MS) {
      // Reset minute and hour counters
      existing.minuteCount = 0;
      existing.hourCount = 0;
    } else if (nowMs - windowStart >= MINUTE_MS) {
      // Reset minute counter
      existing.minuteCount = 0;
    }

    return existing;
  }

  // Create new state
  const newState: RateLimitState = {
    userId,
    tier,
    minuteCount: 0,
    hourCount: 0,
    dayCount: 0,
    lastRequestAt: now,
    windowStart: now,
  };

  rateLimitStates.set(userId, newState);
  return newState;
}

/**
 * Check if rate limit is exceeded
 */
function checkRateLimit(
  state: RateLimitState,
  config: RateLimitConfig
): { exceeded: boolean; retryAfter?: number; errorCode?: AnalyticsErrorCode } {
  // Check burst limit (short-term spike protection)
  if (state.minuteCount >= config.burstLimit) {
    return {
      exceeded: true,
      retryAfter: 60,
      errorCode: AnalyticsErrorCode.RATE_LIMIT_BURST_EXCEEDED,
    };
  }

  // Check minute limit
  if (state.minuteCount >= config.requestsPerMinute) {
    return {
      exceeded: true,
      retryAfter: 60,
      errorCode: state.tier === UserTier.BASIC
        ? AnalyticsErrorCode.RATE_LIMIT_EXCEEDED_BASIC
        : state.tier === UserTier.STANDARD
          ? AnalyticsErrorCode.RATE_LIMIT_EXCEEDED_STANDARD
          : AnalyticsErrorCode.RATE_LIMIT_EXCEEDED_PREMIUM,
    };
  }

  // Check hour limit
  if (state.hourCount >= config.requestsPerHour) {
    return {
      exceeded: true,
      retryAfter: 3600,
      errorCode: AnalyticsErrorCode.RATE_LIMIT_QUOTA_EXHAUSTED,
    };
  }

  // Check day limit
  if (state.dayCount >= config.requestsPerDay) {
    return {
      exceeded: true,
      retryAfter: 86400,
      errorCode: AnalyticsErrorCode.RATE_LIMIT_QUOTA_EXHAUSTED,
    };
  }

  return { exceeded: false };
}

/**
 * Increment rate limit counters
 */
function incrementCounters(state: RateLimitState): void {
  state.minuteCount++;
  state.hourCount++;
  state.dayCount++;
  state.lastRequestAt = new Date();
}

/**
 * Get user ID from request (from auth middleware or API key)
 */
function getUserIdFromRequest(req: Request): string {
  // Check for authenticated user
  const user = (req as Request & { user?: { id: string } }).user;
  if (user?.id) {
    return user.id;
  }

  // Fall back to IP address
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/**
 * Get user tier from request
 */
function getUserTierFromRequest(req: Request): UserTier {
  const user = (req as Request & { user?: { tier: UserTier } }).user;
  return user?.tier || UserTier.BASIC;
}

/**
 * Rate limiting middleware factory
 */
export function rateLimiter(options?: { skipPaths?: string[] }) {
  const skipPaths = options?.skipPaths || ['/health', '/ready', '/metrics'];

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip rate limiting if disabled
    if (!config.RATE_LIMIT_ENABLED) {
      next();
      return;
    }

    // Skip certain paths
    if (skipPaths.some((path) => req.path.startsWith(path))) {
      next();
      return;
    }

    const userId = getUserIdFromRequest(req);
    const tier = getUserTierFromRequest(req);
    const rateLimitConfig = RATE_LIMIT_CONFIGS[tier];

    // Get or create rate limit state
    const state = getRateLimitState(userId, tier);

    // Check rate limit
    const result = checkRateLimit(state, rateLimitConfig);

    if (result.exceeded) {
      // Log rate limit hit
      logger.logSecurity(LogEventType.RATE_LIMIT_HIT, 'Rate limit exceeded', {
        userId,
        tier,
        minuteCount: state.minuteCount,
        hourCount: state.hourCount,
        dayCount: state.dayCount,
        retryAfter: result.retryAfter,
      });

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', rateLimitConfig.requestsPerMinute.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', (Date.now() + (result.retryAfter || 60) * 1000).toString());
      res.setHeader('Retry-After', (result.retryAfter || 60).toString());

      const error = new RateLimitError(
        result.errorCode || AnalyticsErrorCode.RATE_LIMIT_EXCEEDED_BASIC,
        undefined,
        {
          tier,
          limit: rateLimitConfig.requestsPerMinute,
          remaining: 0,
          resetAt: new Date(Date.now() + (result.retryAfter || 60) * 1000).toISOString(),
        },
        result.retryAfter
      );

      res.status(error.statusCode).json(error.toResponse(req.headers['x-request-id'] as string, req.path));
      return;
    }

    // Increment counters
    incrementCounters(state);

    // Set rate limit headers
    const remaining = Math.max(0, rateLimitConfig.requestsPerMinute - state.minuteCount);
    res.setHeader('X-RateLimit-Limit', rateLimitConfig.requestsPerMinute.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', (state.windowStart.getTime() + MINUTE_MS).toString());

    next();
  };
}

/**
 * Get rate limit status for a user
 */
export function getRateLimitStatus(userId: string, tier: UserTier): {
  tier: UserTier;
  limits: RateLimitConfig;
  current: {
    minuteCount: number;
    hourCount: number;
    dayCount: number;
  };
  remaining: {
    minute: number;
    hour: number;
    day: number;
  };
} {
  const state = getRateLimitState(userId, tier);
  const limits = RATE_LIMIT_CONFIGS[tier];

  return {
    tier,
    limits,
    current: {
      minuteCount: state.minuteCount,
      hourCount: state.hourCount,
      dayCount: state.dayCount,
    },
    remaining: {
      minute: Math.max(0, limits.requestsPerMinute - state.minuteCount),
      hour: Math.max(0, limits.requestsPerHour - state.hourCount),
      day: Math.max(0, limits.requestsPerDay - state.dayCount),
    },
  };
}

/**
 * Reset rate limit for a user (admin function)
 */
export function resetRateLimit(userId: string): void {
  rateLimitStates.delete(userId);
}

/**
 * Clear all rate limit states (for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStates.clear();
}

export default rateLimiter;
