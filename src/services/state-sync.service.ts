import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import {
  RoomState,
  StateUpdate,
  UpdateStateInput,
  InvalidStateVersionError,
} from '../types';
import { logger } from '../utils/logger';

export class StateSyncService {
  private redis: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private stateCache: Map<string, RoomState> = new Map();
  private subscriptions: Map<string, Set<(update: StateUpdate) => void>> = new Map();

  constructor(redis: Redis) {
    this.redis = redis;
    this.subscriber = redis.duplicate();
    this.publisher = redis.duplicate();
    this.setupSubscriber();
  }

  private setupSubscriber(): void {
    this.subscriber.on('message', (channel: string, message: string) => {
      try {
        const update = JSON.parse(message) as StateUpdate;
        const callbacks = this.subscriptions.get(channel);
        if (callbacks) {
          callbacks.forEach(callback => callback(update));
        }
      } catch (error) {
        logger.error('Failed to process state update message', { error, channel });
      }
    });
  }

  async initializeRoomState(roomId: string): Promise<RoomState> {
    const state: RoomState = {
      roomId,
      version: 1,
      data: {},
      lastUpdatedAt: new Date(),
    };

    await this.saveState(state);
    this.stateCache.set(roomId, state);

    logger.debug(`Room state initialized: ${roomId}`);

    return state;
  }

  async getState(roomId: string): Promise<RoomState | null> {
    const cached = this.stateCache.get(roomId);
    if (cached) {
      return cached;
    }

    const key = this.getStateKey(roomId);
    const data = await this.redis.get(key);
    
    if (!data) {
      return null;
    }

    const state = JSON.parse(data) as RoomState;
    this.stateCache.set(roomId, state);
    
    return state;
  }

  async updateState(roomId: string, input: UpdateStateInput, userId: string, expectedVersion?: number): Promise<RoomState> {
    const currentState = await this.getState(roomId);
    
    if (!currentState) {
      return this.initializeRoomState(roomId);
    }

    if (expectedVersion !== undefined && currentState.version !== expectedVersion) {
      throw new InvalidStateVersionError();
    }

    const newVersion = currentState.version + 1;
    const now = new Date();

    let newData: Record<string, unknown>;
    if (input.merge) {
      newData = { ...currentState.data, ...input.data };
    } else {
      newData = input.data;
    }

    const newState: RoomState = {
      roomId,
      version: newVersion,
      data: newData,
      lastUpdatedAt: now,
      lastUpdatedBy: userId,
    };

    await this.saveState(newState);
    this.stateCache.set(roomId, newState);

    const stateUpdate: StateUpdate = {
      roomId,
      version: newVersion,
      changes: input.data,
      timestamp: now,
      updatedBy: userId,
    };

    await this.publishStateUpdate(roomId, stateUpdate);

    logger.debug(`Room state updated: ${roomId}`, { version: newVersion });

    return newState;
  }

  async patchState(roomId: string, path: string, value: unknown, userId: string): Promise<RoomState> {
    const currentState = await this.getState(roomId);
    
    if (!currentState) {
      throw new Error('Room state not found');
    }

    const newData = { ...currentState.data };
    this.setNestedValue(newData, path, value);

    return this.updateState(roomId, { data: newData, merge: false }, userId, currentState.version);
  }

  async deleteStateKey(roomId: string, path: string, userId: string): Promise<RoomState> {
    const currentState = await this.getState(roomId);
    
    if (!currentState) {
      throw new Error('Room state not found');
    }

    const newData = { ...currentState.data };
    this.deleteNestedValue(newData, path);

    return this.updateState(roomId, { data: newData, merge: false }, userId, currentState.version);
  }

  async subscribeToRoom(roomId: string, callback: (update: StateUpdate) => void): Promise<string> {
    const channel = this.getStateChannel(roomId);
    const subscriptionId = uuidv4();

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }

    this.subscriptions.get(channel)!.add(callback);

    logger.debug(`Subscribed to room state: ${roomId}`, { subscriptionId });

    return subscriptionId;
  }

  async unsubscribeFromRoom(roomId: string, callback: (update: StateUpdate) => void): Promise<void> {
    const channel = this.getStateChannel(roomId);
    const callbacks = this.subscriptions.get(channel);

    if (callbacks) {
      callbacks.delete(callback);
      
      if (callbacks.size === 0) {
        this.subscriptions.delete(channel);
        await this.subscriber.unsubscribe(channel);
      }
    }

    logger.debug(`Unsubscribed from room state: ${roomId}`);
  }

  async publishRoomUpdate(roomId: string, eventType: string, data: unknown): Promise<void> {
    const channel = this.getRoomChannel(roomId);
    const message = JSON.stringify({
      type: eventType,
      roomId,
      data,
      timestamp: new Date(),
    });

    await this.publisher.publish(channel, message);
  }

  async cleanupRoomState(roomId: string): Promise<void> {
    const stateKey = this.getStateKey(roomId);
    const stateChannel = this.getStateChannel(roomId);
    const roomChannel = this.getRoomChannel(roomId);

    await this.redis.del(stateKey);
    this.stateCache.delete(roomId);

    const stateCallbacks = this.subscriptions.get(stateChannel);
    if (stateCallbacks) {
      this.subscriptions.delete(stateChannel);
      await this.subscriber.unsubscribe(stateChannel);
    }

    const roomCallbacks = this.subscriptions.get(roomChannel);
    if (roomCallbacks) {
      this.subscriptions.delete(roomChannel);
      await this.subscriber.unsubscribe(roomChannel);
    }

    logger.debug(`Room state cleaned up: ${roomId}`);
  }

  async getStateHistory(roomId: string, limit = 10): Promise<StateUpdate[]> {
    const key = this.getHistoryKey(roomId);
    const history = await this.redis.lrange(key, 0, limit - 1);
    return history.map(item => JSON.parse(item) as StateUpdate);
  }

  private async saveState(state: RoomState): Promise<void> {
    const key = this.getStateKey(state.roomId);
    await this.redis.set(key, JSON.stringify(state));
  }

  private async publishStateUpdate(roomId: string, update: StateUpdate): Promise<void> {
    const channel = this.getStateChannel(roomId);
    await this.publisher.publish(channel, JSON.stringify(update));

    const historyKey = this.getHistoryKey(roomId);
    await this.redis.lpush(historyKey, JSON.stringify(update));
    await this.redis.ltrim(historyKey, 0, 99);
  }

  private getStateKey(roomId: string): string {
    return `room:${roomId}:state`;
  }

  private getStateChannel(roomId: string): string {
    return `room:${roomId}:state:updates`;
  }

  private getRoomChannel(roomId: string): string {
    return `room:${roomId}:events`;
  }

  private getHistoryKey(roomId: string): string {
    return `room:${roomId}:state:history`;
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
  }

  private deleteNestedValue(obj: Record<string, unknown>, path: string): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        return;
      }
      current = current[key] as Record<string, unknown>;
    }

    delete current[keys[keys.length - 1]];
  }

  async disconnect(): Promise<void> {
    await this.subscriber.quit();
    await this.publisher.quit();
  }
}
