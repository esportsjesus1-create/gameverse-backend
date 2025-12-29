import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface PresenceUpdate {
  userId: string;
  status: string;
  customMessage?: string;
  currentActivity?: string;
  currentGameName?: string;
  timestamp: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private publisher: Redis;
  private subscriber: Redis;
  private readonly PRESENCE_CHANNEL = 'presence:updates';
  private readonly PRESENCE_KEY_PREFIX = 'presence:';
  private readonly PRESENCE_TTL = 300;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisConfig = {
      host: this.configService.get<string>('redis.host') || 'localhost',
      port: this.configService.get<number>('redis.port') || 6379,
      password: this.configService.get<string>('redis.password') || undefined,
    };

    this.publisher = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);
  }

  async onModuleDestroy(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
  }

  async publishPresenceUpdate(update: PresenceUpdate): Promise<void> {
    await this.publisher.publish(this.PRESENCE_CHANNEL, JSON.stringify(update));

    const key = `${this.PRESENCE_KEY_PREFIX}${update.userId}`;
    await this.publisher.setex(key, this.PRESENCE_TTL, JSON.stringify(update));
  }

  async subscribeToPresenceUpdates(
    callback: (update: PresenceUpdate) => void,
  ): Promise<void> {
    await this.subscriber.subscribe(this.PRESENCE_CHANNEL);

    this.subscriber.on('message', (channel, message) => {
      if (channel === this.PRESENCE_CHANNEL) {
        try {
          const update = JSON.parse(message) as PresenceUpdate;
          callback(update);
        } catch (error) {
          console.error('Failed to parse presence update:', error);
        }
      }
    });
  }

  async unsubscribeFromPresenceUpdates(): Promise<void> {
    await this.subscriber.unsubscribe(this.PRESENCE_CHANNEL);
  }

  async getCachedPresence(userId: string): Promise<PresenceUpdate | null> {
    const key = `${this.PRESENCE_KEY_PREFIX}${userId}`;
    const data = await this.publisher.get(key);

    if (data) {
      try {
        return JSON.parse(data) as PresenceUpdate;
      } catch {
        return null;
      }
    }

    return null;
  }

  async getCachedPresences(userIds: string[]): Promise<Map<string, PresenceUpdate>> {
    const result = new Map<string, PresenceUpdate>();

    if (userIds.length === 0) return result;

    const keys = userIds.map((id) => `${this.PRESENCE_KEY_PREFIX}${id}`);
    const values = await this.publisher.mget(...keys);

    values.forEach((value, index) => {
      if (value) {
        try {
          const update = JSON.parse(value) as PresenceUpdate;
          result.set(userIds[index], update);
        } catch {
          // Skip invalid entries
        }
      }
    });

    return result;
  }

  async setPresenceExpiry(userId: string, ttlSeconds: number): Promise<void> {
    const key = `${this.PRESENCE_KEY_PREFIX}${userId}`;
    await this.publisher.expire(key, ttlSeconds);
  }

  async removePresence(userId: string): Promise<void> {
    const key = `${this.PRESENCE_KEY_PREFIX}${userId}`;
    await this.publisher.del(key);
  }

  async heartbeat(userId: string): Promise<void> {
    const key = `${this.PRESENCE_KEY_PREFIX}${userId}`;
    const exists = await this.publisher.exists(key);

    if (exists) {
      await this.publisher.expire(key, this.PRESENCE_TTL);
    }
  }

  async getOnlineUserIds(): Promise<string[]> {
    const keys = await this.publisher.keys(`${this.PRESENCE_KEY_PREFIX}*`);
    return keys.map((key) => key.replace(this.PRESENCE_KEY_PREFIX, ''));
  }
}
