import Redis from 'ioredis';
import { config } from '../config';
import { LoggerService } from './logger.service';
import { CountdownState, LobbyWithPlayers } from '../types';

const logger = new LoggerService('RedisService');

export class RedisService {
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;

  constructor() {
    const redisConfig = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    };

    this.client = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);
    this.publisher = new Redis(redisConfig);

    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('error', (err) => {
      logger.error('Redis client error', err);
    });
  }

  private getKey(key: string): string {
    return `${config.redis.keyPrefix}${key}`;
  }

  async cacheLobby(lobby: LobbyWithPlayers): Promise<void> {
    const key = this.getKey(`lobby:${lobby.id}`);
    await this.client.setex(key, 3600, JSON.stringify(lobby));
  }

  async getCachedLobby(lobbyId: string): Promise<LobbyWithPlayers | null> {
    const key = this.getKey(`lobby:${lobbyId}`);
    const data = await this.client.get(key);
    if (!data) return null;
    return JSON.parse(data) as LobbyWithPlayers;
  }

  async invalidateLobbyCache(lobbyId: string): Promise<void> {
    const key = this.getKey(`lobby:${lobbyId}`);
    await this.client.del(key);
  }

  async setCountdownState(state: CountdownState): Promise<void> {
    const key = this.getKey(`countdown:${state.lobbyId}`);
    await this.client.setex(key, state.duration + 60, JSON.stringify(state));
  }

  async getCountdownState(lobbyId: string): Promise<CountdownState | null> {
    const key = this.getKey(`countdown:${lobbyId}`);
    const data = await this.client.get(key);
    if (!data) return null;
    return JSON.parse(data) as CountdownState;
  }

  async deleteCountdownState(lobbyId: string): Promise<void> {
    const key = this.getKey(`countdown:${lobbyId}`);
    await this.client.del(key);
  }

  async setPlayerSession(playerId: string, lobbyId: string): Promise<void> {
    const key = this.getKey(`session:${playerId}`);
    await this.client.setex(key, 86400, lobbyId);
  }

  async getPlayerSession(playerId: string): Promise<string | null> {
    const key = this.getKey(`session:${playerId}`);
    return this.client.get(key);
  }

  async deletePlayerSession(playerId: string): Promise<void> {
    const key = this.getKey(`session:${playerId}`);
    await this.client.del(key);
  }

  async addToLobbyConnections(lobbyId: string, playerId: string): Promise<void> {
    const key = this.getKey(`connections:${lobbyId}`);
    await this.client.sadd(key, playerId);
    await this.client.expire(key, 86400);
  }

  async removeFromLobbyConnections(lobbyId: string, playerId: string): Promise<void> {
    const key = this.getKey(`connections:${lobbyId}`);
    await this.client.srem(key, playerId);
  }

  async getLobbyConnections(lobbyId: string): Promise<string[]> {
    const key = this.getKey(`connections:${lobbyId}`);
    return this.client.smembers(key);
  }

  async publish(channel: string, message: unknown): Promise<void> {
    await this.publisher.publish(
      this.getKey(channel),
      JSON.stringify(message)
    );
  }

  async subscribe(channel: string, callback: (message: unknown) => void): Promise<void> {
    const fullChannel = this.getKey(channel);
    await this.subscriber.subscribe(fullChannel);
    
    this.subscriber.on('message', (ch, msg) => {
      if (ch === fullChannel) {
        try {
          callback(JSON.parse(msg));
        } catch (error) {
          logger.error('Failed to parse pub/sub message', error as Error);
        }
      }
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.subscriber.unsubscribe(this.getKey(channel));
  }

  async close(): Promise<void> {
    await this.client.quit();
    await this.subscriber.quit();
    await this.publisher.quit();
    logger.info('Redis connections closed');
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

export const redisService = new RedisService();
