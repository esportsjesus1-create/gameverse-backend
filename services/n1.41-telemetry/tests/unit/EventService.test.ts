import { EventService } from '../../src/services/EventService';
import { TelemetryEvent } from '../../src/types';

describe('EventService', () => {
  let eventService: EventService;

  beforeEach(() => {
    eventService = new EventService(10, 10000);
  });

  afterEach(() => {
    eventService.stopFlushTimer();
    eventService.clearEvents();
  });

  describe('trackEvent', () => {
    it('should track a single event', async () => {
      const event: TelemetryEvent = {
        type: 'user_action',
        name: 'button_click',
        userId: 'user123',
        sessionId: 'session456'
      };

      const stored = await eventService.trackEvent(event);

      expect(stored.id).toBeDefined();
      expect(stored.name).toBe('button_click');
      expect(stored.type).toBe('user_action');
      expect(stored.userId).toBe('user123');
      expect(stored.timestamp).toBeDefined();
      expect(stored.receivedAt).toBeDefined();
    });

    it('should use provided timestamp if given', async () => {
      const timestamp = Date.now() - 1000;
      const event: TelemetryEvent = {
        type: 'system_event',
        name: 'startup',
        timestamp
      };

      const stored = await eventService.trackEvent(event);

      expect(stored.timestamp).toBe(timestamp);
    });

    it('should use provided id if given', async () => {
      const id = '550e8400-e29b-41d4-a716-446655440000';
      const event: TelemetryEvent = {
        id,
        type: 'error',
        name: 'api_error'
      };

      const stored = await eventService.trackEvent(event);

      expect(stored.id).toBe(id);
    });
  });

  describe('trackBatchEvents', () => {
    it('should track multiple events', async () => {
      const events: TelemetryEvent[] = [
        { type: 'user_action', name: 'click' },
        { type: 'user_action', name: 'scroll' },
        { type: 'system_event', name: 'load' }
      ];

      const stored = await eventService.trackBatchEvents(events);

      expect(stored).toHaveLength(3);
      expect(stored[0]?.name).toBe('click');
      expect(stored[1]?.name).toBe('scroll');
      expect(stored[2]?.name).toBe('load');
    });
  });

  describe('getEvent', () => {
    it('should retrieve an event by id', async () => {
      const event: TelemetryEvent = {
        type: 'user_action',
        name: 'test_event'
      };

      const stored = await eventService.trackEvent(event);
      const retrieved = eventService.getEvent(stored.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(stored.id);
    });

    it('should return undefined for non-existent event', () => {
      const retrieved = eventService.getEvent('non-existent-id');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('queryEvents', () => {
    beforeEach(async () => {
      const now = Date.now();
      await eventService.trackBatchEvents([
        { type: 'user_action', name: 'event1', userId: 'user1', timestamp: now - 3000 },
        { type: 'error', name: 'event2', userId: 'user2', timestamp: now - 2000 },
        { type: 'user_action', name: 'event3', userId: 'user1', timestamp: now - 1000 }
      ]);
    });

    it('should return all events with default options', () => {
      const result = eventService.queryEvents();

      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should filter by userId', () => {
      const result = eventService.queryEvents({ userId: 'user1' });

      expect(result.data).toHaveLength(2);
      expect(result.data.every(e => e.userId === 'user1')).toBe(true);
    });

    it('should filter by eventType', () => {
      const result = eventService.queryEvents({ eventType: 'error' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.type).toBe('error');
    });

    it('should apply pagination', () => {
      const result = eventService.queryEvents({ limit: 2, offset: 0 });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });

    it('should filter by time range', () => {
      const now = Date.now();
      const result = eventService.queryEvents({
        startTime: now - 2500,
        endTime: now - 500
      });

      expect(result.data).toHaveLength(2);
    });
  });

  describe('getEventsByType', () => {
    it('should return events filtered by type', async () => {
      await eventService.trackBatchEvents([
        { type: 'user_action', name: 'action1' },
        { type: 'error', name: 'error1' },
        { type: 'user_action', name: 'action2' }
      ]);

      const userActions = eventService.getEventsByType('user_action');

      expect(userActions).toHaveLength(2);
    });
  });

  describe('getEventsByUser', () => {
    it('should return events for a specific user', async () => {
      await eventService.trackBatchEvents([
        { type: 'user_action', name: 'event1', userId: 'user1' },
        { type: 'user_action', name: 'event2', userId: 'user2' },
        { type: 'user_action', name: 'event3', userId: 'user1' }
      ]);

      const userEvents = eventService.getEventsByUser('user1');

      expect(userEvents).toHaveLength(2);
    });
  });

  describe('getEventsBySession', () => {
    it('should return events for a specific session', async () => {
      await eventService.trackBatchEvents([
        { type: 'user_action', name: 'event1', sessionId: 'session1' },
        { type: 'user_action', name: 'event2', sessionId: 'session2' },
        { type: 'user_action', name: 'event3', sessionId: 'session1' }
      ]);

      const sessionEvents = eventService.getEventsBySession('session1');

      expect(sessionEvents).toHaveLength(2);
    });
  });

  describe('getEventCount', () => {
    it('should return the total number of events', async () => {
      await eventService.trackBatchEvents([
        { type: 'user_action', name: 'event1' },
        { type: 'user_action', name: 'event2' }
      ]);

      expect(eventService.getEventCount()).toBe(2);
    });
  });

  describe('getEventCountByType', () => {
    it('should return counts grouped by event type', async () => {
      await eventService.trackBatchEvents([
        { type: 'user_action', name: 'action1' },
        { type: 'user_action', name: 'action2' },
        { type: 'error', name: 'error1' },
        { type: 'system_event', name: 'system1' }
      ]);

      const counts = eventService.getEventCountByType();

      expect(counts.user_action).toBe(2);
      expect(counts.error).toBe(1);
      expect(counts.system_event).toBe(1);
      expect(counts.performance).toBe(0);
      expect(counts.custom).toBe(0);
    });
  });

  describe('validateEvent', () => {
    it('should validate a valid event', () => {
      const event: TelemetryEvent = {
        type: 'user_action',
        name: 'valid_event'
      };

      const result = eventService.validateEvent(event);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject event with empty name', () => {
      const event: TelemetryEvent = {
        type: 'user_action',
        name: ''
      };

      const result = eventService.validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Event name is required');
    });

    it('should reject event with name too long', () => {
      const event: TelemetryEvent = {
        type: 'user_action',
        name: 'a'.repeat(256)
      };

      const result = eventService.validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Event name must be 255 characters or less');
    });

    it('should reject event with negative timestamp', () => {
      const event: TelemetryEvent = {
        type: 'user_action',
        name: 'test',
        timestamp: -1
      };

      const result = eventService.validateEvent(event);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Timestamp must be a positive number');
    });
  });

  describe('clearEvents', () => {
    it('should clear all events', async () => {
      await eventService.trackBatchEvents([
        { type: 'user_action', name: 'event1' },
        { type: 'user_action', name: 'event2' }
      ]);

      eventService.clearEvents();

      expect(eventService.getEventCount()).toBe(0);
    });
  });
});
