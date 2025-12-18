import { v4 as uuidv4 } from 'uuid';
import {
  Metric,
  StoredMetric,
  AggregatedMetric,
  AggregationPeriod,
  QueryOptions,
  PaginatedResponse,
  TimeSeriesData
} from '../types';
import { logger } from '../utils/logger';
import {
  getCurrentTimestamp,
  calculatePercentile,
  calculateAverage,
  calculateSum,
  getTimeRangeForPeriod
} from '../utils/helpers';

export class MetricsService {
  private metrics: Map<string, StoredMetric[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();

  public recordMetric(metric: Metric): StoredMetric {
    const storedMetric: StoredMetric = {
      ...metric,
      id: uuidv4(),
      timestamp: metric.timestamp ?? getCurrentTimestamp()
    };

    const existingMetrics = this.metrics.get(metric.name);
    if (existingMetrics !== undefined) {
      existingMetrics.push(storedMetric);
    } else {
      this.metrics.set(metric.name, [storedMetric]);
    }

    if (metric.type === 'counter') {
      const currentValue = this.counters.get(metric.name) ?? 0;
      this.counters.set(metric.name, currentValue + metric.value);
    } else if (metric.type === 'gauge') {
      this.gauges.set(metric.name, metric.value);
    }

    logger.debug('Metric recorded', { name: metric.name, type: metric.type, value: metric.value });
    
    return storedMetric;
  }

  public recordBatchMetrics(metrics: Metric[]): StoredMetric[] {
    return metrics.map(metric => this.recordMetric(metric));
  }

  public incrementCounter(name: string, value = 1, tags?: Record<string, string>): StoredMetric {
    return this.recordMetric({
      name,
      type: 'counter',
      value,
      tags
    });
  }

  public setGauge(name: string, value: number, tags?: Record<string, string>): StoredMetric {
    return this.recordMetric({
      name,
      type: 'gauge',
      value,
      tags
    });
  }

  public recordHistogram(name: string, value: number, tags?: Record<string, string>): StoredMetric {
    return this.recordMetric({
      name,
      type: 'histogram',
      value,
      tags
    });
  }

  public getCounterValue(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  public getGaugeValue(name: string): number | undefined {
    return this.gauges.get(name);
  }

  public getMetrics(name: string): StoredMetric[] {
    return this.metrics.get(name) ?? [];
  }

  public queryMetrics(options: QueryOptions = {}): PaginatedResponse<StoredMetric> {
    let allMetrics: StoredMetric[] = [];

    if (options.metricName !== undefined) {
      const metricsForName = this.metrics.get(options.metricName);
      allMetrics = metricsForName !== undefined ? [...metricsForName] : [];
    } else {
      for (const metrics of this.metrics.values()) {
        allMetrics.push(...metrics);
      }
    }

    if (options.startTime !== undefined) {
      allMetrics = allMetrics.filter(m => m.timestamp >= options.startTime!);
    }

    if (options.endTime !== undefined) {
      allMetrics = allMetrics.filter(m => m.timestamp <= options.endTime!);
    }

    allMetrics.sort((a, b) => b.timestamp - a.timestamp);

    const total = allMetrics.length;
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;
    const paginatedMetrics = allMetrics.slice(offset, offset + limit);

    return {
      data: paginatedMetrics,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }

  public getAggregatedMetrics(
    name: string,
    period: AggregationPeriod,
    startTime?: number,
    endTime?: number
  ): AggregatedMetric[] {
    const metrics = this.metrics.get(name) ?? [];
    const now = getCurrentTimestamp();
    const defaultStartTime = startTime ?? (now - 24 * 60 * 60 * 1000);
    const defaultEndTime = endTime ?? now;

    const filteredMetrics = metrics.filter(
      m => m.timestamp >= defaultStartTime && m.timestamp <= defaultEndTime
    );

    const aggregations: Map<string, StoredMetric[]> = new Map();

    for (const metric of filteredMetrics) {
      const { start } = getTimeRangeForPeriod(period, metric.timestamp);
      const key = start.toString();
      
      const existing = aggregations.get(key);
      if (existing !== undefined) {
        existing.push(metric);
      } else {
        aggregations.set(key, [metric]);
      }
    }

    const results: AggregatedMetric[] = [];

    for (const [startTimeStr, metricsInPeriod] of aggregations.entries()) {
      const periodStart = parseInt(startTimeStr, 10);
      const { end: periodEnd } = getTimeRangeForPeriod(period, periodStart);
      const values = metricsInPeriod.map(m => m.value);

      results.push({
        name,
        period,
        startTime: periodStart,
        endTime: periodEnd,
        count: values.length,
        sum: calculateSum(values),
        avg: calculateAverage(values),
        min: Math.min(...values),
        max: Math.max(...values),
        p50: calculatePercentile(values, 50),
        p95: calculatePercentile(values, 95),
        p99: calculatePercentile(values, 99)
      });
    }

    return results.sort((a, b) => a.startTime - b.startTime);
  }

  public getMetricTimeSeries(
    name: string,
    startTime?: number,
    endTime?: number
  ): TimeSeriesData[] {
    const metrics = this.metrics.get(name) ?? [];
    const now = getCurrentTimestamp();
    const defaultStartTime = startTime ?? (now - 24 * 60 * 60 * 1000);
    const defaultEndTime = endTime ?? now;

    return metrics
      .filter(m => m.timestamp >= defaultStartTime && m.timestamp <= defaultEndTime)
      .map(m => ({ timestamp: m.timestamp, value: m.value }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  public getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  public getMetricCount(): number {
    let count = 0;
    for (const metrics of this.metrics.values()) {
      count += metrics.length;
    }
    return count;
  }

  public clearMetrics(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
    logger.info('All metrics cleared');
  }

  public deleteOldMetrics(retentionPeriod: number): number {
    const cutoffTime = getCurrentTimestamp() - retentionPeriod;
    let deletedCount = 0;

    for (const [name, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(m => m.timestamp >= cutoffTime);
      deletedCount += metrics.length - filteredMetrics.length;
      
      if (filteredMetrics.length === 0) {
        this.metrics.delete(name);
      } else {
        this.metrics.set(name, filteredMetrics);
      }
    }

    if (deletedCount > 0) {
      logger.info('Deleted old metrics', { count: deletedCount });
    }

    return deletedCount;
  }
}

export const metricsService = new MetricsService();
