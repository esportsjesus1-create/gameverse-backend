import { SecurityRateLimitError } from '../errors';
import { PlatformLogger, EventTypes } from '../logging';

export type RateLimitTier = 'global' | 'service' | 'user';

export interface RateLimitConfig {
  tier: RateLimitTier;
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
  blockedUntil?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

const DEFAULT_CONFIGS: Record<RateLimitTier, RateLimitConfig> = {
  global: {
    tier: 'global',
    maxRequests: 10000,
    windowMs: 60000,
    blockDurationMs: 60000,
  },
  service: {
    tier: 'service',
    maxRequests: 1000,
    windowMs: 60000,
    blockDurationMs: 30000,
  },
  user: {
    tier: 'user',
    maxRequests: 100,
    windowMs: 60000,
    blockDurationMs: 15000,
  },
};

export class RateLimiter {
  private entries: Map<string, RateLimitEntry> = new Map();
  private configs: Map<RateLimitTier, RateLimitConfig> = new Map();
  private logger: PlatformLogger;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    logger: PlatformLogger,
    customConfigs?: Partial<Record<RateLimitTier, Partial<RateLimitConfig>>>
  ) {
    this.logger = logger;

    for (const tier of ['global', 'service', 'user'] as RateLimitTier[]) {
      const defaultConfig = DEFAULT_CONFIGS[tier];
      const customConfig = customConfigs?.[tier];
      this.configs.set(tier, {
        ...defaultConfig,
        ...customConfig,
      });
    }

    this.startCleanup();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.resetAt < now && (!entry.blockedUntil || entry.blockedUntil < now)) {
        this.entries.delete(key);
      }
    }
  }

  private getKey(tier: RateLimitTier, identifier: string): string {
    return `${tier}:${identifier}`;
  }

  check(tier: RateLimitTier, identifier: string): RateLimitResult {
    const config = this.configs.get(tier)!;
    const key = this.getKey(tier, identifier);
    const now = Date.now();

    let entry = this.entries.get(key);

    if (entry?.blockedUntil && entry.blockedUntil > now) {
      const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
      this.logger.event(EventTypes.RATE_LIMIT_EXCEEDED, {
        tier,
        identifier,
        retryAfter,
      });
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.blockedUntil),
        retryAfter,
      };
    }

    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + config.windowMs,
      };
      this.entries.set(key, entry);
    }

    entry.count++;

    if (entry.count > config.maxRequests) {
      if (config.blockDurationMs) {
        entry.blockedUntil = now + config.blockDurationMs;
      }
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      this.logger.event(EventTypes.RATE_LIMIT_EXCEEDED, {
        tier,
        identifier,
        count: entry.count,
        maxRequests: config.maxRequests,
      });
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.resetAt),
        retryAfter,
      };
    }

    this.logger.event(EventTypes.RATE_LIMIT_CHECKED, {
      tier,
      identifier,
      count: entry.count,
      remaining: config.maxRequests - entry.count,
    });

    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetAt: new Date(entry.resetAt),
    };
  }

  checkOrThrow(tier: RateLimitTier, identifier: string): RateLimitResult {
    const result = this.check(tier, identifier);
    if (!result.allowed) {
      throw new SecurityRateLimitError(identifier, tier);
    }
    return result;
  }

  checkAll(identifiers: { tier: RateLimitTier; identifier: string }[]): RateLimitResult[] {
    return identifiers.map(({ tier, identifier }) => this.check(tier, identifier));
  }

  checkAllOrThrow(identifiers: { tier: RateLimitTier; identifier: string }[]): RateLimitResult[] {
    const results = this.checkAll(identifiers);
    const failedIndex = results.findIndex((r) => !r.allowed);
    if (failedIndex !== -1) {
      const { tier, identifier } = identifiers[failedIndex];
      throw new SecurityRateLimitError(identifier, tier);
    }
    return results;
  }

  reset(tier: RateLimitTier, identifier: string): void {
    const key = this.getKey(tier, identifier);
    this.entries.delete(key);
  }

  resetAll(): void {
    this.entries.clear();
  }

  getStatus(tier: RateLimitTier, identifier: string): RateLimitEntry | undefined {
    const key = this.getKey(tier, identifier);
    return this.entries.get(key);
  }

  getConfig(tier: RateLimitTier): RateLimitConfig {
    return this.configs.get(tier)!;
  }

  updateConfig(tier: RateLimitTier, config: Partial<RateLimitConfig>): void {
    const currentConfig = this.configs.get(tier)!;
    this.configs.set(tier, { ...currentConfig, ...config });
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.entries.clear();
  }
}

export class ThreeTierRateLimiter {
  private rateLimiter: RateLimiter;
  private logger: PlatformLogger;

  constructor(
    logger: PlatformLogger,
    customConfigs?: Partial<Record<RateLimitTier, Partial<RateLimitConfig>>>
  ) {
    this.logger = logger;
    this.rateLimiter = new RateLimiter(logger, customConfigs);
  }

  check(
    globalIdentifier: string,
    serviceIdentifier: string,
    userIdentifier?: string
  ): { allowed: boolean; results: Record<RateLimitTier, RateLimitResult> } {
    const results: Record<RateLimitTier, RateLimitResult> = {
      global: this.rateLimiter.check('global', globalIdentifier),
      service: this.rateLimiter.check('service', serviceIdentifier),
      user: userIdentifier
        ? this.rateLimiter.check('user', userIdentifier)
        : { allowed: true, remaining: Infinity, resetAt: new Date() },
    };

    const allowed = results.global.allowed && results.service.allowed && results.user.allowed;

    return { allowed, results };
  }

  checkOrThrow(
    globalIdentifier: string,
    serviceIdentifier: string,
    userIdentifier?: string
  ): Record<RateLimitTier, RateLimitResult> {
    const { allowed, results } = this.check(globalIdentifier, serviceIdentifier, userIdentifier);

    if (!allowed) {
      if (!results.global.allowed) {
        throw new SecurityRateLimitError(globalIdentifier, 'global');
      }
      if (!results.service.allowed) {
        throw new SecurityRateLimitError(serviceIdentifier, 'service');
      }
      if (!results.user.allowed) {
        throw new SecurityRateLimitError(userIdentifier!, 'user');
      }
    }

    return results;
  }

  reset(tier: RateLimitTier, identifier: string): void {
    this.rateLimiter.reset(tier, identifier);
  }

  resetAll(): void {
    this.rateLimiter.resetAll();
  }

  getConfig(tier: RateLimitTier): RateLimitConfig {
    return this.rateLimiter.getConfig(tier);
  }

  updateConfig(tier: RateLimitTier, config: Partial<RateLimitConfig>): void {
    this.rateLimiter.updateConfig(tier, config);
  }

  destroy(): void {
    this.rateLimiter.destroy();
  }
}

export const createRateLimiter = (
  logger: PlatformLogger,
  customConfigs?: Partial<Record<RateLimitTier, Partial<RateLimitConfig>>>
): ThreeTierRateLimiter => {
  return new ThreeTierRateLimiter(logger, customConfigs);
};

export default ThreeTierRateLimiter;
