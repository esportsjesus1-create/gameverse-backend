/**
 * GameVerse Analytics Module - Metrics Routes
 * API routes for metrics endpoints
 */

import { Router } from 'express';
import { metricsController } from '../controllers';
import { asyncHandler, validate, requirePermission } from '../middleware';
import { Permission } from '../types';
import {
  createMetricSchema,
  updateMetricSchema,
  recordMetricSchema,
  batchRecordMetricsSchema,
  queryMetricsSchema,
  metricIdParamSchema,
} from '../validation/schemas';

const router = Router();

/**
 * @route POST /api/v1/metrics
 * @desc Create a new metric
 * @access Private - METRICS_WRITE
 */
router.post(
  '/',
  requirePermission(Permission.METRICS_WRITE),
  validate(createMetricSchema, 'body'),
  asyncHandler(metricsController.createMetric.bind(metricsController))
);

/**
 * @route GET /api/v1/metrics
 * @desc Query metrics with filters and pagination
 * @access Private - METRICS_READ
 */
router.get(
  '/',
  requirePermission(Permission.METRICS_READ),
  validate(queryMetricsSchema, 'query'),
  asyncHandler(metricsController.queryMetrics.bind(metricsController))
);

/**
 * @route POST /api/v1/metrics/record
 * @desc Record a metric value
 * @access Private - METRICS_WRITE
 */
router.post(
  '/record',
  requirePermission(Permission.METRICS_WRITE),
  validate(recordMetricSchema, 'body'),
  asyncHandler(metricsController.recordMetric.bind(metricsController))
);

/**
 * @route POST /api/v1/metrics/batch
 * @desc Record multiple metrics in batch
 * @access Private - METRICS_WRITE
 */
router.post(
  '/batch',
  requirePermission(Permission.METRICS_WRITE),
  validate(batchRecordMetricsSchema, 'body'),
  asyncHandler(metricsController.recordMetricsBatch.bind(metricsController))
);

/**
 * @route GET /api/v1/metrics/:metricId
 * @desc Get a metric by ID
 * @access Private - METRICS_READ
 */
router.get(
  '/:metricId',
  requirePermission(Permission.METRICS_READ),
  validate(metricIdParamSchema, 'params'),
  asyncHandler(metricsController.getMetricById.bind(metricsController))
);

/**
 * @route PATCH /api/v1/metrics/:metricId
 * @desc Update a metric
 * @access Private - METRICS_WRITE
 */
router.patch(
  '/:metricId',
  requirePermission(Permission.METRICS_WRITE),
  validate(metricIdParamSchema, 'params'),
  validate(updateMetricSchema, 'body'),
  asyncHandler(metricsController.updateMetric.bind(metricsController))
);

/**
 * @route DELETE /api/v1/metrics/:metricId
 * @desc Delete a metric
 * @access Private - METRICS_DELETE
 */
router.delete(
  '/:metricId',
  requirePermission(Permission.METRICS_DELETE),
  validate(metricIdParamSchema, 'params'),
  asyncHandler(metricsController.deleteMetric.bind(metricsController))
);

/**
 * @route GET /api/v1/metrics/:metricId/series
 * @desc Get metric time series data
 * @access Private - METRICS_READ
 */
router.get(
  '/:metricId/series',
  requirePermission(Permission.METRICS_READ),
  validate(metricIdParamSchema, 'params'),
  asyncHandler(metricsController.getMetricSeries.bind(metricsController))
);

/**
 * @route GET /api/v1/metrics/:metricId/aggregate
 * @desc Aggregate metric data
 * @access Private - METRICS_READ
 */
router.get(
  '/:metricId/aggregate',
  requirePermission(Permission.METRICS_READ),
  validate(metricIdParamSchema, 'params'),
  asyncHandler(metricsController.aggregateMetric.bind(metricsController))
);

export default router;
