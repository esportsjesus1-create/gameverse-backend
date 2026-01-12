import { MetricsService } from '../../src/services/MetricsService';
import { Metric } from '../../src/types';

describe('MetricsService', () => {
  let metricsService: MetricsService;

  beforeEach(() => {
    metricsService = new MetricsService();
  });

  afterEach(() => {
    metricsService.clearMetrics();
  });

  describe('recordMetric', () => {
    it('should record a counter metric', () => {
      const metric: Metric = {
        name: 'requests_total',
        type: 'counter',
        value: 1
      };

      const stored = metricsService.recordMetric(metric);

      expect(stored.id).toBeDefined();
      expect(stored.name).toBe('requests_total');
      expect(stored.type).toBe('counter');
      expect(stored.value).toBe(1);
      expect(stored.timestamp).toBeDefined();
    });

    it('should record a gauge metric', () => {
      const metric: Metric = {
        name: 'temperature',
        type: 'gauge',
        value: 25.5,
        unit: 'celsius'
      };

      const stored = metricsService.recordMetric(metric);

      expect(stored.name).toBe('temperature');
      expect(stored.type).toBe('gauge');
      expect(stored.value).toBe(25.5);
      expect(stored.unit).toBe('celsius');
    });

    it('should record a histogram metric', () => {
      const metric: Metric = {
        name: 'response_time',
        type: 'histogram',
        value: 150,
        tags: { endpoint: '/api/users' }
      };

      const stored = metricsService.recordMetric(metric);

      expect(stored.name).toBe('response_time');
      expect(stored.type).toBe('histogram');
      expect(stored.tags).toEqual({ endpoint: '/api/users' });
    });

    it('should use provided timestamp', () => {
      const timestamp = Date.now() - 1000;
      const metric: Metric = {
        name: 'test',
        type: 'counter',
        value: 1,
        timestamp
      };

      const stored = metricsService.recordMetric(metric);

      expect(stored.timestamp).toBe(timestamp);
    });
  });

  describe('recordBatchMetrics', () => {
    it('should record multiple metrics', () => {
      const metrics: Metric[] = [
        { name: 'metric1', type: 'counter', value: 1 },
        { name: 'metric2', type: 'gauge', value: 50 },
        { name: 'metric3', type: 'histogram', value: 100 }
      ];

      const stored = metricsService.recordBatchMetrics(metrics);

      expect(stored).toHaveLength(3);
    });
  });

  describe('incrementCounter', () => {
    it('should increment counter by default value', () => {
      metricsService.incrementCounter('requests');
      metricsService.incrementCounter('requests');
      metricsService.incrementCounter('requests');

      expect(metricsService.getCounterValue('requests')).toBe(3);
    });

    it('should increment counter by specified value', () => {
      metricsService.incrementCounter('requests', 5);
      metricsService.incrementCounter('requests', 3);

      expect(metricsService.getCounterValue('requests')).toBe(8);
    });
  });

  describe('setGauge', () => {
    it('should set gauge value', () => {
      metricsService.setGauge('memory_usage', 75);

      expect(metricsService.getGaugeValue('memory_usage')).toBe(75);
    });

    it('should update gauge value', () => {
      metricsService.setGauge('memory_usage', 75);
      metricsService.setGauge('memory_usage', 80);

      expect(metricsService.getGaugeValue('memory_usage')).toBe(80);
    });
  });

  describe('recordHistogram', () => {
    it('should record histogram value', () => {
      const stored = metricsService.recordHistogram('response_time', 150);

      expect(stored.name).toBe('response_time');
      expect(stored.type).toBe('histogram');
      expect(stored.value).toBe(150);
    });
  });

  describe('getCounterValue', () => {
    it('should return 0 for non-existent counter', () => {
      expect(metricsService.getCounterValue('non_existent')).toBe(0);
    });
  });

  describe('getGaugeValue', () => {
    it('should return undefined for non-existent gauge', () => {
      expect(metricsService.getGaugeValue('non_existent')).toBeUndefined();
    });
  });

  describe('getMetrics', () => {
    it('should return metrics by name', () => {
      metricsService.recordMetric({ name: 'test', type: 'counter', value: 1 });
      metricsService.recordMetric({ name: 'test', type: 'counter', value: 2 });
      metricsService.recordMetric({ name: 'other', type: 'counter', value: 3 });

      const metrics = metricsService.getMetrics('test');

      expect(metrics).toHaveLength(2);
    });

    it('should return empty array for non-existent metric', () => {
      const metrics = metricsService.getMetrics('non_existent');
      expect(metrics).toHaveLength(0);
    });
  });

  describe('queryMetrics', () => {
    beforeEach(() => {
      const now = Date.now();
      metricsService.recordMetric({ name: 'metric1', type: 'counter', value: 1, timestamp: now - 3000 });
      metricsService.recordMetric({ name: 'metric2', type: 'gauge', value: 50, timestamp: now - 2000 });
      metricsService.recordMetric({ name: 'metric1', type: 'counter', value: 2, timestamp: now - 1000 });
    });

    it('should return all metrics with default options', () => {
      const result = metricsService.queryMetrics();

      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should filter by metricName', () => {
      const result = metricsService.queryMetrics({ metricName: 'metric1' });

      expect(result.data).toHaveLength(2);
    });

    it('should apply pagination', () => {
      const result = metricsService.queryMetrics({ limit: 2, offset: 0 });

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });

    it('should filter by time range', () => {
      const now = Date.now();
      const result = metricsService.queryMetrics({
        startTime: now - 2500,
        endTime: now - 500
      });

      expect(result.data).toHaveLength(2);
    });
  });

  describe('getAggregatedMetrics', () => {
    it('should aggregate metrics by hour', () => {
      const now = Date.now();
      metricsService.recordMetric({ name: 'test', type: 'histogram', value: 100, timestamp: now });
      metricsService.recordMetric({ name: 'test', type: 'histogram', value: 200, timestamp: now });
      metricsService.recordMetric({ name: 'test', type: 'histogram', value: 300, timestamp: now });

      const aggregated = metricsService.getAggregatedMetrics('test', 'hour');

      expect(aggregated.length).toBeGreaterThanOrEqual(1);
      if (aggregated[0]) {
        expect(aggregated[0].count).toBe(3);
        expect(aggregated[0].sum).toBe(600);
        expect(aggregated[0].avg).toBe(200);
        expect(aggregated[0].min).toBe(100);
        expect(aggregated[0].max).toBe(300);
      }
    });

    it('should return empty array for non-existent metric', () => {
      const aggregated = metricsService.getAggregatedMetrics('non_existent', 'hour');
      expect(aggregated).toHaveLength(0);
    });
  });

  describe('getMetricTimeSeries', () => {
    it('should return time series data', () => {
      const now = Date.now();
      metricsService.recordMetric({ name: 'test', type: 'gauge', value: 10, timestamp: now - 2000 });
      metricsService.recordMetric({ name: 'test', type: 'gauge', value: 20, timestamp: now - 1000 });
      metricsService.recordMetric({ name: 'test', type: 'gauge', value: 30, timestamp: now });

      const timeSeries = metricsService.getMetricTimeSeries('test');

      expect(timeSeries).toHaveLength(3);
      expect(timeSeries[0]?.value).toBe(10);
      expect(timeSeries[2]?.value).toBe(30);
    });
  });

  describe('getMetricNames', () => {
    it('should return all metric names', () => {
      metricsService.recordMetric({ name: 'metric1', type: 'counter', value: 1 });
      metricsService.recordMetric({ name: 'metric2', type: 'gauge', value: 50 });
      metricsService.recordMetric({ name: 'metric3', type: 'histogram', value: 100 });

      const names = metricsService.getMetricNames();

      expect(names).toContain('metric1');
      expect(names).toContain('metric2');
      expect(names).toContain('metric3');
    });
  });

  describe('getMetricCount', () => {
    it('should return total metric count', () => {
      metricsService.recordMetric({ name: 'metric1', type: 'counter', value: 1 });
      metricsService.recordMetric({ name: 'metric1', type: 'counter', value: 2 });
      metricsService.recordMetric({ name: 'metric2', type: 'gauge', value: 50 });

      expect(metricsService.getMetricCount()).toBe(3);
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics', () => {
      metricsService.recordMetric({ name: 'test', type: 'counter', value: 1 });
      metricsService.incrementCounter('counter');
      metricsService.setGauge('gauge', 50);

      metricsService.clearMetrics();

      expect(metricsService.getMetricCount()).toBe(0);
      expect(metricsService.getCounterValue('counter')).toBe(0);
      expect(metricsService.getGaugeValue('gauge')).toBeUndefined();
    });
  });

  describe('deleteOldMetrics', () => {
    it('should delete metrics older than retention period', () => {
      const now = Date.now();
      metricsService.recordMetric({ name: 'old', type: 'counter', value: 1, timestamp: now - 10000 });
      metricsService.recordMetric({ name: 'new', type: 'counter', value: 2, timestamp: now });

      const deleted = metricsService.deleteOldMetrics(5000);

      expect(deleted).toBe(1);
      expect(metricsService.getMetricCount()).toBe(1);
    });
  });
});
