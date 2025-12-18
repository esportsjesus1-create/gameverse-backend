import { v4 as uuidv4 } from 'uuid';
import {
  TelemetryEvent,
  StoredEvent,
  QueryOptions,
  PaginatedResponse,
  EventType
} from '../types';
import { logger } from '../utils/logger';
import { getCurrentTimestamp } from '../utils/helpers';

export class EventService {
  private events: Map<string, StoredEvent> = new Map();
  private eventBuffer: TelemetryEvent[] = [];
  private readonly bufferSize: number;
  private readonly flushInterval: number;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(bufferSize = 100, flushInterval = 5000) {
    this.bufferSize = bufferSize;
    this.flushInterval = flushInterval;
    this.startFlushTimer();
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      void this.flushBuffer();
    }, this.flushInterval);
  }

  public stopFlushTimer(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  public trackEvent(event: TelemetryEvent): StoredEvent {
    const storedEvent = this.createStoredEvent(event);
    
    this.eventBuffer.push(event);
    
    if (this.eventBuffer.length >= this.bufferSize) {
      this.flushBuffer();
    }

    this.events.set(storedEvent.id, storedEvent);
    logger.debug('Event tracked', { eventId: storedEvent.id, eventName: storedEvent.name });
    
    return storedEvent;
  }

  public trackBatchEvents(events: TelemetryEvent[]): StoredEvent[] {
    const storedEvents: StoredEvent[] = [];
    
    for (const event of events) {
      const storedEvent = this.createStoredEvent(event);
      this.events.set(storedEvent.id, storedEvent);
      storedEvents.push(storedEvent);
    }

    this.eventBuffer.push(...events);
    
    if (this.eventBuffer.length >= this.bufferSize) {
      this.flushBuffer();
    }

    logger.debug('Batch events tracked', { count: storedEvents.length });
    
    return storedEvents;
  }

  private createStoredEvent(event: TelemetryEvent): StoredEvent {
    const now = getCurrentTimestamp();
    return {
      ...event,
      id: event.id ?? uuidv4(),
      timestamp: event.timestamp ?? now,
      receivedAt: now
    };
  }

  public flushBuffer(): void {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const eventsToFlush = [...this.eventBuffer];
    this.eventBuffer = [];
    
    logger.info('Flushing event buffer', { count: eventsToFlush.length });
  }

  public getEvent(id: string): StoredEvent | undefined {
    return this.events.get(id);
  }

  public queryEvents(options: QueryOptions = {}): PaginatedResponse<StoredEvent> {
    let filteredEvents = Array.from(this.events.values());

    if (options.startTime !== undefined) {
      filteredEvents = filteredEvents.filter(e => e.timestamp >= options.startTime!);
    }

    if (options.endTime !== undefined) {
      filteredEvents = filteredEvents.filter(e => e.timestamp <= options.endTime!);
    }

    if (options.userId !== undefined) {
      filteredEvents = filteredEvents.filter(e => e.userId === options.userId);
    }

    if (options.sessionId !== undefined) {
      filteredEvents = filteredEvents.filter(e => e.sessionId === options.sessionId);
    }

    if (options.eventType !== undefined) {
      filteredEvents = filteredEvents.filter(e => e.type === options.eventType);
    }

    filteredEvents.sort((a, b) => b.timestamp - a.timestamp);

    const total = filteredEvents.length;
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;
    const paginatedEvents = filteredEvents.slice(offset, offset + limit);

    return {
      data: paginatedEvents,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }

  public getEventsByType(type: EventType): StoredEvent[] {
    return Array.from(this.events.values()).filter(e => e.type === type);
  }

  public getEventsByUser(userId: string): StoredEvent[] {
    return Array.from(this.events.values()).filter(e => e.userId === userId);
  }

  public getEventsBySession(sessionId: string): StoredEvent[] {
    return Array.from(this.events.values()).filter(e => e.sessionId === sessionId);
  }

  public getEventCount(): number {
    return this.events.size;
  }

  public getEventCountByType(): Record<EventType, number> {
    const counts: Record<EventType, number> = {
      user_action: 0,
      system_event: 0,
      error: 0,
      performance: 0,
      custom: 0
    };

    for (const event of this.events.values()) {
      counts[event.type]++;
    }

    return counts;
  }

  public clearEvents(): void {
    this.events.clear();
    this.eventBuffer = [];
    logger.info('All events cleared');
  }

  public validateEvent(event: TelemetryEvent): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (event.name.length === 0) {
      errors.push('Event name is required');
    }

    if (event.name.length > 255) {
      errors.push('Event name must be 255 characters or less');
    }

    if (event.timestamp !== undefined && event.timestamp < 0) {
      errors.push('Timestamp must be a positive number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const eventService = new EventService();
