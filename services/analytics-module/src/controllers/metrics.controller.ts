/**
 * GameVerse Analytics Module - Metrics Controller
 * HTTP handlers for metrics endpoints
 */

import { Response } from 'express';
import { metricsService } from '../services';
import { logger, LogEventType } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/rbac';
import { AggregationType, TimeGranularity } from '../types';

export class MetricsController {
  /**
   * Create a new metric
   * POST /api/v1/metrics
   */
  async createMetric(req: AuthenticatedRequest, res: Response): Promise<void> {
    const metric = await metricsService.createMetric(req.body);

    logger.logAudit({
      eventType: LogEventType.AUDIT_CREATE,
      userId: req.user?.id || 'anonymous',
      action: 'CREATE',
      resourceType: 'metric',
      resourceId: metric.id,
      newState: metric as unknown as Record<string, unknown>,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      data: metric,
    });
  }

  /**
   * Get a metric by ID
   * GET /api/v1/metrics/:metricId
   */
  async getMetricById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { metricId } = req.params;
    const metric = await metricsService.getMetricById(metricId);

    res.json({
      success: true,
      data: metric,
    });
  }

  /**
   * Update a metric
   * PATCH /api/v1/metrics/:metricId
   */
  async updateMetric(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { metricId } = req.params;
    const previousMetric = await metricsService.getMetricById(metricId);
    const metric = await metricsService.updateMetric(metricId, req.body);

    logger.logAudit({
      eventType: LogEventType.AUDIT_UPDATE,
      userId: req.user?.id || 'anonymous',
      action: 'UPDATE',
      resourceType: 'metric',
      resourceId: metric.id,
      previousState: previousMetric as unknown as Record<string, unknown>,
      newState: metric as unknown as Record<string, unknown>,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: metric,
    });
  }

  /**
   * Delete a metric
   * DELETE /api/v1/metrics/:metricId
   */
  async deleteMetric(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { metricId } = req.params;
    const metric = await metricsService.getMetricById(metricId);
    await metricsService.deleteMetric(metricId);

    logger.logAudit({
      eventType: LogEventType.AUDIT_DELETE,
      userId: req.user?.id || 'anonymous',
      action: 'DELETE',
      resourceType: 'metric',
      resourceId: metricId,
      previousState: metric as unknown as Record<string, unknown>,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(204).send();
  }

  /**
   * Record a metric value
   * POST /api/v1/metrics/record
   */
  async recordMetric(req: AuthenticatedRequest, res: Response): Promise<void> {
    const metric = await metricsService.recordMetric(req.body);

    res.status(201).json({
      success: true,
      data: metric,
    });
  }

  /**
   * Record multiple metrics in batch
   * POST /api/v1/metrics/batch
   */
  async recordMetricsBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await metricsService.recordMetricsBatch(req.body);

    res.status(201).json({
      success: true,
      data: result,
    });
  }

  /**
   * Query metrics
   * GET /api/v1/metrics
   */
  async queryMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    const query = (req as AuthenticatedRequest & { validatedQuery: unknown }).validatedQuery || req.query;
    const result = await metricsService.queryMetrics(query as Parameters<typeof metricsService.queryMetrics>[0]);

    res.json({
      success: true,
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasMore: result.hasMore,
      },
    });
  }

  /**
   * Get metric time series
   * GET /api/v1/metrics/:metricId/series
   */
  async getMetricSeries(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { metricId } = req.params;
    const { start, end, granularity } = req.query;

    const timeRange = {
      start: new Date(start as string),
      end: new Date(end as string),
    };

    const series = await metricsService.getMetricSeries(
      metricId,
      timeRange,
      (granularity as TimeGranularity) || TimeGranularity.HOUR
    );

    res.json({
      success: true,
      data: series,
    });
  }

  /**
   * Aggregate metric data
   * GET /api/v1/metrics/:metricId/aggregate
   */
  async aggregateMetric(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { metricId } = req.params;
    const { type, start, end } = req.query;

    const timeRange = {
      start: new Date(start as string),
      end: new Date(end as string),
    };

    const result = await metricsService.aggregateMetric(
      metricId,
      (type as AggregationType) || AggregationType.AVG,
      timeRange
    );

    res.json({
      success: true,
      data: {
        metricId,
        aggregationType: type || AggregationType.AVG,
        value: result,
        timeRange,
      },
    });
  }
}

export const metricsController = new MetricsController();

export default metricsController;
