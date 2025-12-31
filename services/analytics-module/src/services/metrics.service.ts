/**
 * GameVerse Analytics Module - Metrics Service
 * Core service for recording, querying, and aggregating metrics
 */

import { v4 as uuidv4 } from 'uuid';
import { logger, LogEventType } from '../utils/logger';
import { MetricsError, AnalyticsErrorCode } from '../utils/errors';
import { cacheService, CacheService } from './cache.service';
import { config } from '../config';
import {
  Metric,
  MetricType,
  MetricDataPoint,
  MetricSeries,
  AggregationType,
  TimeGranularity,
  TimeRange,
  PaginatedResponse,
} from '../types';
import {
  CreateMetricDTO,
  UpdateMetricDTO,
  RecordMetricDTO,
  BatchRecordMetricsDTO,
  QueryMetricsDTO,
} from '../validation/schemas';

// In-memory storage for metrics (production would use a time-series database)
const metricsStore: Map<string, Metric> = new Map();
const metricDataPoints: Map<string, MetricDataPoint[]> = new Map();

export class MetricsService {
  /**
   * Create a new metric definition
   */
  async createMetric(dto: CreateMetricDTO): Promise<Metric> {
    const timer = logger.startTimer();

    // Check for duplicate name
    const existing = Array.from(metricsStore.values()).find(
      (m) => m.name === dto.name && m.category === dto.category
    );

    if (existing) {
      throw new MetricsError(
        AnalyticsErrorCode.METRICS_DUPLICATE_NAME,
        `Metric with name '${dto.name}' already exists in category '${dto.category}'`
      );
    }

    const now = new Date();
    const metric: Metric = {
      id: uuidv4(),
      name: dto.name,
      type: dto.type,
      category: dto.category,
      description: dto.description,
      unit: dto.unit,
      value: dto.value,
      labels: dto.labels || {},
      timestamp: now,
      createdAt: now,
      updatedAt: now,
    };

    metricsStore.set(metric.id, metric);
    metricDataPoints.set(metric.id, []);

    const duration = timer();
    logger.logMetric(metric.name, 'record', {
      metricId: metric.id,
      type: metric.type,
      category: metric.category,
      duration,
    });

    return metric;
  }

  /**
   * Get a metric by ID
   */
  async getMetricById(metricId: string): Promise<Metric> {
    const metric = metricsStore.get(metricId);

    if (!metric) {
      throw new MetricsError(
        AnalyticsErrorCode.METRICS_NOT_FOUND,
        `Metric with ID '${metricId}' not found`
      );
    }

    return metric;
  }

  /**
   * Update a metric
   */
  async updateMetric(metricId: string, dto: UpdateMetricDTO): Promise<Metric> {
    const timer = logger.startTimer();
    const metric = await this.getMetricById(metricId);

    if (dto.name !== undefined) {
      // Check for duplicate name
      const existing = Array.from(metricsStore.values()).find(
        (m) => m.name === dto.name && m.category === metric.category && m.id !== metricId
      );

      if (existing) {
        throw new MetricsError(
          AnalyticsErrorCode.METRICS_DUPLICATE_NAME,
          `Metric with name '${dto.name}' already exists in category '${metric.category}'`
        );
      }

      metric.name = dto.name;
    }

    if (dto.description !== undefined) metric.description = dto.description;
    if (dto.unit !== undefined) metric.unit = dto.unit;
    if (dto.value !== undefined) metric.value = dto.value;
    if (dto.labels !== undefined) metric.labels = { ...metric.labels, ...dto.labels };

    metric.updatedAt = new Date();
    metricsStore.set(metricId, metric);

    // Invalidate cache
    cacheService.invalidateByPattern(`metrics:.*${metricId}.*`);

    const duration = timer();
    logger.logMetric(metric.name, 'update', {
      metricId: metric.id,
      duration,
    });

    return metric;
  }

  /**
   * Delete a metric
   */
  async deleteMetric(metricId: string): Promise<void> {
    const metric = await this.getMetricById(metricId);

    metricsStore.delete(metricId);
    metricDataPoints.delete(metricId);

    // Invalidate cache
    cacheService.invalidateByPattern(`metrics:.*${metricId}.*`);

    logger.logMetric(metric.name, 'delete', { metricId });
  }

