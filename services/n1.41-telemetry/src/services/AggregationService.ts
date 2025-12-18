import {
  AggregatedMetric,
  AggregationPeriod,
  TimeSeriesData,
  StoredEvent
} from '../types';
import { logger } from '../utils/logger';
import {
  getCurrentTimestamp,
  calculateAverage,
  calculateSum,
  getTimeRangeForPeriod
} from '../utils/helpers';
import { eventService } from './EventService';
import { metricsService } from './MetricsService';

export interface AggregatedEvents {
  period: AggregationPeriod;
  startTime: number;
  endTime: number;
  totalEvents: number;
  eventsByType: Record<string, number>;
  uniqueUsers: number;
  uniqueSessions: number;
}

export interface DataRetentionPolicy {
  period: AggregationPeriod;
  retentionDays: number;
}

export class AggregationService {
  private aggregatedMetricsCache: Map<string, AggregatedMetric[]> = new Map();
  private aggregatedEventsCache: Map<string, AggregatedEvents[]> = new Map();
  private retentionPolicies: DataRetentionPolicy[] = [
    { period: 'minute', retentionDays: 1 },
    { period: 'hour', retentionDays: 7 },
    { period: 'day', retentionDays: 30 },
    { period: 'week', retentionDays: 90 },
    { period: 'month', retentionDays: 365 }
  ];

  public aggregateMetrics(
    metricName: string,
    period: AggregationPeriod,
    startTime?: number,
    endTime?: number
  ): AggregatedMetric[] {
    const cacheKey = `${metricName}:${period}:${startTime ?? 'default'}:${endTime ?? 'default'}`;
    const cached = this.aggregatedMetricsCache.get(cacheKey);
    
    if (cached !== undefined) {
      return cached;
    }

    const result = metricsService.getAggregatedMetrics(metricName, period, startTime, endTime);
    this.aggregatedMetricsCache.set(cacheKey, result);
    
    return result;
  }

  public aggregateEvents(
    period: AggregationPeriod,
    startTime?: number,
    endTime?: number
  ): AggregatedEvents[] {
    const now = getCurrentTimestamp();
    const defaultStartTime = startTime ?? (now - 24 * 60 * 60 * 1000);
    const defaultEndTime = endTime ?? now;

    const cacheKey = `events:${period}:${defaultStartTime}:${defaultEndTime}`;
    const cached = this.aggregatedEventsCache.get(cacheKey);
    
    if (cached !== undefined) {
      return cached;
    }

    const events = eventService.queryEvents({
      startTime: defaultStartTime,
      endTime: defaultEndTime,
      limit: 10000
    }).data;

    const groupedByPeriod = new Map<number, StoredEvent[]>();

    for (const event of events) {
      const { start } = getTimeRangeForPeriod(period, event.timestamp);
      const existing = groupedByPeriod.get(start);
      if (existing !== undefined) {
        existing.push(event);
      } else {
        groupedByPeriod.set(start, [event]);
      }
    }

    const results: AggregatedEvents[] = [];

    for (const [periodStart, periodEvents] of groupedByPeriod.entries()) {
      const { end: periodEnd } = getTimeRangeForPeriod(period, periodStart);
      
      const eventsByType: Record<string, number> = {};
      const uniqueUserIds = new Set<string>();
      const uniqueSessionIds = new Set<string>();

      for (const event of periodEvents) {
        const typeCount = eventsByType[event.type] ?? 0;
        eventsByType[event.type] = typeCount + 1;

        if (event.userId !== undefined) {
          uniqueUserIds.add(event.userId);
        }
        if (event.sessionId !== undefined) {
          uniqueSessionIds.add(event.sessionId);
        }
      }

      results.push({
        period,
        startTime: periodStart,
        endTime: periodEnd,
        totalEvents: periodEvents.length,
        eventsByType,
        uniqueUsers: uniqueUserIds.size,
        uniqueSessions: uniqueSessionIds.size
      });
    }

    const sortedResults = results.sort((a, b) => a.startTime - b.startTime);
    this.aggregatedEventsCache.set(cacheKey, sortedResults);

    return sortedResults;
  }

