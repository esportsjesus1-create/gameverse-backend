/**
 * GameVerse Analytics Module - Validation Schema Tests
 * Comprehensive tests for Zod validation schemas
 */

import {
  createMetricSchema,
  updateMetricSchema,
  recordMetricSchema,
  batchRecordMetricsSchema,
  queryMetricsSchema,
  trackEventSchema,
  batchTrackEventsSchema,
  queryEventsSchema,
  analyticsQuerySchema,
  createReportSchema,
  createDashboardSchema,
  createAlertSchema,
  createUserSchema,
  exportDataSchema,
  uuidSchema,
  timestampSchema,
  positiveIntSchema,
  nonNegativeIntSchema,
  percentageSchema,
  paginationSchema,
  timeRangeSchema,
} from '../../src/validation/schemas';
import { MetricType, MetricCategory, AnalyticsEventType, AggregationType, FilterOperator, ReportType, ReportFormat, AlertCondition, AlertSeverity } from '../../src/types';

describe('Common Schemas', () => {
  describe('uuidSchema', () => {
    it('should accept valid UUID', () => {
      const result = uuidSchema.safeParse('123e4567-e89b-12d3-a456-426614174000');
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = uuidSchema.safeParse('not-a-uuid');
      expect(result.success).toBe(false);
    });
  });

  describe('timestampSchema', () => {
    it('should accept valid date string', () => {
      const result = timestampSchema.safeParse('2024-01-01T00:00:00Z');
      expect(result.success).toBe(true);
    });

    it('should accept Date object', () => {
      const result = timestampSchema.safeParse(new Date());
      expect(result.success).toBe(true);
    });

    it('should reject invalid date', () => {
      const result = timestampSchema.safeParse('not-a-date');
      expect(result.success).toBe(false);
    });
  });

  describe('positiveIntSchema', () => {
    it('should accept positive integer', () => {
      const result = positiveIntSchema.safeParse(5);
      expect(result.success).toBe(true);
    });

    it('should reject zero', () => {
      const result = positiveIntSchema.safeParse(0);
      expect(result.success).toBe(false);
    });

    it('should reject negative number', () => {
      const result = positiveIntSchema.safeParse(-5);
      expect(result.success).toBe(false);
    });
  });

  describe('nonNegativeIntSchema', () => {
    it('should accept zero', () => {
      const result = nonNegativeIntSchema.safeParse(0);
      expect(result.success).toBe(true);
    });

    it('should accept positive integer', () => {
      const result = nonNegativeIntSchema.safeParse(10);
      expect(result.success).toBe(true);
    });

    it('should reject negative number', () => {
      const result = nonNegativeIntSchema.safeParse(-1);
      expect(result.success).toBe(false);
    });
  });

  describe('percentageSchema', () => {
    it('should accept valid percentage', () => {
      const result = percentageSchema.safeParse(50);
      expect(result.success).toBe(true);
    });

    it('should accept 0', () => {
      const result = percentageSchema.safeParse(0);
      expect(result.success).toBe(true);
    });

    it('should accept 100', () => {
      const result = percentageSchema.safeParse(100);
      expect(result.success).toBe(true);
    });

    it('should reject values over 100', () => {
      const result = percentageSchema.safeParse(101);
      expect(result.success).toBe(false);
    });

    it('should reject negative values', () => {
      const result = percentageSchema.safeParse(-1);
      expect(result.success).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('should accept valid pagination', () => {
      const result = paginationSchema.safeParse({ page: 1, limit: 10 });
      expect(result.success).toBe(true);
    });

    it('should use default values', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(50);
      }
    });

    it('should reject page less than 1', () => {
      const result = paginationSchema.safeParse({ page: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject limit over 1000', () => {
      const result = paginationSchema.safeParse({ limit: 1001 });
      expect(result.success).toBe(false);
    });
  });

  describe('timeRangeSchema', () => {
    it('should accept valid time range', () => {
      const result = timeRangeSchema.safeParse({
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      });
      expect(result.success).toBe(true);
    });

    it('should reject when end is before start', () => {
      const result = timeRangeSchema.safeParse({
        start: new Date('2024-01-31'),
        end: new Date('2024-01-01'),
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Metrics Schemas', () => {
  describe('createMetricSchema', () => {
    it('should accept valid metric creation', () => {
      const result = createMetricSchema.safeParse({
        name: 'testMetric',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        description: 'Test metric',
        unit: 'count',
        value: 0,
        labels: { env: 'test' },
      });
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const result = createMetricSchema.safeParse({
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
      });
      expect(result.success).toBe(false);
    });

    it('should require type', () => {
      const result = createMetricSchema.safeParse({
        name: 'test_metric',
        category: MetricCategory.PLAYER,
      });
      expect(result.success).toBe(false);
    });

    it('should require category', () => {
      const result = createMetricSchema.safeParse({
        name: 'test_metric',
        type: MetricType.COUNTER,
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid metric type', () => {
      const result = createMetricSchema.safeParse({
        name: 'test_metric',
        type: 'INVALID_TYPE',
        category: MetricCategory.PLAYER,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateMetricSchema', () => {
    it('should accept partial updates', () => {
      const result = updateMetricSchema.safeParse({
        description: 'Updated description',
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
      const result = updateMetricSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('recordMetricSchema', () => {
    it('should accept valid metric recording', () => {
      const result = recordMetricSchema.safeParse({
        metricId: '123e4567-e89b-12d3-a456-426614174000',
        name: 'testMetric',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 100,
        labels: {},
      });
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const result = recordMetricSchema.safeParse({
        value: 100,
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        labels: {},
      });
      expect(result.success).toBe(false);
    });

    it('should require value', () => {
      const result = recordMetricSchema.safeParse({
        name: 'testMetric',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        labels: {},
      });
      expect(result.success).toBe(false);
    });
  });

  describe('batchRecordMetricsSchema', () => {
    it('should accept valid batch', () => {
      const result = batchRecordMetricsSchema.safeParse({
        metrics: [
          { name: 'metric1', type: MetricType.COUNTER, category: MetricCategory.PLAYER, value: 100, labels: {} },
          { name: 'metric2', type: MetricType.GAUGE, category: MetricCategory.PERFORMANCE, value: 200, labels: {} },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should require at least one metric', () => {
      const result = batchRecordMetricsSchema.safeParse({
        metrics: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('queryMetricsSchema', () => {
    it('should accept valid query', () => {
      const result = queryMetricsSchema.safeParse({
        names: ['metric1', 'metric2'],
        types: [MetricType.COUNTER],
        categories: [MetricCategory.PLAYER],
        page: 1,
        limit: 10,
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty query', () => {
      const result = queryMetricsSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

describe('Events Schemas', () => {
  describe('trackEventSchema', () => {
    it('should accept valid event', () => {
      const result = trackEventSchema.safeParse({
        type: AnalyticsEventType.PLAYER_LOGIN,
        playerId: 'player-123',
        sessionId: 'session-456',
        payload: { action: 'login' },
        metadata: { source: 'web', version: '1.0' },
      });
      expect(result.success).toBe(true);
    });

    it('should require type', () => {
      const result = trackEventSchema.safeParse({
        playerId: 'player-123',
        sessionId: 'session-456',
        payload: {},
      });
      expect(result.success).toBe(false);
    });

    it('should require playerId', () => {
      const result = trackEventSchema.safeParse({
        type: AnalyticsEventType.PLAYER_LOGIN,
        sessionId: 'session-456',
        payload: {},
      });
      expect(result.success).toBe(false);
    });

    it('should require sessionId', () => {
      const result = trackEventSchema.safeParse({
        type: AnalyticsEventType.PLAYER_LOGIN,
        playerId: 'player-123',
        payload: {},
      });
      expect(result.success).toBe(false);
    });
  });

  describe('batchTrackEventsSchema', () => {
    it('should accept valid batch', () => {
      const result = batchTrackEventsSchema.safeParse({
        events: [
          {
            type: AnalyticsEventType.PLAYER_LOGIN,
            playerId: 'player-1',
            sessionId: 'session-1',
            payload: {},
            metadata: { source: 'test-app' },
          },
          {
            type: AnalyticsEventType.PLAYER_LOGOUT,
            playerId: 'player-2',
            sessionId: 'session-2',
            payload: {},
            metadata: { source: 'test-app' },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should require at least one event', () => {
      const result = batchTrackEventsSchema.safeParse({
        events: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('queryEventsSchema', () => {
    it('should accept valid query', () => {
      const result = queryEventsSchema.safeParse({
        types: [AnalyticsEventType.PLAYER_LOGIN],
        playerId: 'player-123',
        sessionId: 'session-456',
        page: 1,
        limit: 10,
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty query', () => {
      const result = queryEventsSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

describe('Query Schemas', () => {
  describe('analyticsQuerySchema', () => {
    it('should accept valid query', () => {
      const result = analyticsQuerySchema.safeParse({
        metrics: ['metric1'],
        aggregations: [{ field: 'value', type: AggregationType.SUM }],
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
        limit: 100,
        offset: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should accept query with filters', () => {
      const result = analyticsQuerySchema.safeParse({
        metrics: ['metric1'],
        filters: [
          { field: 'category', operator: FilterOperator.EQ, value: 'PLAYER' },
        ],
        aggregations: [{ field: 'value', type: AggregationType.SUM }],
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
        limit: 100,
        offset: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should accept query with groupBy', () => {
      const result = analyticsQuerySchema.safeParse({
        metrics: ['metric1'],
        groupBy: ['category', 'type'],
        aggregations: [{ field: 'value', type: AggregationType.SUM }],
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
        limit: 100,
        offset: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should require metrics', () => {
      const result = analyticsQuerySchema.safeParse({
        aggregations: [{ field: 'value', type: AggregationType.SUM }],
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
        limit: 100,
        offset: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should require aggregations', () => {
      const result = analyticsQuerySchema.safeParse({
        metrics: ['metric1'],
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
        limit: 100,
        offset: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should require timeRange', () => {
      const result = analyticsQuerySchema.safeParse({
        metrics: ['metric1'],
        aggregations: [{ field: 'value', type: AggregationType.SUM }],
        limit: 100,
        offset: 0,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Report Schemas', () => {
  describe('createReportSchema', () => {
    it('should accept valid report', () => {
      const result = createReportSchema.safeParse({
        name: 'Test Report',
        type: ReportType.AD_HOC,
        format: ReportFormat.JSON,
        query: {
          metrics: ['metric1'],
          aggregations: [{ field: 'value', type: AggregationType.SUM }],
          timeRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-31'),
          },
          limit: 100,
          offset: 0,
        },
      });
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const result = createReportSchema.safeParse({
        type: 'SUMMARY',
        format: 'JSON',
        query: {
          metrics: ['metric1'],
          aggregations: [{ field: 'value', type: AggregationType.SUM }],
          timeRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-31'),
          },
          limit: 100,
          offset: 0,
        },
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Dashboard Schemas', () => {
  describe('createDashboardSchema', () => {
    it('should accept valid dashboard', () => {
      const result = createDashboardSchema.safeParse({
        name: 'Test Dashboard',
        description: 'A test dashboard',
        widgets: [],
      });
      expect(result.success).toBe(true);
    });

    it('should accept dashboard with widgets', () => {
      const result = createDashboardSchema.safeParse({
        name: 'Test Dashboard',
        widgets: [
          {
            id: 'widget-1',
            type: 'CHART',
            title: 'Test Widget',
            query: {
              metrics: ['metric1'],
              aggregations: [{ field: 'value', type: AggregationType.SUM }],
              timeRange: {
                start: new Date('2024-01-01'),
                end: new Date('2024-01-31'),
              },
              limit: 100,
              offset: 0,
            },
            visualization: 'LINE',
            position: { x: 0, y: 0 },
            size: { width: 4, height: 3 },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const result = createDashboardSchema.safeParse({
        widgets: [],
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Alert Schemas', () => {
  describe('createAlertSchema', () => {
    it('should accept valid alert', () => {
      const result = createAlertSchema.safeParse({
        name: 'Test Alert',
        metricId: '123e4567-e89b-12d3-a456-426614174000',
        condition: AlertCondition.ABOVE,
        threshold: 100,
        severity: AlertSeverity.WARNING,
        channels: [{ type: 'EMAIL', config: { email: 'test@example.com' } }],
      });
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const result = createAlertSchema.safeParse({
        metricId: '123e4567-e89b-12d3-a456-426614174000',
        condition: 'GREATER_THAN',
        threshold: 100,
        severity: 'WARNING',
        channels: [],
      });
      expect(result.success).toBe(false);
    });

    it('should require metricId', () => {
      const result = createAlertSchema.safeParse({
        name: 'Test Alert',
        condition: 'GREATER_THAN',
        threshold: 100,
        severity: 'WARNING',
        channels: [],
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('User Schemas', () => {
  describe('createUserSchema', () => {
    it('should accept valid user', () => {
      const result = createUserSchema.safeParse({
        externalId: 'ext-123',
        role: 'ANALYST',
        tier: 'STANDARD',
      });
      expect(result.success).toBe(true);
    });

    it('should use default role if not provided', () => {
      const result = createUserSchema.safeParse({
        externalId: 'ext-123',
        tier: 'STANDARD',
      });
      // Schema has default values for role, tier, and permissions
      expect(result.success).toBe(true);
    });

    it('should use default tier if not provided', () => {
      const result = createUserSchema.safeParse({
        externalId: 'ext-123',
        role: 'ANALYST',
      });
      // Schema has default values for role, tier, and permissions
      expect(result.success).toBe(true);
    });

    it('should accept empty object with defaults', () => {
      const result = createUserSchema.safeParse({});
      // Schema has default values for role, tier, and permissions
      expect(result.success).toBe(true);
    });
  });
});

describe('Export Schemas', () => {
  describe('exportDataSchema', () => {
    it('should accept valid export request', () => {
      const result = exportDataSchema.safeParse({
        type: 'metrics',
        format: 'JSON',
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
      });
      expect(result.success).toBe(true);
    });

    it('should require type', () => {
      const result = exportDataSchema.safeParse({
        format: 'JSON',
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
      });
      expect(result.success).toBe(false);
    });

    it('should require format', () => {
      const result = exportDataSchema.safeParse({
        type: 'metrics',
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
      });
      expect(result.success).toBe(false);
    });

    it('should require timeRange', () => {
      const result = exportDataSchema.safeParse({
        type: 'metrics',
        format: 'JSON',
      });
      expect(result.success).toBe(false);
    });
  });
});
