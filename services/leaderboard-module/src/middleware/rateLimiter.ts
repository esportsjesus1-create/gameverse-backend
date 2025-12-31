import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../config/redis';
import { logger, EventType } from '../utils/logger';
import { RateLimitError } from '../utils/errors';
import { config } from '../config';

export enum RateLimitTier {
  ANONYMOUS = 'ANONYMOUS',
  AUTHENTICATED = 'AUTHENTICATED',
  PREMIUM = 'PREMIUM',
}

interface RateLimitConfig {
  requests: number;
  windowSeconds: number;
}

const RATE_LIMIT_CONFIGS: Record<RateLimitTier, RateLimitConfig> = {
  [RateLimitTier.ANONYMOUS]: {
    requests: config.RATE_LIMIT_ANONYMOUS_REQUESTS,
    windowSeconds: config.RATE_LIMIT_ANONYMOUS_WINDOW,
  },
  [RateLimitTier.AUTHENTICATED]: {
    requests: config.RATE_LIMIT_AUTHENTICATED_REQUESTS,
    windowSeconds: config.RATE_LIMIT_AUTHENTICATED_WINDOW,
  },
  [RateLimitTier.PREMIUM]: {
    requests: config.RATE_LIMIT_PREMIUM_REQUESTS,
    windowSeconds: config.RATE_LIMIT_PREMIUM_WINDOW,
  },
};

interface RateLimitInfo {
  tier: RateLimitTier;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

export interface RateLimitedRequest extends Request {
  rateLimitInfo?: RateLimitInfo;
  userId?: string;
  userTier?: RateLimitTier;
}

const getClientIdentifier = (req: RateLimitedRequest): string => {
  if (req.userId) {
    return `user:${req.userId}`;
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];
    return `ip:${ip.trim()}`;
  }

  return `ip:${req.ip || 'unknown'}`;
};

const getUserTier = (req: RateLimitedRequest): RateLimitTier => {
  if (req.userTier) {
    return req.userTier;
  }

  if (req.userId) {
    const premiumHeader = req.headers['x-premium-user'];
    if (premiumHeader === 'true') {
      return RateLimitTier.PREMIUM;
    }
    return RateLimitTier.AUTHENTICATED;
  }

  return RateLimitTier.ANONYMOUS;
};

export const rateLimiter = (customConfig?: Partial<Record<RateLimitTier, RateLimitConfig>>) => {
  const configs = { ...RATE_LIMIT_CONFIGS, ...customConfig };

  return async (req: RateLimitedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientId = getClientIdentifier(req);
      const tier = getUserTier(req);
      const tierConfig = configs[tier];

      const currentCount = await cacheService.incrementRateLimit(clientId, tier);

      const resetAt = new Date(Date.now() + tierConfig.windowSeconds * 1000);
      const remaining = Math.max(0, tierConfig.requests - currentCount);

      req.rateLimitInfo = {
        tier,
        limit: tierConfig.requests,
        remaining,
        resetAt,
      };

      res.setHeader('X-RateLimit-Limit', tierConfig.requests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.floor(resetAt.getTime() / 1000).toString());
      res.setHeader('X-RateLimit-Tier', tier);

      if (currentCount > tierConfig.requests) {
        const retryAfter = tierConfig.windowSeconds;
        req.rateLimitInfo.retryAfter = retryAfter;

        res.setHeader('Retry-After', retryAfter.toString());

        logger.logRateLimitExceeded(clientId, req.path, tierConfig.requests, {
          ip: req.ip,
          userId: req.userId,
        });

        throw new RateLimitError(
          `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
          retryAfter
        );
      }

      if (currentCount > tierConfig.requests * 0.8) {
        logger.warn(EventType.RATE_LIMIT_WARNING, `Rate limit warning for ${clientId}: ${currentCount}/${tierConfig.requests}`, {
          ip: req.ip,
          userId: req.userId,
        });
      }

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        res.status(429).json({
          success: false,
          error: error.message,
          errorCode: 'RATE_LIMIT_EXCEEDED',
          retryAfter: error.retryAfter,
        });
        return;
      }

      logger.error(EventType.API_ERROR, 'Rate limiter error', error as Error);
      next();
    }
  };
};

export const strictRateLimiter = (requests: number, windowSeconds: number) => {
  return async (req: RateLimitedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientId = getClientIdentifier(req);

      const currentCount = await cacheService.incrementRateLimit(clientId, `strict:${req.path}`);

      if (currentCount > requests) {
        res.setHeader('Retry-After', windowSeconds.toString());

        logger.logRateLimitExceeded(clientId, req.path, requests, {
          ip: req.ip,
          userId: req.userId,
          strict: true,
        });

        res.status(429).json({
          success: false,
          error: `Rate limit exceeded for this endpoint. Please try again in ${windowSeconds} seconds.`,
          errorCode: 'RATE_LIMIT_EXCEEDED',
          retryAfter: windowSeconds,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error(EventType.API_ERROR, 'Strict rate limiter error', error as Error);
      next();
    }
  };
};

export const scoreSubmissionRateLimiter = strictRateLimiter(
  config.ANTI_CHEAT_SUBMISSION_RATE_LIMIT,
  config.ANTI_CHEAT_SUBMISSION_RATE_WINDOW
);

export const leaderboardQueryRateLimiter = rateLimiter({
  [RateLimitTier.ANONYMOUS]: { requests: 60, windowSeconds: 60 },
  [RateLimitTier.AUTHENTICATED]: { requests: 200, windowSeconds: 60 },
  [RateLimitTier.PREMIUM]: { requests: 1000, windowSeconds: 60 },
});

export const adminRateLimiter = strictRateLimiter(50, 60);

export const getRateLimitStatus = async (clientId: string): Promise<Record<RateLimitTier, { count: number; limit: number; remaining: number }>> => {
  const status: Record<RateLimitTier, { count: number; limit: number; remaining: number }> = {} as Record<RateLimitTier, { count: number; limit: number; remaining: number }>;

  for (const tier of Object.values(RateLimitTier)) {
    const count = await cacheService.getRateLimitCount(clientId, tier);
    const config = RATE_LIMIT_CONFIGS[tier];
    status[tier] = {
      count,
      limit: config.requests,
      remaining: Math.max(0, config.requests - count),
    };
  }

  return status;
};

export default rateLimiter;