  public getTimeSeriesData(
    metricName: string,
    period: AggregationPeriod,
    startTime?: number,
    endTime?: number
  ): TimeSeriesData[] {
    const aggregated = this.aggregateMetrics(metricName, period, startTime, endTime);
    
    return aggregated.map(agg => ({
      timestamp: agg.startTime,
      value: agg.avg
    }));
  }

  public getEventTimeSeries(
    period: AggregationPeriod,
    startTime?: number,
    endTime?: number
  ): TimeSeriesData[] {
    const aggregated = this.aggregateEvents(period, startTime, endTime);
    
    return aggregated.map(agg => ({
      timestamp: agg.startTime,
      value: agg.totalEvents
    }));
  }

  public compareMetrics(
    metricName: string,
    period: AggregationPeriod,
    currentStart: number,
    currentEnd: number,
    previousStart: number,
    previousEnd: number
  ): {
    current: AggregatedMetric[];
    previous: AggregatedMetric[];
    changePercent: number;
  } {
    const current = this.aggregateMetrics(metricName, period, currentStart, currentEnd);
    const previous = this.aggregateMetrics(metricName, period, previousStart, previousEnd);

    const currentSum = calculateSum(current.map(m => m.sum));
    const previousSum = calculateSum(previous.map(m => m.sum));

    const changePercent = previousSum !== 0 
      ? ((currentSum - previousSum) / previousSum) * 100 
      : currentSum > 0 ? 100 : 0;

    return {
      current,
      previous,
      changePercent
    };
  }

  public getTopMetrics(
    period: AggregationPeriod,
    startTime?: number,
    endTime?: number,
    limit = 10
  ): Array<{ name: string; total: number; average: number }> {
    const metricNames = metricsService.getMetricNames();
    const results: Array<{ name: string; total: number; average: number }> = [];

    for (const name of metricNames) {
      const aggregated = this.aggregateMetrics(name, period, startTime, endTime);
      const total = calculateSum(aggregated.map(a => a.sum));
      const average = calculateAverage(aggregated.map(a => a.avg));
      
      results.push({ name, total, average });
    }

    return results
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }

  public getTopEvents(
    startTime?: number,
    endTime?: number,
    limit = 10
  ): Array<{ name: string; count: number }> {
    const queryOptions: Parameters<typeof eventService.queryEvents>[0] = {
      limit: 10000
    };
    if (startTime !== undefined) queryOptions.startTime = startTime;
    if (endTime !== undefined) queryOptions.endTime = endTime;
    const events = eventService.queryEvents(queryOptions).data;

    const eventCounts = new Map<string, number>();

    for (const event of events) {
      const current = eventCounts.get(event.name) ?? 0;
      eventCounts.set(event.name, current + 1);
    }

    return Array.from(eventCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  public setRetentionPolicy(period: AggregationPeriod, retentionDays: number): void {
    const existingIndex = this.retentionPolicies.findIndex(p => p.period === period);
    
    if (existingIndex >= 0) {
      this.retentionPolicies[existingIndex] = { period, retentionDays };
    } else {
      this.retentionPolicies.push({ period, retentionDays });
    }

    logger.info('Retention policy updated', { period, retentionDays });
  }

  public getRetentionPolicies(): DataRetentionPolicy[] {
    return [...this.retentionPolicies];
  }

  public applyRetentionPolicies(): { deletedMetrics: number; deletedEvents: number } {
    let deletedMetrics = 0;
    const deletedEvents = 0;

    for (const policy of this.retentionPolicies) {
      const retentionMs = policy.retentionDays * 24 * 60 * 60 * 1000;
      deletedMetrics += metricsService.deleteOldMetrics(retentionMs);
    }

    logger.info('Retention policies applied', { deletedMetrics, deletedEvents });

    return { deletedMetrics, deletedEvents };
  }

  public clearCache(): void {
    this.aggregatedMetricsCache.clear();
    this.aggregatedEventsCache.clear();
    logger.info('Aggregation cache cleared');
  }

  public getCacheStats(): { metricsEntries: number; eventsEntries: number } {
    return {
      metricsEntries: this.aggregatedMetricsCache.size,
      eventsEntries: this.aggregatedEventsCache.size
    };
  }
}

export const aggregationService = new AggregationService();
