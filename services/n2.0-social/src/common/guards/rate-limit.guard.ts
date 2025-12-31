import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitExceededException } from '../exceptions/social.exceptions';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitConfig {
  points: number;
  duration: number;
  blockDuration?: number;
}

export const RateLimit = (config: RateLimitConfig) => {
  return (target: object, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(RATE_LIMIT_KEY, config, descriptor.value);
    } else {
      Reflect.defineMetadata(RATE_LIMIT_KEY, config, target);
    }
    return descriptor || target;
  };
};

interface RateLimitEntry {
  points: number;
  resetAt: number;
  blockedUntil?: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store: Map<string, RateLimitEntry> = new Map();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly reflector: Reflector,
    @Optional() @Inject('REDIS_CLIENT') private readonly redisClient?: unknown,
  ) {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.get<RateLimitConfig>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    ) || this.reflector.get<RateLimitConfig>(
      RATE_LIMIT_KEY,
      context.getClass(),
    );

    if (!config) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.ip;
    const key = `${context.getClass().name}:${context.getHandler().name}:${userId}`;

    return this.checkRateLimit(key, config, context.getHandler().name);
  }

  private async checkRateLimit(
    key: string,
    config: RateLimitConfig,
    operation: string,
  ): Promise<boolean> {
    const now = Date.now();
    let entry = this.store.get(key);

    if (entry?.blockedUntil && entry.blockedUntil > now) {
      const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
      throw new RateLimitExceededException(operation, retryAfter);
    }

    if (!entry || entry.resetAt <= now) {
      entry = {
        points: config.points - 1,
        resetAt: now + config.duration * 1000,
      };
      this.store.set(key, entry);
      return true;
    }

    if (entry.points <= 0) {
      if (config.blockDuration) {
        entry.blockedUntil = now + config.blockDuration * 1000;
        this.store.set(key, entry);
      }
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      throw new RateLimitExceededException(operation, retryAfter);
    }

    entry.points -= 1;
    this.store.set(key, entry);
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt <= now && (!entry.blockedUntil || entry.blockedUntil <= now)) {
        this.store.delete(key);
      }
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

export const RATE_LIMITS = {
  FRIEND_REQUEST: { points: 10, duration: 60, blockDuration: 300 },
  BLOCK_USER: { points: 5, duration: 60, blockDuration: 600 },
  POST_CREATE: { points: 20, duration: 60, blockDuration: 300 },
  COMMENT_CREATE: { points: 30, duration: 60, blockDuration: 300 },
  LIKE_ACTION: { points: 60, duration: 60 },
  PROFILE_UPDATE: { points: 10, duration: 60 },
  SEARCH: { points: 30, duration: 60 },
  PRESENCE_UPDATE: { points: 60, duration: 60 },
};
