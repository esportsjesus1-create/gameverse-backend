import { EventEmitter } from 'eventemitter3';
import { EventHandler, EventContext, EventPayload } from '../types';
import pino from 'pino';

export interface EventBusConfig {
  maxListeners: number;
  enableWildcard: boolean;
}

interface EventSubscription {
  id: string;
  eventType: string;
  handler: EventHandler;
  once: boolean;
}

export class EventBus {
  private readonly emitter: EventEmitter;
  private readonly subscriptions: Map<string, EventSubscription>;
  private readonly config: EventBusConfig;
  private readonly logger: pino.Logger;
  private subscriptionCounter = 0;

  constructor(config: EventBusConfig, logger: pino.Logger) {
    this.config = config;
    this.logger = logger;
    this.emitter = new EventEmitter();
    this.subscriptions = new Map();
  }

  subscribe<T = unknown>(
    eventType: string,
    handler: EventHandler<T>,
    once = false
  ): string {
    const id = `sub_${++this.subscriptionCounter}`;

    const subscription: EventSubscription = {
      id,
      eventType,
      handler: handler as EventHandler,
      once
    };

    this.subscriptions.set(id, subscription);

    if (once) {
      this.emitter.once(eventType, handler as EventHandler);
    } else {
      this.emitter.on(eventType, handler as EventHandler);
    }

    this.logger.debug({ subscriptionId: id, eventType }, 'Event subscription added');

    return id;
  }

  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    this.emitter.off(subscription.eventType, subscription.handler);
    this.subscriptions.delete(subscriptionId);

    this.logger.debug(
      { subscriptionId, eventType: subscription.eventType },
      'Event subscription removed'
    );

    return true;
  }

  unsubscribeAll(eventType?: string): number {
    let count = 0;

    for (const [id, subscription] of this.subscriptions) {
      if (!eventType || subscription.eventType === eventType) {
        this.emitter.off(subscription.eventType, subscription.handler);
        this.subscriptions.delete(id);
        count++;
      }
    }

    this.logger.debug({ eventType, count }, 'Event subscriptions removed');

    return count;
  }

  emit<T = unknown>(eventType: string, data: T, context?: Partial<EventContext>): void {
    const fullContext: EventContext = {
      timestamp: Date.now(),
      ...context
    };

    this.emitter.emit(eventType, data, fullContext);

    if (this.config.enableWildcard) {
      this.emitter.emit('*', { eventType, data }, fullContext);
    }

    this.logger.debug({ eventType }, 'Event emitted');
  }

  emitFromPayload(payload: EventPayload, context?: Partial<EventContext>): void {
    this.emit(payload.eventType, payload.eventData, context);
  }

  hasSubscribers(eventType: string): boolean {
    return this.emitter.listenerCount(eventType) > 0;
  }

  getSubscriberCount(eventType?: string): number {
    if (eventType) {
      return this.emitter.listenerCount(eventType);
    }

    let total = 0;
    for (const subscription of this.subscriptions.values()) {
      if (this.emitter.listenerCount(subscription.eventType) > 0) {
        total++;
      }
    }
    return total;
  }

  getEventTypes(): string[] {
    const types = new Set<string>();
    for (const subscription of this.subscriptions.values()) {
      types.add(subscription.eventType);
    }
    return Array.from(types);
  }

  clear(): void {
    this.emitter.removeAllListeners();
    this.subscriptions.clear();
    this.logger.info('EventBus cleared');
  }
}