  /**
   * Record a metric value
   */
  async recordMetric(dto: RecordMetricDTO): Promise<Metric> {
    const timer = logger.startTimer();

    let metric: Metric;

    if (dto.metricId) {
      metric = await this.getMetricById(dto.metricId);
    } else {
      // Find or create metric by name
      const existing = Array.from(metricsStore.values()).find(
        (m) => m.name === dto.name && m.category === dto.category
      );

      if (existing) {
        metric = existing;
      } else {
        metric = await this.createMetric({
          name: dto.name,
          type: dto.type,
          category: dto.category,
          value: dto.value,
          labels: dto.labels,
        });
      }
    }

    // Update metric value based on type
    const timestamp = dto.timestamp || new Date();

    switch (metric.type) {
      case MetricType.COUNTER:
        metric.value += dto.value;
        break;
      case MetricType.GAUGE:
        metric.value = dto.value;
        break;
      case MetricType.HISTOGRAM:
      case MetricType.SUMMARY:
      case MetricType.TIMER:
        // Store data point for histogram/summary/timer
        const dataPoints = metricDataPoints.get(metric.id) || [];
        dataPoints.push({
          timestamp,
          value: dto.value,
          labels: dto.labels,
        });
        metricDataPoints.set(metric.id, dataPoints);
        break;
    }

    metric.timestamp = timestamp;
    metric.updatedAt = new Date();
    metricsStore.set(metric.id, metric);

    const duration = timer();
    logger.logMetric(metric.name, 'record', {
      metricId: metric.id,
      value: dto.value,
      duration,
    });

    return metric;
  }

