/**
 * GameVerse Analytics Module - Metrics Service Tests
 * Comprehensive tests for metrics recording, querying, and aggregation
 */

import { metricsService } from '../../src/services/metrics.service';
import { cacheService } from '../../src/services/cache.service';
import { MetricType, MetricCategory, AggregationType, TimeGranularity } from '../../src/types';
import { AnalyticsErrorCode } from '../../src/utils/errors';

describe('MetricsService', () => {
  beforeEach(async () => {
    await metricsService.clearAllMetrics();
    cacheService.clear();
  });

  describe('createMetric', () => {
    it('should create a new metric', async () => {
      const metric = await metricsService.createMetric({
        name: 'test_metric',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
        description: 'Test metric description',
        unit: 'count',
        labels: { env: 'test' },
      });

      expect(metric.id).toBeDefined();
      expect(metric.name).toBe('test_metric');
      expect(metric.type).toBe(MetricType.COUNTER);
      expect(metric.category).toBe(MetricCategory.PLAYER);
      expect(metric.value).toBe(0);
      expect(metric.createdAt).toBeInstanceOf(Date);
    });

    it('should create metrics with different names', async () => {
      const metric1 = await metricsService.createMetric({
        name: 'unique_metric_1',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
      });

      const metric2 = await metricsService.createMetric({
        name: 'unique_metric_2',
        type: MetricType.GAUGE,
        category: MetricCategory.PERFORMANCE,
        value: 0,
      });

      expect(metric1.name).toBe('unique_metric_1');
      expect(metric2.name).toBe('unique_metric_2');
    });
  });

  describe('getMetricById', () => {
    it('should retrieve a metric by ID', async () => {
      const created = await metricsService.createMetric({
        name: 'get_test',
        type: MetricType.GAUGE,
        category: MetricCategory.PERFORMANCE,
        value: 0,
      });

      const retrieved = await metricsService.getMetricById(created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.name).toBe('get_test');
    });

    it('should throw error for non-existent metric', async () => {
      await expect(
        metricsService.getMetricById('non-existent-id')
      ).rejects.toMatchObject({
        code: AnalyticsErrorCode.METRICS_NOT_FOUND,
      });
    });
  });

  describe('updateMetric', () => {
    it('should update metric properties', async () => {
      const metric = await metricsService.createMetric({
        name: 'update_test',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
      });

      const updated = await metricsService.updateMetric(metric.id, {
        description: 'Updated description',
        labels: { updated: 'true' },
      });

      expect(updated.description).toBe('Updated description');
      expect(updated.labels).toEqual({ updated: 'true' });
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(metric.createdAt.getTime());
    });

    it('should throw error when updating non-existent metric', async () => {
      await expect(
        metricsService.updateMetric('non-existent', { description: 'test' })
      ).rejects.toMatchObject({
        code: AnalyticsErrorCode.METRICS_NOT_FOUND,
      });
    });
  });

  describe('deleteMetric', () => {
    it('should delete a metric', async () => {
      const metric = await metricsService.createMetric({
        name: 'delete_test',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
      });

      await metricsService.deleteMetric(metric.id);

      await expect(
        metricsService.getMetricById(metric.id)
      ).rejects.toMatchObject({
        code: AnalyticsErrorCode.METRICS_NOT_FOUND,
      });
    });
  });

  describe('recordMetric', () => {
    it('should record a counter metric (increment)', async () => {
      const metric = await metricsService.createMetric({
        name: 'counter_test',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
      });

      const updated = await metricsService.recordMetric({
        metricId: metric.id,
        name: 'counter_test',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 5,
      });

      expect(updated.value).toBe(5);

      const updated2 = await metricsService.recordMetric({
        metricId: metric.id,
        name: 'counter_test',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 3,
      });

      expect(updated2.value).toBe(8);
    });

    it('should record a gauge metric (set value)', async () => {
      const metric = await metricsService.createMetric({
        name: 'gauge_test',
        type: MetricType.GAUGE,
        category: MetricCategory.PERFORMANCE,
        value: 0,
      });

      await metricsService.recordMetric({
        metricId: metric.id,
        name: 'gauge_test',
        type: MetricType.GAUGE,
        category: MetricCategory.PERFORMANCE,
        value: 100,
      });

      const updated = await metricsService.recordMetric({
        metricId: metric.id,
        name: 'gauge_test',
        type: MetricType.GAUGE,
        category: MetricCategory.PERFORMANCE,
        value: 50,
      });

      expect(updated.value).toBe(50);
    });

    it('should record metric with labels', async () => {
      const metric = await metricsService.createMetric({
        name: 'labeled_metric_test',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
      });

      const updated = await metricsService.recordMetric({
        metricId: metric.id,
        name: 'labeled_metric_test',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 10,
        labels: { env: 'test', region: 'us-east' },
      });

      expect(updated.value).toBe(10);
    });
  });

  describe('recordMetricsBatch', () => {
    it('should record multiple metrics in batch', async () => {
      const metric1 = await metricsService.createMetric({
        name: 'batch_test_1',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
      });

      const metric2 = await metricsService.createMetric({
        name: 'batch_test_2',
        type: MetricType.GAUGE,
        category: MetricCategory.PERFORMANCE,
        value: 0,
      });

      const result = await metricsService.recordMetricsBatch({
        metrics: [
          { metricId: metric1.id, name: 'batch_test_1', type: MetricType.COUNTER, category: MetricCategory.PLAYER, value: 10 },
          { metricId: metric2.id, name: 'batch_test_2', type: MetricType.GAUGE, category: MetricCategory.PERFORMANCE, value: 50 },
        ],
      });

      expect(result.recorded).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should handle partial failures in batch', async () => {
      const metric = await metricsService.createMetric({
        name: 'batch_partial',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
      });

      const result = await metricsService.recordMetricsBatch({
        metrics: [
          { metricId: metric.id, name: 'batch_partial', type: MetricType.COUNTER, category: MetricCategory.PLAYER, value: 10 },
          { metricId: 'non-existent', name: 'non_existent', type: MetricType.COUNTER, category: MetricCategory.PLAYER, value: 20 },
        ],
      });

      expect(result.recorded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBe(1);
    });

    it('should throw error when batch size exceeds limit', async () => {
      const metrics = Array.from({ length: 1001 }, (_, i) => ({
        metricId: `metric-${i}`,
        name: `metric_${i}`,
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: i,
      }));

      await expect(
        metricsService.recordMetricsBatch({ metrics })
      ).rejects.toMatchObject({
        code: AnalyticsErrorCode.METRICS_BATCH_TOO_LARGE,
      });
    });
  });

  describe('queryMetrics', () => {
    beforeEach(async () => {
      await metricsService.createMetric({
        name: 'query_test_1',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
        labels: { env: 'prod' },
      });

      await metricsService.createMetric({
        name: 'query_test_2',
        type: MetricType.GAUGE,
        category: MetricCategory.PERFORMANCE,
        value: 0,
        labels: { env: 'test' },
      });

      await metricsService.createMetric({
        name: 'query_test_3',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
        labels: { env: 'prod' },
      });
    });

    it('should query metrics by name', async () => {
      const result = await metricsService.queryMetrics({
        names: ['query_test_1'],
        page: 1,
        limit: 10,
        sortOrder: 'desc',
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0].name).toBe('query_test_1');
    });

    it('should query metrics by type', async () => {
      const result = await metricsService.queryMetrics({
        types: [MetricType.COUNTER],
        page: 1,
        limit: 10,
        sortOrder: 'desc',
      });

      expect(result.data.length).toBe(2);
    });

    it('should query metrics by category', async () => {
      const result = await metricsService.queryMetrics({
        categories: [MetricCategory.PLAYER],
        page: 1,
        limit: 10,
        sortOrder: 'desc',
      });

      expect(result.data.length).toBe(2);
    });

    it('should query metrics with pagination', async () => {
      const result = await metricsService.queryMetrics({
        page: 1,
        limit: 2,
        sortOrder: 'desc',
      });

      expect(result.data.length).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
    });

    it('should query metrics with sorting', async () => {
      const result = await metricsService.queryMetrics({
        sortBy: 'name',
        sortOrder: 'asc',
        page: 1,
        limit: 10,
      });

      expect(result.data.length).toBe(3);
    });

    it('should return paginated results', async () => {
      const page1 = await metricsService.queryMetrics({
        page: 1,
        limit: 2,
        sortOrder: 'desc',
      });

      const page2 = await metricsService.queryMetrics({
        page: 2,
        limit: 2,
        sortOrder: 'desc',
      });

      expect(page1.data.length).toBe(2);
      expect(page2.data.length).toBe(1);
    });
  });

  describe('getMetricSeries', () => {
    it('should return time series data for a metric', async () => {
      const metric = await metricsService.createMetric({
        name: 'series_test',
        type: MetricType.GAUGE,
        category: MetricCategory.PERFORMANCE,
        value: 0,
      });

      await metricsService.recordMetric({
        metricId: metric.id,
        name: 'series_test',
        type: MetricType.GAUGE,
        category: MetricCategory.PERFORMANCE,
        value: 100,
      });

      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const series = await metricsService.getMetricSeries(
        metric.id,
        timeRange,
        TimeGranularity.HOUR
      );

      expect(series.metricId).toBe(metric.id);
      expect(series.dataPoints).toBeDefined();
    });
  });

  describe('aggregateMetric', () => {
    it('should compute SUM aggregation', async () => {
      const metric = await metricsService.createMetric({
        name: 'agg_sum_test',
        type: MetricType.HISTOGRAM,
        category: MetricCategory.PERFORMANCE,
        value: 0,
      });

      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const result = await metricsService.aggregateMetric(
        metric.id,
        AggregationType.SUM,
        timeRange
      );

      expect(result).toBeDefined();
    });

    it('should compute AVG aggregation', async () => {
      const metric = await metricsService.createMetric({
        name: 'agg_avg_test',
        type: MetricType.HISTOGRAM,
        category: MetricCategory.PERFORMANCE,
        value: 0,
      });

      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const result = await metricsService.aggregateMetric(
        metric.id,
        AggregationType.AVG,
        timeRange
      );

      expect(result).toBeDefined();
    });

    it('should compute COUNT aggregation', async () => {
      const metric = await metricsService.createMetric({
        name: 'agg_count_test',
        type: MetricType.HISTOGRAM,
        category: MetricCategory.PERFORMANCE,
        value: 0,
      });

      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const result = await metricsService.aggregateMetric(
        metric.id,
        AggregationType.COUNT,
        timeRange
      );

      expect(result).toBeDefined();
    });
  });

  describe('clearAllMetrics', () => {
    it('should clear all metrics', async () => {
      await metricsService.createMetric({
        name: 'clear_test',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
      });

      await metricsService.clearAllMetrics();

      const result = await metricsService.queryMetrics({
        page: 1,
        limit: 10,
        sortOrder: 'desc',
      });
      expect(result.data.length).toBe(0);
    });
  });
});
