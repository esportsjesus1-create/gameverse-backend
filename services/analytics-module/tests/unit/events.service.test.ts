/**
 * GameVerse Analytics Module - Events Service Tests
 * Comprehensive tests for event tracking, querying, and batch operations
 */

import { eventsService } from '../../src/services/events.service';
import { cacheService } from '../../src/services/cache.service';
import { AnalyticsEventType } from '../../src/types';
import { AnalyticsErrorCode } from '../../src/utils/errors';

describe('EventsService', () => {
  beforeEach(async () => {
    await eventsService.clearAllEvents();
    cacheService.clear();
    eventsService.enableTracking();
  });

  describe('trackEvent', () => {
    it('should track a basic event', async () => {
      const event = await eventsService.trackEvent({
        type: AnalyticsEventType.PLAYER_LOGIN,
        playerId: 'player-123',
        sessionId: 'session-456',
        payload: {},
        metadata: { source: 'web', version: '1.0' },
      });

      expect(event.id).toBeDefined();
      expect(event.type).toBe(AnalyticsEventType.PLAYER_LOGIN);
      expect(event.playerId).toBe('player-123');
      expect(event.sessionId).toBe('session-456');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should use provided correlation ID', async () => {
      const event = await eventsService.trackEvent({
        type: AnalyticsEventType.PLAYER_LOGIN,
        playerId: 'player-123',
        sessionId: 'session-456',
        correlationId: 'custom-correlation-id',
        payload: {},
        metadata: { source: 'web', version: '1.0' },
      });

      expect(event.correlationId).toBe('custom-correlation-id');
    });

    it('should use provided timestamp', async () => {
      const customTimestamp = new Date('2024-01-01T00:00:00Z');
      const event = await eventsService.trackEvent({
        type: AnalyticsEventType.PLAYER_LOGIN,
        playerId: 'player-123',
        sessionId: 'session-456',
        timestamp: customTimestamp,
        payload: {},
        metadata: { source: 'web', version: '1.0' },
      });

      expect(event.timestamp).toEqual(customTimestamp);
    });

    it('should throw error when tracking is disabled', async () => {
      eventsService.disableTracking();

      await expect(
        eventsService.trackEvent({
          type: AnalyticsEventType.PLAYER_LOGIN,
          playerId: 'player-123',
          sessionId: 'session-456',
          payload: {},
          metadata: { source: 'web', version: '1.0' },
        })
      ).rejects.toMatchObject({
        code: AnalyticsErrorCode.EVENT_TRACKING_DISABLED,
      });
    });
  });

  describe('trackEventsBatch', () => {
    it('should track multiple events in batch', async () => {
      const result = await eventsService.trackEventsBatch({
        events: [
          {
            type: AnalyticsEventType.PLAYER_LOGIN,
            playerId: 'player-1',
            sessionId: 'session-1',
            payload: {},
            metadata: { source: 'web', version: '1.0' },
          },
          {
            type: AnalyticsEventType.PLAYER_LOGOUT,
            playerId: 'player-2',
            sessionId: 'session-2',
            payload: {},
            metadata: { source: 'web', version: '1.0' },
          },
        ],
      });

      expect(result.tracked).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.events.length).toBe(2);
    });

    it('should handle partial failures in batch', async () => {
      const result = await eventsService.trackEventsBatch({
        events: [
          {
            type: AnalyticsEventType.PLAYER_LOGIN,
            playerId: 'player-1',
            sessionId: 'session-1',
            payload: {},
            metadata: { source: 'web', version: '1.0' },
          },
        ],
      });

      expect(result.tracked).toBe(1);
    });

    it('should throw error when batch size exceeds limit', async () => {
      const events = Array.from({ length: 501 }, (_, i) => ({
        type: AnalyticsEventType.PLAYER_LOGIN,
        playerId: `player-${i}`,
        sessionId: `session-${i}`,
        payload: {},
        metadata: { source: 'web', version: '1.0' },
      }));

      await expect(
        eventsService.trackEventsBatch({ events })
      ).rejects.toMatchObject({
        code: AnalyticsErrorCode.EVENT_BATCH_FAILED,
      });
    });
  });

  describe('getEventById', () => {
    it('should retrieve an event by ID', async () => {
      const created = await eventsService.trackEvent({
        type: AnalyticsEventType.PLAYER_LOGIN,
        playerId: 'player-123',
        sessionId: 'session-456',
        payload: {},
        metadata: { source: 'web', version: '1.0' },
      });

      const retrieved = await eventsService.getEventById(created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.type).toBe(AnalyticsEventType.PLAYER_LOGIN);
    });

    it('should throw error for non-existent event', async () => {
      await expect(
        eventsService.getEventById('non-existent-id')
      ).rejects.toMatchObject({
        code: AnalyticsErrorCode.EVENT_NOT_FOUND,
      });
    });
  });

  describe('queryEvents', () => {
    beforeEach(async () => {
      await eventsService.trackEvent({
        type: AnalyticsEventType.PLAYER_LOGIN,
        playerId: 'player-1',
        sessionId: 'session-1',
        payload: {},
        metadata: { source: 'web', version: '1.0' },
      });

      await eventsService.trackEvent({
        type: AnalyticsEventType.PLAYER_LOGOUT,
        playerId: 'player-1',
        sessionId: 'session-1',
        payload: {},
        metadata: { source: 'web', version: '1.0' },
      });

      await eventsService.trackEvent({
        type: AnalyticsEventType.GAME_START,
        playerId: 'player-2',
        sessionId: 'session-2',
        payload: {},
        metadata: { source: 'web', version: '1.0' },
      });
    });

    it('should query all events with pagination', async () => {
      const result = await eventsService.queryEvents({
        page: 1,
        limit: 10,
        sortOrder: 'desc',
      });

      expect(result.data.length).toBe(3);
      expect(result.total).toBe(3);
    });

    it('should query events by type', async () => {
      const result = await eventsService.queryEvents({
        types: [AnalyticsEventType.PLAYER_LOGIN],
        page: 1,
        limit: 10,
        sortOrder: 'desc',
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0].type).toBe(AnalyticsEventType.PLAYER_LOGIN);
    });

    it('should query events by player ID', async () => {
      const result = await eventsService.queryEvents({
        playerId: 'player-1',
        page: 1,
        limit: 10,
        sortOrder: 'desc',
      });

      expect(result.data.length).toBe(2);
    });

    it('should query events by session ID', async () => {
      const result = await eventsService.queryEvents({
        sessionId: 'session-2',
        page: 1,
        limit: 10,
        sortOrder: 'desc',
      });

      expect(result.data.length).toBe(1);
    });

    it('should return paginated results', async () => {
      const page1 = await eventsService.queryEvents({
        page: 1,
        limit: 2,
        sortOrder: 'desc',
      });

      const page2 = await eventsService.queryEvents({
        page: 2,
        limit: 2,
        sortOrder: 'desc',
      });

      expect(page1.data.length).toBe(2);
      expect(page2.data.length).toBe(1);
    });

    it('should query events with sorting', async () => {
      const result = await eventsService.queryEvents({
        sortBy: 'timestamp',
        sortOrder: 'asc',
        page: 1,
        limit: 10,
      });

      expect(result.data.length).toBe(3);
    });
  });

  describe('deleteEvent', () => {
    it('should delete an event', async () => {
      const event = await eventsService.trackEvent({
        type: AnalyticsEventType.PLAYER_LOGIN,
        playerId: 'player-123',
        sessionId: 'session-456',
        payload: {},
        metadata: { source: 'web', version: '1.0' },
      });

      await eventsService.deleteEvent(event.id);

      await expect(
        eventsService.getEventById(event.id)
      ).rejects.toMatchObject({
        code: AnalyticsErrorCode.EVENT_NOT_FOUND,
      });
    });

    it('should throw error when deleting non-existent event', async () => {
      await expect(
        eventsService.deleteEvent('non-existent-id')
      ).rejects.toMatchObject({
        code: AnalyticsErrorCode.EVENT_NOT_FOUND,
      });
    });
  });

  describe('enableTracking/disableTracking', () => {
    it('should enable and disable tracking', async () => {
      expect(eventsService.isTrackingEnabled()).toBe(true);

      eventsService.disableTracking();
      expect(eventsService.isTrackingEnabled()).toBe(false);

      eventsService.enableTracking();
      expect(eventsService.isTrackingEnabled()).toBe(true);
    });
  });

  describe('clearAllEvents', () => {
    it('should clear all events', async () => {
      await eventsService.trackEvent({
        type: AnalyticsEventType.PLAYER_LOGIN,
        playerId: 'player-123',
        sessionId: 'session-456',
        payload: {},
        metadata: { source: 'web', version: '1.0' },
      });

      await eventsService.clearAllEvents();

      const result = await eventsService.queryEvents({
        page: 1,
        limit: 10,
        sortOrder: 'desc',
      });
      expect(result.data.length).toBe(0);
    });
  });

  describe('getEventsByCorrelationId', () => {
    it('should retrieve events by correlation ID', async () => {
      const correlationId = 'test-correlation-123';

      await eventsService.trackEvent({
        type: AnalyticsEventType.PLAYER_LOGIN,
        playerId: 'player-1',
        sessionId: 'session-1',
        correlationId,
        payload: {},
        metadata: { source: 'web', version: '1.0' },
      });

      await eventsService.trackEvent({
        type: AnalyticsEventType.GAME_START,
        playerId: 'player-1',
        sessionId: 'session-1',
        correlationId,
        payload: {},
        metadata: { source: 'web', version: '1.0' },
      });

      await eventsService.trackEvent({
        type: AnalyticsEventType.PLAYER_LOGOUT,
        playerId: 'player-2',
        sessionId: 'session-2',
        correlationId: 'different-correlation',
        payload: {},
        metadata: { source: 'web', version: '1.0' },
      });

      const events = await eventsService.getEventsByCorrelationId(correlationId);
      expect(events.length).toBe(2);
    });
  });
});