  /**
   * Record multiple metrics in batch
   */
  async recordMetricsBatch(dto: BatchRecordMetricsDTO): Promise<{ recorded: number; failed: number; errors: string[] }> {
    const timer = logger.startTimer();
    let recorded = 0;
    let failed = 0;
    const errors: string[] = [];

    if (dto.metrics.length > config.BATCH_MAX_METRICS) {
      throw new MetricsError(
        AnalyticsErrorCode.METRICS_BATCH_TOO_LARGE,
        `Batch size ${dto.metrics.length} exceeds maximum of ${config.BATCH_MAX_METRICS}`
      );
    }

    for (const metricDto of dto.metrics) {
      try {
        await this.recordMetric(metricDto);
        recorded++;
      } catch (error) {
        failed++;
        errors.push(`${metricDto.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const duration = timer();
    logger.info(LogEventType.METRIC_BATCH_PROCESSED, `Batch processed: ${recorded} recorded, ${failed} failed`, {
      recorded,
      failed,
      duration,
    });

    return { recorded, failed, errors };
  }

  /**
   * Query metrics with filters and pagination
   */
  async queryMetrics(dto: QueryMetricsDTO): Promise<PaginatedResponse<Metric>> {
    const timer = logger.startTimer();
    const cacheKey = CacheService.metricsKey(dto);

    // Try cache first
    const cached = cacheService.get<PaginatedResponse<Metric>>(cacheKey);
    if (cached) {
      logger.logQuery('query-metrics', 'query', timer(), true, { fromCache: true });
      return cached;
    }

    let metrics = Array.from(metricsStore.values());

    // Apply filters
    if (dto.names && dto.names.length > 0) {
      metrics = metrics.filter((m) => dto.names!.includes(m.name));
    }

    if (dto.types && dto.types.length > 0) {
      metrics = metrics.filter((m) => dto.types!.includes(m.type));
    }

    if (dto.categories && dto.categories.length > 0) {
      metrics = metrics.filter((m) => dto.categories!.includes(m.category));
    }

    if (dto.labels) {
      metrics = metrics.filter((m) => {
        for (const [key, value] of Object.entries(dto.labels!)) {
          if (m.labels[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    if (dto.timeRange) {
      metrics = metrics.filter(
        (m) => m.timestamp >= dto.timeRange!.start && m.timestamp <= dto.timeRange!.end
      );
    }

    // Sort
    const sortBy = dto.sortBy || 'timestamp';
    const sortOrder = dto.sortOrder || 'desc';
    metrics.sort((a, b) => {
      const aVal = a[sortBy as keyof Metric];
      const bVal = b[sortBy as keyof Metric];
      if (aVal === undefined || bVal === undefined) return 0;
      if (aVal instanceof Date && bVal instanceof Date) {
        return sortOrder === 'asc' ? aVal.getTime() - bVal.getTime() : bVal.getTime() - aVal.getTime();
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Paginate
    const total = metrics.length;
    const page = dto.page || 1;
    const limit = dto.limit || 50;
    const offset = (page - 1) * limit;
    const paginatedMetrics = metrics.slice(offset, offset + limit);

    const result: PaginatedResponse<Metric> = {
      data: paginatedMetrics,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: offset + limit < total,
    };

    // Cache result
    cacheService.set(cacheKey, result, config.CACHE_METRICS_TTL);

    const duration = timer();
    logger.logQuery('query-metrics', 'query', duration, true, {
      total,
      returned: paginatedMetrics.length,
    });

    return result;
  }

  /**
   * Get metric time series data
   */
  async getMetricSeries(
    metricId: string,
    timeRange: TimeRange,
    granularity: TimeGranularity = TimeGranularity.HOUR
  ): Promise<MetricSeries> {
    const timer = logger.startTimer();
    const metric = await this.getMetricById(metricId);
    const dataPoints = metricDataPoints.get(metricId) || [];

    // Filter by time range
    const filteredPoints = dataPoints.filter(
      (dp) => dp.timestamp >= timeRange.start && dp.timestamp <= timeRange.end
    );

    // Aggregate by granularity
    const aggregatedPoints = this.aggregateByGranularity(filteredPoints, granularity);

    const duration = timer();
    logger.logQuery('metric-series', 'query', duration, true, {
      metricId,
      pointCount: aggregatedPoints.length,
    });

    return {
      metricId,
      name: metric.name,
      type: metric.type,
      dataPoints: aggregatedPoints,
    };
  }

  /**
   * Aggregate metric data
   */
  async aggregateMetric(
    metricId: string,
    aggregationType: AggregationType,
    timeRange: TimeRange
  ): Promise<number> {
    const timer = logger.startTimer();
    const cacheKey = CacheService.aggregationKey(metricId, { aggregationType, timeRange });

    // Try cache first
    const cached = cacheService.get<number>(cacheKey);
    if (cached !== null) {
      logger.logQuery('aggregate-metric', 'aggregate', timer(), true, { fromCache: true });
      return cached;
    }

    const dataPoints = metricDataPoints.get(metricId) || [];
    const filteredPoints = dataPoints.filter(
      (dp) => dp.timestamp >= timeRange.start && dp.timestamp <= timeRange.end
    );

    if (filteredPoints.length === 0) {
      return 0;
    }

    const values = filteredPoints.map((dp) => dp.value);
    let result: number;

    switch (aggregationType) {
      case AggregationType.SUM:
        result = values.reduce((a, b) => a + b, 0);
        break;
      case AggregationType.AVG:
        result = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case AggregationType.MIN:
        result = Math.min(...values);
        break;
      case AggregationType.MAX:
        result = Math.max(...values);
        break;
      case AggregationType.COUNT:
        result = values.length;
        break;
      case AggregationType.COUNT_DISTINCT:
        result = new Set(values).size;
        break;
      case AggregationType.MEDIAN:
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        result = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        break;
      case AggregationType.STDDEV:
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
        result = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
        break;
      case AggregationType.VARIANCE:
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const sqDiffs = values.map((v) => Math.pow(v - avg, 2));
        result = sqDiffs.reduce((a, b) => a + b, 0) / values.length;
        break;
      case AggregationType.PERCENTILE:
        // Default to 95th percentile
        const sortedVals = [...values].sort((a, b) => a - b);
        const idx = Math.ceil(0.95 * sortedVals.length) - 1;
        result = sortedVals[idx];
        break;
      default:
        result = values.reduce((a, b) => a + b, 0);
    }

    // Cache result
    cacheService.set(cacheKey, result, config.CACHE_AGGREGATION_TTL);

    const duration = timer();
    logger.logMetric(`${metricId}`, 'aggregate', {
      aggregationType,
      result,
      duration,
    });

    return result;
  }

  /**
   * Get all metrics (for admin/debugging)
   */
  async getAllMetrics(): Promise<Metric[]> {
    return Array.from(metricsStore.values());
  }

  /**
   * Clear all metrics (for testing)
   */
  async clearAllMetrics(): Promise<void> {
    metricsStore.clear();
    metricDataPoints.clear();
    cacheService.invalidateByPattern('metrics:.*');
  }

  /**
   * Aggregate data points by time granularity
   */
  private aggregateByGranularity(
    dataPoints: MetricDataPoint[],
    granularity: TimeGranularity
  ): MetricDataPoint[] {
    if (dataPoints.length === 0) {
      return [];
    }

    const buckets: Map<string, MetricDataPoint[]> = new Map();

    for (const dp of dataPoints) {
      const bucketKey = this.getBucketKey(dp.timestamp, granularity);
      const bucket = buckets.get(bucketKey) || [];
      bucket.push(dp);
      buckets.set(bucketKey, bucket);
    }

    const aggregated: MetricDataPoint[] = [];

    for (const [key, points] of buckets.entries()) {
      const avgValue = points.reduce((sum, p) => sum + p.value, 0) / points.length;
      aggregated.push({
        timestamp: new Date(key),
        value: avgValue,
      });
    }

    return aggregated.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get bucket key for time granularity
   */
  private getBucketKey(timestamp: Date, granularity: TimeGranularity): string {
    const date = new Date(timestamp);

    switch (granularity) {
      case TimeGranularity.MINUTE:
        date.setSeconds(0, 0);
        break;
      case TimeGranularity.HOUR:
        date.setMinutes(0, 0, 0);
        break;
      case TimeGranularity.DAY:
        date.setHours(0, 0, 0, 0);
        break;
      case TimeGranularity.WEEK:
        const day = date.getDay();
        date.setDate(date.getDate() - day);
        date.setHours(0, 0, 0, 0);
        break;
      case TimeGranularity.MONTH:
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        break;
      case TimeGranularity.QUARTER:
        const quarter = Math.floor(date.getMonth() / 3);
        date.setMonth(quarter * 3, 1);
        date.setHours(0, 0, 0, 0);
        break;
      case TimeGranularity.YEAR:
        date.setMonth(0, 1);
        date.setHours(0, 0, 0, 0);
        break;
    }

    return date.toISOString();
  }
}

// Singleton instance
export const metricsService = new MetricsService();

export default metricsService;
