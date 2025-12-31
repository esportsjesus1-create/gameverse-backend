/**
 * GameVerse Analytics Module - Query Service
 * Core service for executing analytics queries with aggregations
 */

import { v4 as uuidv4 } from 'uuid';
import { logger, LogEventType } from '../utils/logger';
import { QueryError, AnalyticsErrorCode } from '../utils/errors';
import { cacheService, CacheService } from './cache.service';
import { metricsService } from './metrics.service';
import { config } from '../config';
import {
  AnalyticsQuery,
  QueryResult,
  QueryFilter,
  QueryAggregation,
  FilterOperator,
  AggregationType,
} from '../types';
import { AnalyticsQueryDTO } from '../validation/schemas';

// In-memory storage for saved queries
const savedQueries: Map<string, AnalyticsQuery> = new Map();

export class QueryService {
  /**
   * Execute an analytics query
   */
  async executeQuery(dto: AnalyticsQueryDTO): Promise<QueryResult> {
    const timer = logger.startTimer();
    const queryId = uuidv4();

    // Validate time range
    const timeRangeDays = Math.ceil(
      (dto.timeRange.end.getTime() - dto.timeRange.start.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (timeRangeDays > config.QUERY_MAX_TIME_RANGE_DAYS) {
      throw new QueryError(
        AnalyticsErrorCode.QUERY_INVALID_TIME_RANGE,
        `Time range of ${timeRangeDays} days exceeds maximum of ${config.QUERY_MAX_TIME_RANGE_DAYS} days`
      );
    }

    // Check cache
    const cacheKey = CacheService.queryKey(queryId, dto);
    const cached = cacheService.get<QueryResult>(cacheKey);
    if (cached) {
      logger.logQuery(queryId, 'execute', timer(), true, { fromCache: true });
      return cached;
    }

    try {
      // Set timeout for query execution
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new QueryError(
            AnalyticsErrorCode.QUERY_TIMEOUT,
            `Query execution timed out after ${config.QUERY_TIMEOUT_MS}ms`
          ));
        }, config.QUERY_TIMEOUT_MS);
      });

      const queryPromise = this.processQuery(queryId, dto);
      const result = await Promise.race([queryPromise, timeoutPromise]);

      // Cache result
      cacheService.set(cacheKey, result, config.CACHE_QUERY_TTL);

      const duration = timer();
      logger.logQuery(queryId, 'execute', duration, true, {
        rowCount: result.data.length,
        executionTimeMs: result.metadata.executionTimeMs,
      });

      return result;
    } catch (error) {
      const duration = timer();
      logger.logQuery(queryId, 'execute', duration, false, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Process the query and return results
   */
  private async processQuery(queryId: string, dto: AnalyticsQueryDTO): Promise<QueryResult> {
    const startTime = Date.now();

    // Get metrics data
    const metricsResult = await metricsService.queryMetrics({
      names: dto.metrics,
      timeRange: dto.timeRange,
      page: 1,
      limit: config.QUERY_MAX_RESULTS,
      sortOrder: 'desc',
    });

    let data: Record<string, unknown>[] = metricsResult.data.map((metric) => ({
      metricId: metric.id,
      name: metric.name,
      type: metric.type,
      category: metric.category,
      value: metric.value,
      labels: metric.labels,
      timestamp: metric.timestamp,
    }));

    // Apply filters - convert optional value to required
    if (dto.filters && dto.filters.length > 0) {
      const filters: QueryFilter[] = dto.filters.map(f => ({
        field: f.field,
        operator: f.operator,
        value: f.value ?? null,
      }));
      data = this.applyFilters(data, filters);
    }

    // Apply grouping
    if (dto.groupBy && dto.groupBy.length > 0) {
      data = this.applyGrouping(data, dto.groupBy, dto.aggregations);
    } else {
      // Apply aggregations without grouping
      data = this.applyAggregations(data, dto.aggregations);
    }

    // Apply ordering
    if (dto.orderBy && dto.orderBy.length > 0) {
      data = this.applyOrdering(data, dto.orderBy);
    }

    // Apply limit and offset
    const truncated = data.length > dto.limit;
    data = data.slice(dto.offset, dto.offset + dto.limit);

    const executionTimeMs = Date.now() - startTime;

    const result: QueryResult = {
      queryId,
      data,
      metadata: {
        totalRows: data.length,
        executionTimeMs,
        fromCache: false,
        truncated,
      },
      executedAt: new Date(),
    };

    return result;
  }

  /**
   * Apply filters to data
   */
  private applyFilters(
    data: Record<string, unknown>[],
    filters: QueryFilter[]
  ): Record<string, unknown>[] {
    return data.filter((row) => {
      for (const filter of filters) {
        const value = row[filter.field];
        if (!this.evaluateFilter(value, filter.operator, filter.value)) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Evaluate a single filter condition
   */
  private evaluateFilter(
    value: unknown,
    operator: FilterOperator,
    filterValue: unknown
  ): boolean {
    switch (operator) {
      case FilterOperator.EQ:
        return value === filterValue;
      case FilterOperator.NE:
        return value !== filterValue;
      case FilterOperator.GT:
        return (value as number) > (filterValue as number);
      case FilterOperator.GTE:
        return (value as number) >= (filterValue as number);
      case FilterOperator.LT:
        return (value as number) < (filterValue as number);
      case FilterOperator.LTE:
        return (value as number) <= (filterValue as number);
      case FilterOperator.IN:
        return (filterValue as unknown[]).includes(value);
      case FilterOperator.NOT_IN:
        return !(filterValue as unknown[]).includes(value);
      case FilterOperator.CONTAINS:
        return String(value).includes(String(filterValue));
      case FilterOperator.STARTS_WITH:
        return String(value).startsWith(String(filterValue));
      case FilterOperator.ENDS_WITH:
        return String(value).endsWith(String(filterValue));
      case FilterOperator.BETWEEN:
        const [min, max] = filterValue as [number, number];
        return (value as number) >= min && (value as number) <= max;
      case FilterOperator.IS_NULL:
        return value === null || value === undefined;
      case FilterOperator.IS_NOT_NULL:
        return value !== null && value !== undefined;
      default:
        return true;
    }
  }

  /**
   * Apply grouping and aggregations
   */
  private applyGrouping(
    data: Record<string, unknown>[],
    groupBy: string[],
    aggregations: QueryAggregation[]
  ): Record<string, unknown>[] {
    const groups: Map<string, Record<string, unknown>[]> = new Map();

    // Group data
    for (const row of data) {
      const groupKey = groupBy.map((field) => String(row[field])).join('|');
      const group = groups.get(groupKey) || [];
      group.push(row);
      groups.set(groupKey, group);
    }

    // Aggregate each group
    const results: Record<string, unknown>[] = [];

    for (const [groupKey, groupData] of groups.entries()) {
      const result: Record<string, unknown> = {};

      // Add group by fields
      const groupValues = groupKey.split('|');
      groupBy.forEach((field, index) => {
        result[field] = groupValues[index];
      });

      // Apply aggregations
      for (const agg of aggregations) {
        const values = groupData.map((row) => row[agg.field] as number).filter((v) => v !== undefined);
        const aggValue = this.computeAggregation(values, agg.type, agg.percentile);
        result[agg.alias || `${agg.type.toLowerCase()}_${agg.field}`] = aggValue;
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Apply aggregations without grouping
   */
  private applyAggregations(
    data: Record<string, unknown>[],
    aggregations: QueryAggregation[]
  ): Record<string, unknown>[] {
    if (data.length === 0) {
      return [];
    }

    const result: Record<string, unknown> = {};

    for (const agg of aggregations) {
      const values = data.map((row) => row[agg.field] as number).filter((v) => v !== undefined);
      const aggValue = this.computeAggregation(values, agg.type, agg.percentile);
      result[agg.alias || `${agg.type.toLowerCase()}_${agg.field}`] = aggValue;
    }

    return [result];
  }

  /**
   * Compute aggregation value
   */
  private computeAggregation(
    values: number[],
    type: AggregationType,
    percentile?: number
  ): number {
    if (values.length === 0) {
      return 0;
    }

    switch (type) {
      case AggregationType.SUM:
        return values.reduce((a, b) => a + b, 0);
      case AggregationType.AVG:
        return values.reduce((a, b) => a + b, 0) / values.length;
      case AggregationType.MIN:
        return Math.min(...values);
      case AggregationType.MAX:
        return Math.max(...values);
      case AggregationType.COUNT:
        return values.length;
      case AggregationType.COUNT_DISTINCT:
        return new Set(values).size;
      case AggregationType.MEDIAN:
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      case AggregationType.PERCENTILE:
        const p = percentile || 95;
        const sortedVals = [...values].sort((a, b) => a - b);
        const idx = Math.ceil((p / 100) * sortedVals.length) - 1;
        return sortedVals[Math.max(0, idx)];
      case AggregationType.STDDEV:
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
        return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
      case AggregationType.VARIANCE:
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const sqDiffs = values.map((v) => Math.pow(v - avg, 2));
        return sqDiffs.reduce((a, b) => a + b, 0) / values.length;
      default:
        return values.reduce((a, b) => a + b, 0);
    }
  }

  /**
   * Apply ordering to results
   */
  private applyOrdering(
    data: Record<string, unknown>[],
    orderBy: Array<{ field: string; direction: 'ASC' | 'DESC' }>
  ): Record<string, unknown>[] {
    return [...data].sort((a, b) => {
      for (const order of orderBy) {
        const aVal = a[order.field];
        const bVal = b[order.field];

        // Handle null/undefined values
        if (aVal == null && bVal == null) continue;
        if (aVal == null) return order.direction === 'ASC' ? 1 : -1;
        if (bVal == null) return order.direction === 'ASC' ? -1 : 1;

        // Compare values - cast to comparable types
        const aNum = typeof aVal === 'number' ? aVal : String(aVal);
        const bNum = typeof bVal === 'number' ? bVal : String(bVal);
        if (aNum < bNum) return order.direction === 'ASC' ? -1 : 1;
        if (aNum > bNum) return order.direction === 'ASC' ? 1 : -1;
      }
      return 0;
    });
  }

  /**
   * Save a query for later use
   */
  async saveQuery(dto: AnalyticsQueryDTO): Promise<AnalyticsQuery> {
    // Convert optional filter values to required
    const filters: QueryFilter[] = dto.filters?.map(f => ({
      field: f.field,
      operator: f.operator,
      value: f.value ?? null,
    })) || [];

    const query: AnalyticsQuery = {
      id: uuidv4(),
      name: dto.name,
      metrics: dto.metrics,
      filters,
      groupBy: dto.groupBy,
      aggregations: dto.aggregations,
      timeRange: dto.timeRange,
      granularity: dto.granularity,
      limit: dto.limit,
      offset: dto.offset,
      orderBy: dto.orderBy,
    };

    savedQueries.set(query.id, query);

    logger.info(LogEventType.QUERY_COMPLETED, `Query saved: ${query.id}`, {
      queryId: query.id,
      name: query.name,
    });

    return query;
  }

  /**
   * Get a saved query by ID
   */
  async getSavedQuery(queryId: string): Promise<AnalyticsQuery> {
    const query = savedQueries.get(queryId);

    if (!query) {
      throw new QueryError(
        AnalyticsErrorCode.QUERY_INVALID_PARAMETERS,
        `Query with ID '${queryId}' not found`
      );
    }

    return query;
  }

  /**
   * List all saved queries
   */
  async listSavedQueries(): Promise<AnalyticsQuery[]> {
    return Array.from(savedQueries.values());
  }

  /**
   * Delete a saved query
   */
  async deleteSavedQuery(queryId: string): Promise<void> {
    if (!savedQueries.has(queryId)) {
      throw new QueryError(
        AnalyticsErrorCode.QUERY_INVALID_PARAMETERS,
        `Query with ID '${queryId}' not found`
      );
    }

    savedQueries.delete(queryId);

    logger.info(LogEventType.QUERY_COMPLETED, `Query deleted: ${queryId}`, {
      queryId,
    });
  }

  /**
   * Execute a saved query
   */
  async executeSavedQuery(queryId: string): Promise<QueryResult> {
    const query = await this.getSavedQuery(queryId);

    return this.executeQuery({
      name: query.name,
      metrics: query.metrics,
      filters: query.filters,
      groupBy: query.groupBy,
      aggregations: query.aggregations,
      timeRange: query.timeRange,
      granularity: query.granularity,
      limit: query.limit || 1000,
      offset: query.offset || 0,
      orderBy: query.orderBy,
    });
  }

  /**
   * Clear all saved queries (for testing)
   */
  async clearAllQueries(): Promise<void> {
    savedQueries.clear();
    cacheService.invalidateByPattern('query:.*');
  }
}

// Singleton instance
export const queryService = new QueryService();

export default queryService;
