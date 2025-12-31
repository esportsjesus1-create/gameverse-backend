import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { SocialLoggerService } from './logger.service';

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class SocialCacheService implements OnModuleDestroy {
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly cleanupInterval: NodeJS.Timeout;
  private readonly defaultTtl = 300;
  private readonly logger: SocialLoggerService;

  constructor() {
    this.logger = new SocialLoggerService();
    this.logger.setContext('SocialCacheService');
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || this.defaultTtl;
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttl * 1000,
    };
    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async deletePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.logger.debug(`Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

export const CACHE_KEYS = {
  FRIEND_LIST: (userId: string) => `friends:${userId}`,
  FRIEND_COUNT: (userId: string) => `friend_count:${userId}`,
  PROFILE: (userId: string) => `profile:${userId}`,
  PRESENCE: (userId: string) => `presence:${userId}`,
  BLOCKED_USERS: (userId: string) => `blocked:${userId}`,
  MUTUAL_FRIENDS: (userId1: string, userId2: string) => 
    `mutual_friends:${[userId1, userId2].sort().join(':')}`,
  NOTIFICATIONS_UNREAD: (userId: string) => `notifications_unread:${userId}`,
  FEED: (userId: string, page: number) => `feed:${userId}:${page}`,
};

export const CACHE_TTL = {
  FRIEND_LIST: 60,
  FRIEND_COUNT: 300,
  PROFILE: 120,
  PRESENCE: 30,
  BLOCKED_USERS: 300,
  MUTUAL_FRIENDS: 180,
  NOTIFICATIONS_UNREAD: 60,
  FEED: 30,
};
