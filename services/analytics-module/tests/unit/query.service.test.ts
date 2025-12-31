/**
 * GameVerse Analytics Module - Query Service Tests
 * Comprehensive tests for analytics query execution and management
 */

import { queryService } from '../../src/services/query.service';
import { metricsService } from '../../src/services/metrics.service';
import { cacheService } from '../../src/services/cache.service';
import { MetricType, MetricCategory, AggregationType, FilterOperator } from '../../src/types';

describe('QueryService', () => {
  beforeEach(async () => {
    await metricsService.clearAllMetrics();
    await queryService.clearAllQueries();
    cacheService.clear();
  });

  describe('executeQuery', () => {
    beforeEach(async () => {
      const metric1 = await metricsService.createMetric({
        name: 'query_metric_1',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
      });

      const metric2 = await metricsService.createMetric({
        name: 'query_metric_2',
        type: MetricType.GAUGE,
        category: MetricCategory.PERFORMANCE,
        value: 0,
      });

      await metricsService.recordMetric({
        metricId: metric1.id,
        name: 'query_metric_1',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 100,
      });

      await metricsService.recordMetric({
        metricId: metric1.id,
        name: 'query_metric_1',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 200,
      });

      await metricsService.recordMetric({
        metricId: metric2.id,
        name: 'query_metric_2',
        type: MetricType.GAUGE,
        category: MetricCategory.PERFORMANCE,
        value: 50,
      });
    });

    it('should execute a basic query with aggregation', async () => {
      const result = await queryService.executeQuery({
        metrics: ['query_metric_1'],
        filters: [],
        aggregations: [{ field: 'value', type: AggregationType.SUM }],
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        limit: 100,
        offset: 0,
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });

    it('should execute query with filters', async () => {
      const result = await queryService.executeQuery({
        metrics: ['query_metric_1'],
        filters: [
          { field: 'category', operator: FilterOperator.EQ, value: 'PLAYER' },
        ],
        aggregations: [{ field: 'value', type: AggregationType.SUM }],
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        limit: 100,
        offset: 0,
      });

      expect(result).toBeDefined();
    });

    it('should execute query with groupBy', async () => {
      const result = await queryService.executeQuery({
        metrics: ['query_metric_1', 'query_metric_2'],
        filters: [],
        groupBy: ['category'],
        aggregations: [
          { field: 'value', type: AggregationType.SUM, alias: 'total' },
          { field: 'value', type: AggregationType.AVG, alias: 'average' },
        ],
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        limit: 100,
        offset: 0,
      });

      expect(result).toBeDefined();
    });

    it('should execute query with orderBy', async () => {
      const result = await queryService.executeQuery({
        metrics: ['query_metric_1', 'query_metric_2'],
        filters: [],
        aggregations: [{ field: 'value', type: AggregationType.SUM }],
        orderBy: [{ field: 'value', direction: 'DESC' }],
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        limit: 100,
        offset: 0,
      });

      expect(result).toBeDefined();
    });
  });

  describe('saveQuery', () => {
    it('should save a query', async () => {
      await metricsService.createMetric({
        name: 'save_query_metric',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
      });

      const savedQuery = await queryService.saveQuery({
        name: 'Test Saved Query',
        metrics: ['save_query_metric'],
        filters: [],
        aggregations: [{ field: 'value', type: AggregationType.SUM }],
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        limit: 100,
        offset: 0,
      });

      expect(savedQuery.id).toBeDefined();
      expect(savedQuery.name).toBe('Test Saved Query');
    });

    it('should save multiple queries with different names', async () => {
      await metricsService.createMetric({
        name: 'multi_query_metric',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
      });

      const query1 = await queryService.saveQuery({
        name: 'Query One',
        metrics: ['multi_query_metric'],
        filters: [],
        aggregations: [{ field: 'value', type: AggregationType.SUM }],
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        limit: 100,
        offset: 0,
      });

      const query2 = await queryService.saveQuery({
        name: 'Query Two',
        metrics: ['multi_query_metric'],
        filters: [],
        aggregations: [{ field: 'value', type: AggregationType.AVG }],
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        limit: 100,
        offset: 0,
      });

      expect(query1.name).toBe('Query One');
      expect(query2.name).toBe('Query Two');
    });
  });

  describe('getSavedQuery', () => {
    it('should retrieve a saved query by ID', async () => {
      await metricsService.createMetric({
        name: 'get_query_metric',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
      });

      const saved = await queryService.saveQuery({
        name: 'Get Query Test',
        metrics: ['get_query_metric'],
        filters: [],
        aggregations: [{ field: 'value', type: AggregationType.SUM }],
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        limit: 100,
        offset: 0,
      });

      const retrieved = await queryService.getSavedQuery(saved.id);

      expect(retrieved.id).toBe(saved.id);
      expect(retrieved.name).toBe('Get Query Test');
    });

    it('should throw error for non-existent query', async () => {
      await expect(
        queryService.getSavedQuery('non-existent-id')
      ).rejects.toThrow();
    });
  });

  describe('deleteSavedQuery', () => {
    it('should delete a saved query', async () => {
      await metricsService.createMetric({
        name: 'delete_query_metric',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
      });

      const saved = await queryService.saveQuery({
        name: 'Delete Query Test',
        metrics: ['delete_query_metric'],
        filters: [],
        aggregations: [{ field: 'value', type: AggregationType.SUM }],
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        limit: 100,
        offset: 0,
      });

      await queryService.deleteSavedQuery(saved.id);

      await expect(
        queryService.getSavedQuery(saved.id)
      ).rejects.toThrow();
    });
  });

  describe('executeSavedQuery', () => {
    it('should execute a saved query', async () => {
      await metricsService.createMetric({
        name: 'exec_saved_metric',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
      });

      const saved = await queryService.saveQuery({
        name: 'Execute Saved Query Test',
        metrics: ['exec_saved_metric'],
        filters: [],
        aggregations: [{ field: 'value', type: AggregationType.SUM }],
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        limit: 100,
        offset: 0,
      });

      const result = await queryService.executeSavedQuery(saved.id);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });
  });

  describe('listSavedQueries', () => {
    it('should list all saved queries', async () => {
      await metricsService.createMetric({
        name: 'list_query_metric',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
      });

      await queryService.saveQuery({
        name: 'List Query 1',
        metrics: ['list_query_metric'],
        filters: [],
        aggregations: [{ field: 'value', type: AggregationType.SUM }],
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        limit: 100,
        offset: 0,
      });

      await queryService.saveQuery({
        name: 'List Query 2',
        metrics: ['list_query_metric'],
        filters: [],
        aggregations: [{ field: 'value', type: AggregationType.AVG }],
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        limit: 100,
        offset: 0,
      });

      const queries = await queryService.listSavedQueries();

      expect(queries.length).toBe(2);
    });
  });

  describe('clearAllQueries', () => {
    it('should clear all saved queries', async () => {
      await metricsService.createMetric({
        name: 'clear_query_metric',
        type: MetricType.COUNTER,
        category: MetricCategory.PLAYER,
        value: 0,
      });

      await queryService.saveQuery({
        name: 'Clear Query Test',
        metrics: ['clear_query_metric'],
        filters: [],
        aggregations: [{ field: 'value', type: AggregationType.SUM }],
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        limit: 100,
        offset: 0,
      });

      await queryService.clearAllQueries();

      const queries = await queryService.listSavedQueries();
      expect(queries.length).toBe(0);
    });
  });
});
