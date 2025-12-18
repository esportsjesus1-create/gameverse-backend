import { AggregationService } from '../../src/services/AggregationService';
import { eventService } from '../../src/services/EventService';
import { metricsService } from '../../src/services/MetricsService';

describe('AggregationService', () => {
  let aggregationService: AggregationService;

  beforeEach(() => {
    aggregationService = new AggregationService();
    eventService.clearEvents();
    metricsService.clearMetrics();
  });

  afterEach(() => {
    aggregationService.clearCache();
    eventService.stopFlushTimer();
  });

  describe('aggregateMetrics', () => {
    it('should aggregate metrics by hour', () => {
      const now = Date.now();
      metricsService.recordMetric({ name: 'test', type: 'histogram', value: 100, timestamp: now });
      metricsService.recordMetric({ name: 'test', type: 'histogram', value: 200, timestamp: now });

      const aggregated = aggregationService.aggregateMetrics('test', 'hour');

      expect(aggregated.length).toBeGreaterThanOrEqual(1);
    });

    it('should cache aggregated results', () => {
      const now = Date.now();
      metricsService.recordMetric({ name: 'test', type: 'histogram', value: 100, timestamp: now });

      const first = aggregationService.aggregateMetrics('test', 'hour');
      const second = aggregationService.aggregateMetrics('test', 'hour');

      expect(first).toEqual(second);
    });
  });

  describe('aggregateEvents', () => {
    it('should aggregate events by hour', async () => {
      const now = Date.now();
      await eventService.trackBatchEvents([
        { type: 'user_action', name: 'click', userId: 'user1', sessionId: 'session1', timestamp: now },
        { type: 'error', name: 'error', userId: 'user2', sessionId: 'session2', timestamp: now }
      ]);

      const aggregated = aggregationService.aggregateEvents('hour');

      expect(aggregated.length).toBeGreaterThanOrEqual(1);
      if (aggregated[0]) {
        expect(aggregated[0].totalEvents).toBe(2);
        expect(aggregated[0].uniqueUsers).toBe(2);
        expect(aggregated[0].uniqueSessions).toBe(2);
      }
    });

    it('should group events by type', async () => {
      const now = Date.now();
      await eventService.trackBatchEvents([
        { type: 'user_action', name: 'click', timestamp: now },
        { type: 'user_action', name: 'scroll', timestamp: now },
        { type: 'error', name: 'error', timestamp: now }
      ]);

      const aggregated = aggregationService.aggregateEvents('hour');

      if (aggregated[0]) {
        expect(aggregated[0].eventsByType['user_action']).toBe(2);
        expect(aggregated[0].eventsByType['error']).toBe(1);
      }
    });
  });

  describe('getTimeSeriesData', () => {
    it('should return time series data for metrics', () => {
      const now = Date.now();
      metricsService.recordMetric({ name: 'test', type: 'gauge', value: 10, timestamp: now - 2000 });
      metricsService.recordMetric({ name: 'test', type: 'gauge', value: 20, timestamp: now - 1000 });
      metricsService.recordMetric({ name: 'test', type: 'gauge', value: 30, timestamp: now });

      const timeSeries = aggregationService.getTimeSeriesData('test', 'hour');

      expect(timeSeries.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getEventTimeSeries', () => {
    it('should return time series data for events', async () => {
      const now = Date.now();
      await eventService.trackBatchEvents([
        { type: 'user_action', name: 'event1', timestamp: now - 2000 },
        { type: 'user_action', name: 'event2', timestamp: now - 1000 },
        { type: 'user_action', name: 'event3', timestamp: now }
      ]);

      const timeSeries = aggregationService.getEventTimeSeries('hour');

      expect(timeSeries.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('compareMetrics', () => {
    it('should compare metrics between two periods', () => {
      const now = Date.now();
      const hourAgo = now - 60 * 60 * 1000;
      const twoHoursAgo = now - 2 * 60 * 60 * 1000;

      metricsService.recordMetric({ name: 'test', type: 'counter', value: 100, timestamp: twoHoursAgo });
      metricsService.recordMetric({ name: 'test', type: 'counter', value: 150, timestamp: now });

      const comparison = aggregationService.compareMetrics(
        'test',
        'hour',
        hourAgo,
        now,
        twoHoursAgo,
        hourAgo
      );

      expect(comparison.current).toBeDefined();
      expect(comparison.previous).toBeDefined();
      expect(comparison.changePercent).toBeDefined();
    });
  });

  describe('getTopMetrics', () => {
    it('should return top metrics by total value', () => {
      const now = Date.now();
      metricsService.recordMetric({ name: 'metric1', type: 'counter', value: 100, timestamp: now });
      metricsService.recordMetric({ name: 'metric2', type: 'counter', value: 200, timestamp: now });
      metricsService.recordMetric({ name: 'metric3', type: 'counter', value: 50, timestamp: now });

      const topMetrics = aggregationService.getTopMetrics('hour', undefined, undefined, 2);

      expect(topMetrics).toHaveLength(2);
      expect(topMetrics[0]?.name).toBe('metric2');
    });
  });

  describe('getTopEvents', () => {
    it('should return top events by count', async () => {
      await eventService.trackBatchEvents([
        { type: 'user_action', name: 'click' },
        { type: 'user_action', name: 'click' },
        { type: 'user_action', name: 'click' },
        { type: 'user_action', name: 'scroll' },
        { type: 'user_action', name: 'scroll' }
      ]);

      const topEvents = aggregationService.getTopEvents(undefined, undefined, 2);

      expect(topEvents).toHaveLength(2);
      expect(topEvents[0]?.name).toBe('click');
      expect(topEvents[0]?.count).toBe(3);
    });
  });

  describe('setRetentionPolicy', () => {
    it('should set retention policy for a period', () => {
      aggregationService.setRetentionPolicy('day', 60);

      const policies = aggregationService.getRetentionPolicies();
      const dayPolicy = policies.find(p => p.period === 'day');

      expect(dayPolicy?.retentionDays).toBe(60);
    });

    it('should update existing retention policy', () => {
      aggregationService.setRetentionPolicy('day', 30);
      aggregationService.setRetentionPolicy('day', 60);

      const policies = aggregationService.getRetentionPolicies();
      const dayPolicies = policies.filter(p => p.period === 'day');

      expect(dayPolicies).toHaveLength(1);
      expect(dayPolicies[0]?.retentionDays).toBe(60);
    });
  });

  describe('getRetentionPolicies', () => {
    it('should return default retention policies', () => {
      const policies = aggregationService.getRetentionPolicies();

      expect(policies.length).toBeGreaterThan(0);
      expect(policies.some(p => p.period === 'minute')).toBe(true);
      expect(policies.some(p => p.period === 'hour')).toBe(true);
      expect(policies.some(p => p.period === 'day')).toBe(true);
    });
  });

  describe('applyRetentionPolicies', () => {
    it('should apply retention policies and return deleted counts', () => {
      const result = aggregationService.applyRetentionPolicies();

      expect(result.deletedMetrics).toBeDefined();
      expect(result.deletedEvents).toBeDefined();
    });
  });

  describe('clearCache', () => {
    it('should clear aggregation cache', () => {
      const now = Date.now();
      metricsService.recordMetric({ name: 'test', type: 'histogram', value: 100, timestamp: now });

      aggregationService.aggregateMetrics('test', 'hour');
      const statsBefore = aggregationService.getCacheStats();

      aggregationService.clearCache();
      const statsAfter = aggregationService.getCacheStats();

      expect(statsBefore.metricsEntries).toBeGreaterThan(0);
      expect(statsAfter.metricsEntries).toBe(0);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = aggregationService.getCacheStats();

      expect(stats.metricsEntries).toBeDefined();
      expect(stats.eventsEntries).toBeDefined();
    });
  });
});
