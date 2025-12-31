/**
 * GameVerse Analytics Module - Events Service
 * Core service for tracking, querying, and processing analytics events
 */

import { v4 as uuidv4 } from 'uuid';
import { logger, LogEventType } from '../utils/logger';
import { EventTrackingError, AnalyticsErrorCode } from '../utils/errors';
import { cacheService, CacheService } from './cache.service';
import { config } from '../config';
import {
  AnalyticsEvent,
  AnalyticsEventType,
  PaginatedResponse,
} from '../types';
import {
  TrackEventDTO,
  BatchTrackEventsDTO,
  QueryEventsDTO,
} from '../validation/schemas';

// In-memory storage for events (production would use a database)
const eventsStore: Map<string, AnalyticsEvent> = new Map();

// Event queue for batch processing
const eventQueue: AnalyticsEvent[] = [];
const MAX_QUEUE_SIZE = 10000;

export class EventsService {
  private trackingEnabled: boolean = true;

  /**
   * Track a single event
   */
  async trackEvent(dto: TrackEventDTO): Promise<AnalyticsEvent> {
    const timer = logger.startTimer();

    if (!this.trackingEnabled) {
      throw new EventTrackingError(
        AnalyticsErrorCode.EVENT_TRACKING_DISABLED,
        'Event tracking is currently disabled'
      );
    }

    // Check queue capacity
    if (eventQueue.length >= MAX_QUEUE_SIZE) {
      throw new EventTrackingError(
        AnalyticsErrorCode.EVENT_QUEUE_FULL,
        'Event queue is full, please try again later'
      );
    }

    const now = new Date();
    const event: AnalyticsEvent = {
      id: uuidv4(),
      type: dto.type,
      playerId: dto.playerId,
      sessionId: dto.sessionId,
      correlationId: dto.correlationId || uuidv4(),
      payload: dto.payload,
      metadata: dto.metadata,
      timestamp: dto.timestamp || now,
      createdAt: now,
    };

    // Store event
    eventsStore.set(event.id, event);

    // Add to queue for batch processing
    eventQueue.push(event);

    const duration = timer();
    logger.logEventTracking(event.id, event.type, true, {
      playerId: event.playerId,
      sessionId: event.sessionId,
      duration,
    });

    return event;
  }

