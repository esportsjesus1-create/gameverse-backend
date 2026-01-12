import { Request, Response, NextFunction } from 'express';
import { MetricSchema, AggregationPeriodSchema } from '../types';
import { metricsService, aggregationService } from '../services';
import { createError } from '../middleware/errorHandler';
import { webSocketHandler } from '../websocket/WebSocketHandler';

export class MetricsController {
  public recordMetric(req: Request, res: Response, next: NextFunction): void {
    try {
      const validatedMetric = MetricSchema.parse(req.body);
      const storedMetric = metricsService.recordMetric(validatedMetric);
      
      webSocketHandler.broadcastMetric(storedMetric);
      
      res.status(201).json({
        success: true,
        data: storedMetric
      });
    } catch (error) {
      next(error);
    }
  }

  public recordBatchMetrics(req: Request, res: Response, next: NextFunction): void {
    try {
      const { metrics } = req.body as { metrics: unknown[] };
      
      if (!Array.isArray(metrics)) {
        throw createError('Metrics must be an array', 400, 'INVALID_INPUT');
      }

      const validatedMetrics = metrics.map(m => MetricSchema.parse(m));
      const storedMetrics = metricsService.recordBatchMetrics(validatedMetrics);
      
      for (const metric of storedMetrics) {
        webSocketHandler.broadcastMetric(metric);
      }
      
      res.status(201).json({
        success: true,
        data: storedMetrics,
        count: storedMetrics.length
      });
    } catch (error) {
      next(error);
    }
  }

  public queryMetrics(req: Request, res: Response, next: NextFunction): void {
    try {
      const {
        metricName,
        startTime,
        endTime,
        limit,
        offset
      } = req.query;

      const result = metricsService.queryMetrics({
        metricName: metricName as string | undefined,
        startTime: startTime !== undefined ? parseInt(startTime as string, 10) : undefined,
        endTime: endTime !== undefined ? parseInt(endTime as string, 10) : undefined,
        limit: limit !== undefined ? parseInt(limit as string, 10) : undefined,
        offset: offset !== undefined ? parseInt(offset as string, 10) : undefined
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  public getAggregatedMetrics(req: Request, res: Response, next: NextFunction): void {
    try {
      const { name } = req.params;
      const { period, startTime, endTime } = req.query;

      if (name === undefined) {
        throw createError('Metric name is required', 400, 'MISSING_NAME');
      }

      const validatedPeriod = AggregationPeriodSchema.parse(period ?? 'hour');

      const result = aggregationService.aggregateMetrics(
        name,
        validatedPeriod,
        startTime !== undefined ? parseInt(startTime as string, 10) : undefined,
        endTime !== undefined ? parseInt(endTime as string, 10) : undefined
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  public getMetricTimeSeries(req: Request, res: Response, next: NextFunction): void {
    try {
      const { name } = req.params;
      const { period, startTime, endTime } = req.query;

      if (name === undefined) {
        throw createError('Metric name is required', 400, 'MISSING_NAME');
      }

      const validatedPeriod = AggregationPeriodSchema.parse(period ?? 'hour');

      const result = aggregationService.getTimeSeriesData(
        name,
        validatedPeriod,
        startTime !== undefined ? parseInt(startTime as string, 10) : undefined,
        endTime !== undefined ? parseInt(endTime as string, 10) : undefined
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  public getMetricNames(req: Request, res: Response, next: NextFunction): void {
    try {
      const names = metricsService.getMetricNames();

      res.json({
        success: true,
        data: names
      });
    } catch (error) {
      next(error);
    }
  }

  public getTopMetrics(req: Request, res: Response, next: NextFunction): void {
    try {
      const { period, startTime, endTime, limit } = req.query;

      const validatedPeriod = AggregationPeriodSchema.parse(period ?? 'hour');

      const result = aggregationService.getTopMetrics(
        validatedPeriod,
        startTime !== undefined ? parseInt(startTime as string, 10) : undefined,
        endTime !== undefined ? parseInt(endTime as string, 10) : undefined,
        limit !== undefined ? parseInt(limit as string, 10) : 10
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

export const metricsController = new MetricsController();
