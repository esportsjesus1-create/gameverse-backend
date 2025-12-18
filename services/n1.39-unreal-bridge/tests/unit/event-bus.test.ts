import { EventBus } from '../../src/sdk/event-bus';
import { testLogger } from '../setup';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus(
      {
        maxListeners: 100,
        enableWildcard: true
      },
      testLogger
    );
  });

  afterEach(() => {
    eventBus.clear();
  });

  describe('subscribe', () => {
    it('should subscribe to event', () => {
      const handler = jest.fn();

      const subscriptionId = eventBus.subscribe('test-event', handler);

      expect(subscriptionId).toBeDefined();
      expect(subscriptionId).toMatch(/^sub_/);
    });

    it('should call handler when event is emitted', () => {
      const handler = jest.fn();
      eventBus.subscribe('test-event', handler);

      eventBus.emit('test-event', { data: 'test' });

      expect(handler).toHaveBeenCalledWith({ data: 'test' }, expect.any(Object));
    });

    it('should support once subscription', () => {
      const handler = jest.fn();
      eventBus.subscribe('test-event', handler, true);

      eventBus.emit('test-event', { data: 1 });
      eventBus.emit('test-event', { data: 2 });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe from event', () => {
      const handler = jest.fn();
      const subscriptionId = eventBus.subscribe('test-event', handler);

      const result = eventBus.unsubscribe(subscriptionId);

      expect(result).toBe(true);

      eventBus.emit('test-event', {});
      expect(handler).not.toHaveBeenCalled();
    });

    it('should return false for non-existent subscription', () => {
      const result = eventBus.unsubscribe('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('unsubscribeAll', () => {
    it('should unsubscribe all handlers for event type', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      eventBus.subscribe('test-event', handler1);
      eventBus.subscribe('test-event', handler2);

      const count = eventBus.unsubscribeAll('test-event');

      expect(count).toBe(2);

      eventBus.emit('test-event', {});
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should unsubscribe all handlers when no event type specified', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      eventBus.subscribe('event1', handler1);
      eventBus.subscribe('event2', handler2);

      const count = eventBus.unsubscribeAll();

      expect(count).toBe(2);
    });
  });

  describe('emit', () => {
    it('should emit event with data and context', () => {
      const handler = jest.fn();
      eventBus.subscribe('test-event', handler);

      eventBus.emit('test-event', { value: 'test' }, { clientId: 'client-1' });

      expect(handler).toHaveBeenCalledWith(
        { value: 'test' },
        expect.objectContaining({
          clientId: 'client-1',
          timestamp: expect.any(Number)
        })
      );
    });

    it('should emit wildcard event when enabled', () => {
      const wildcardHandler = jest.fn();
      eventBus.subscribe('*', wildcardHandler);

      eventBus.emit('specific-event', { data: 'test' });

      expect(wildcardHandler).toHaveBeenCalledWith(
        { eventType: 'specific-event', data: { data: 'test' } },
        expect.any(Object)
      );
    });
  });

  describe('emitFromPayload', () => {
    it('should emit event from payload object', () => {
      const handler = jest.fn();
      eventBus.subscribe('custom-event', handler);

      eventBus.emitFromPayload({
        eventType: 'custom-event',
        eventData: { value: 123 },
        broadcast: false
      });

      expect(handler).toHaveBeenCalledWith({ value: 123 }, expect.any(Object));
    });
  });

  describe('hasSubscribers', () => {
    it('should return true when event has subscribers', () => {
      eventBus.subscribe('test-event', jest.fn());

      expect(eventBus.hasSubscribers('test-event')).toBe(true);
    });

    it('should return false when event has no subscribers', () => {
      expect(eventBus.hasSubscribers('no-subscribers')).toBe(false);
    });
  });

  describe('getSubscriberCount', () => {
    it('should return count for specific event', () => {
      eventBus.subscribe('test-event', jest.fn());
      eventBus.subscribe('test-event', jest.fn());

      expect(eventBus.getSubscriberCount('test-event')).toBe(2);
    });

    it('should return total count when no event specified', () => {
      eventBus.subscribe('event1', jest.fn());
      eventBus.subscribe('event2', jest.fn());

      const count = eventBus.getSubscriberCount();
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getEventTypes', () => {
    it('should return all subscribed event types', () => {
      eventBus.subscribe('event1', jest.fn());
      eventBus.subscribe('event2', jest.fn());
      eventBus.subscribe('event1', jest.fn());

      const types = eventBus.getEventTypes();

      expect(types).toContain('event1');
      expect(types).toContain('event2');
      expect(types.length).toBe(2);
    });
  });

  describe('clear', () => {
    it('should remove all subscriptions', () => {
      eventBus.subscribe('event1', jest.fn());
      eventBus.subscribe('event2', jest.fn());

      eventBus.clear();

      expect(eventBus.getEventTypes().length).toBe(0);
    });
  });

  describe('wildcard disabled', () => {
    it('should not emit wildcard when disabled', () => {
      const noWildcardBus = new EventBus(
        { maxListeners: 100, enableWildcard: false },
        testLogger
      );

      const wildcardHandler = jest.fn();
      noWildcardBus.subscribe('*', wildcardHandler);

      noWildcardBus.emit('specific-event', {});

      expect(wildcardHandler).not.toHaveBeenCalled();
    });
  });
});