  /**
   * Track multiple events in batch
   */
  async trackEventsBatch(dto: BatchTrackEventsDTO): Promise<{
    tracked: number;
    failed: number;
    events: AnalyticsEvent[];
    errors: string[];
  }> {
    const timer = logger.startTimer();

    if (dto.events.length > config.BATCH_MAX_EVENTS) {
      throw new EventTrackingError(
        AnalyticsErrorCode.EVENT_BATCH_FAILED,
        `Batch size ${dto.events.length} exceeds maximum of ${config.BATCH_MAX_EVENTS}`
      );
    }

    let tracked = 0;
    let failed = 0;
    const events: AnalyticsEvent[] = [];
    const errors: string[] = [];

    for (const eventDto of dto.events) {
      try {
        const event = await this.trackEvent(eventDto);
        events.push(event);
        tracked++;
      } catch (error) {
        failed++;
        errors.push(`${eventDto.type}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const duration = timer();
    logger.info(LogEventType.EVENT_BATCH_TRACKED, `Batch tracked: ${tracked} events, ${failed} failed`, {
      tracked,
      failed,
      duration,
    });

    return { tracked, failed, events, errors };
  }

  /**
   * Get an event by ID
   */
  async getEventById(eventId: string): Promise<AnalyticsEvent> {
    const event = eventsStore.get(eventId);

    if (!event) {
      throw new EventTrackingError(
        AnalyticsErrorCode.EVENT_NOT_FOUND,
        `Event with ID '${eventId}' not found`
      );
    }

    return event;
  }

  /**
   * Query events with filters and pagination
   */
  async queryEvents(dto: QueryEventsDTO): Promise<PaginatedResponse<AnalyticsEvent>> {
    const timer = logger.startTimer();
    const cacheKey = CacheService.eventsKey(dto);

    // Try cache first
    const cached = cacheService.get<PaginatedResponse<AnalyticsEvent>>(cacheKey);
    if (cached) {
      logger.logQuery('query-events', 'query', timer(), true, { fromCache: true });
      return cached;
    }

    let events = Array.from(eventsStore.values());

    // Apply filters
    if (dto.types && dto.types.length > 0) {
      events = events.filter((e) => dto.types!.includes(e.type));
    }

    if (dto.playerId) {
      events = events.filter((e) => e.playerId === dto.playerId);
    }

    if (dto.sessionId) {
      events = events.filter((e) => e.sessionId === dto.sessionId);
    }

    if (dto.correlationId) {
      events = events.filter((e) => e.correlationId === dto.correlationId);
    }

    if (dto.timeRange) {
      events = events.filter(
        (e) => e.timestamp >= dto.timeRange!.start && e.timestamp <= dto.timeRange!.end
      );
    }

    // Sort by timestamp descending
    const sortBy = dto.sortBy || 'timestamp';
    const sortOrder = dto.sortOrder || 'desc';
    events.sort((a, b) => {
      const aVal = a[sortBy as keyof AnalyticsEvent];
      const bVal = b[sortBy as keyof AnalyticsEvent];
      if (aVal === undefined || bVal === undefined) return 0;
      if (aVal instanceof Date && bVal instanceof Date) {
        return sortOrder === 'asc' ? aVal.getTime() - bVal.getTime() : bVal.getTime() - aVal.getTime();
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Paginate
    const total = events.length;
    const page = dto.page || 1;
    const limit = dto.limit || 50;
    const offset = (page - 1) * limit;
    const paginatedEvents = events.slice(offset, offset + limit);

    const result: PaginatedResponse<AnalyticsEvent> = {
      data: paginatedEvents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: offset + limit < total,
    };

    // Cache result
    cacheService.set(cacheKey, result, config.CACHE_QUERY_TTL);

    const duration = timer();
    logger.logQuery('query-events', 'query', duration, true, {
      total,
      returned: paginatedEvents.length,
    });

    return result;
  }

  /**
   * Get events by player ID
   */
  async getEventsByPlayerId(
    playerId: string,
    limit: number = 100
  ): Promise<AnalyticsEvent[]> {
    const events = Array.from(eventsStore.values())
      .filter((e) => e.playerId === playerId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    return events;
  }

  /**
   * Get events by session ID
   */
  async getEventsBySessionId(sessionId: string): Promise<AnalyticsEvent[]> {
    const events = Array.from(eventsStore.values())
      .filter((e) => e.sessionId === sessionId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return events;
  }

  /**
   * Get events by correlation ID
   */
  async getEventsByCorrelationId(correlationId: string): Promise<AnalyticsEvent[]> {
    const events = Array.from(eventsStore.values())
      .filter((e) => e.correlationId === correlationId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return events;
  }

  /**
   * Count events by type
   */
  async countEventsByType(
    type: AnalyticsEventType,
    timeRange?: { start: Date; end: Date }
  ): Promise<number> {
    let events = Array.from(eventsStore.values()).filter((e) => e.type === type);

    if (timeRange) {
      events = events.filter(
        (e) => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
      );
    }

    return events.length;
  }

  /**
   * Get event type distribution
   */
  async getEventTypeDistribution(
    timeRange?: { start: Date; end: Date }
  ): Promise<Record<AnalyticsEventType, number>> {
    let events = Array.from(eventsStore.values());

    if (timeRange) {
      events = events.filter(
        (e) => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
      );
    }

    const distribution: Partial<Record<AnalyticsEventType, number>> = {};

    for (const event of events) {
      distribution[event.type] = (distribution[event.type] || 0) + 1;
    }

    return distribution as Record<AnalyticsEventType, number>;
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string): Promise<void> {
    const event = await this.getEventById(eventId);
    eventsStore.delete(eventId);

    // Invalidate cache
    cacheService.invalidateByPattern(`events:.*`);

    logger.logEventTracking(event.id, event.type, true, { action: 'delete' });
  }

  /**
   * Enable event tracking
   */
  enableTracking(): void {
    this.trackingEnabled = true;
    logger.info(LogEventType.SERVICE_STARTED, 'Event tracking enabled');
  }

  /**
   * Disable event tracking
   */
  disableTracking(): void {
    this.trackingEnabled = false;
    logger.info(LogEventType.SERVICE_STOPPED, 'Event tracking disabled');
  }

  /**
   * Check if tracking is enabled
   */
  isTrackingEnabled(): boolean {
    return this.trackingEnabled;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { size: number; maxSize: number; utilizationPercent: number } {
    return {
      size: eventQueue.length,
      maxSize: MAX_QUEUE_SIZE,
      utilizationPercent: (eventQueue.length / MAX_QUEUE_SIZE) * 100,
    };
  }

  /**
   * Process queued events (for batch processing)
   */
  async processQueue(): Promise<{ processed: number; failed: number }> {
    const timer = logger.startTimer();
    let processed = 0;
    let failed = 0;

    while (eventQueue.length > 0) {
      const event = eventQueue.shift();
      if (event) {
        try {
          event.processedAt = new Date();
          eventsStore.set(event.id, event);
          processed++;
        } catch {
          failed++;
        }
      }
    }

    const duration = timer();
    logger.info(LogEventType.EVENT_PROCESSED, `Queue processed: ${processed} events, ${failed} failed`, {
      processed,
      failed,
      duration,
    });

    return { processed, failed };
  }

  /**
   * Get all events (for admin/debugging)
   */
  async getAllEvents(): Promise<AnalyticsEvent[]> {
    return Array.from(eventsStore.values());
  }

  /**
   * Clear all events (for testing)
   */
  async clearAllEvents(): Promise<void> {
    eventsStore.clear();
    eventQueue.length = 0;
    cacheService.invalidateByPattern('events:.*');
  }
}

// Singleton instance
export const eventsService = new EventsService();

export default eventsService;
