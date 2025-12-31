/**
 * GameVerse Analytics Module - Zod Validation Schemas
 * Comprehensive validation for all DTOs
 */

import { z } from 'zod';
import {
  MetricType,
  MetricCategory,
  AnalyticsEventType,
  AggregationType,
  TimeGranularity,
  FilterOperator,
  ReportType,
  ReportFormat,
  ScheduleFrequency,
  WidgetType,
  VisualizationType,
  AlertCondition,
  AlertSeverity,
  AlertChannelType,
  UserRole,
  UserTier,
  Permission,
} from '../types';

// Common Schemas
export const uuidSchema = z.string().uuid('Invalid UUID format');
export const timestampSchema = z.coerce.date();
export const positiveIntSchema = z.number().int().positive();
export const nonNegativeIntSchema = z.number().int().nonnegative();
export const percentageSchema = z.number().min(0).max(100);

// Labels Schema (key-value pairs for metric labels)
const labelsSchema = z.record(z.string().max(100), z.string().max(500)).optional();

// Pagination Schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  sortBy: z.string().max(100).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Time Range Schema
export const timeRangeSchema = z.object({
  start: timestampSchema,
  end: timestampSchema,
}).refine(
  (data) => data.start < data.end,
  { message: 'Start time must be before end time' }
);

// ============================================
// METRICS SCHEMAS
// ============================================

export const createMetricSchema = z.object({
  name: z.string()
    .min(1, 'Metric name is required')
    .max(200, 'Metric name must be at most 200 characters')
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Metric name must start with a letter and contain only alphanumeric characters and underscores'),
  type: z.nativeEnum(MetricType),
  category: z.nativeEnum(MetricCategory),
  description: z.string().max(1000).optional(),
  unit: z.string().max(50).optional(),
  value: z.number(),
  labels: labelsSchema,
});

export const updateMetricSchema = z.object({
  name: z.string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .optional(),
  description: z.string().max(1000).optional(),
  unit: z.string().max(50).optional(),
  value: z.number().optional(),
  labels: labelsSchema,
});

export const recordMetricSchema = z.object({
  metricId: uuidSchema.optional(),
  name: z.string().min(1).max(200),
  type: z.nativeEnum(MetricType),
  category: z.nativeEnum(MetricCategory),
  value: z.number(),
  labels: labelsSchema,
  timestamp: timestampSchema.optional(),
});

export const batchRecordMetricsSchema = z.object({
  metrics: z.array(recordMetricSchema).min(1).max(1000),
});

export const queryMetricsSchema = z.object({
  names: z.array(z.string().max(200)).min(1).max(100).optional(),
  types: z.array(z.nativeEnum(MetricType)).optional(),
  categories: z.array(z.nativeEnum(MetricCategory)).optional(),
  labels: labelsSchema,
  timeRange: timeRangeSchema.optional(),
  granularity: z.nativeEnum(TimeGranularity).optional(),
  aggregation: z.nativeEnum(AggregationType).optional(),
  ...paginationSchema.shape,
});

export const metricIdParamSchema = z.object({
  metricId: uuidSchema,
});

// ============================================
// EVENT SCHEMAS
// ============================================

export const eventMetadataSchema = z.object({
  source: z.string().min(1).max(100),
  version: z.string().max(20).default('1.0'),
  platform: z.string().max(50).optional(),
  deviceId: z.string().max(100).optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().max(500).optional(),
  gameId: z.string().max(100).optional(),
  serverId: z.string().max(100).optional(),
});

export const trackEventSchema = z.object({
  type: z.nativeEnum(AnalyticsEventType),
  playerId: z.string().max(100).optional(),
  sessionId: z.string().max(100).optional(),
  correlationId: uuidSchema.optional(),
  payload: z.record(z.unknown()).default({}),
  metadata: eventMetadataSchema,
  timestamp: timestampSchema.optional(),
});

export const batchTrackEventsSchema = z.object({
  events: z.array(trackEventSchema).min(1).max(500),
});

export const queryEventsSchema = z.object({
  types: z.array(z.nativeEnum(AnalyticsEventType)).optional(),
  playerId: z.string().max(100).optional(),
  sessionId: z.string().max(100).optional(),
  correlationId: uuidSchema.optional(),
  timeRange: timeRangeSchema.optional(),
  ...paginationSchema.shape,
});

export const eventIdParamSchema = z.object({
  eventId: uuidSchema,
});

// ============================================
// QUERY SCHEMAS
// ============================================

export const queryFilterSchema = z.object({
  field: z.string().min(1).max(100),
  operator: z.nativeEnum(FilterOperator),
  value: z.unknown(),
});

export const queryAggregationSchema = z.object({
  field: z.string().min(1).max(100),
  type: z.nativeEnum(AggregationType),
  alias: z.string().max(100).optional(),
  percentile: z.number().min(0).max(100).optional(),
});

export const queryOrderBySchema = z.object({
  field: z.string().min(1).max(100),
  direction: z.enum(['ASC', 'DESC']),
});

export const analyticsQuerySchema = z.object({
  name: z.string().max(200).optional(),
  metrics: z.array(z.string().max(200)).min(1).max(50),
  filters: z.array(queryFilterSchema).max(20).default([]),
  groupBy: z.array(z.string().max(100)).max(10).optional(),
  aggregations: z.array(queryAggregationSchema).min(1).max(20),
  timeRange: timeRangeSchema,
  granularity: z.nativeEnum(TimeGranularity).optional(),
  limit: z.number().int().min(1).max(10000).default(1000),
  offset: z.number().int().nonnegative().default(0),
  orderBy: z.array(queryOrderBySchema).max(5).optional(),
});

export const executeQuerySchema = analyticsQuerySchema;

export const queryIdParamSchema = z.object({
  queryId: uuidSchema,
});

// ============================================
// AGGREGATION SCHEMAS
// ============================================

export const createAggregationSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.nativeEnum(AggregationType),
  metricId: uuidSchema,
  timeRange: timeRangeSchema,
  granularity: z.nativeEnum(TimeGranularity),
});

export const queryAggregationsSchema = z.object({
  metricIds: z.array(uuidSchema).max(50).optional(),
  types: z.array(z.nativeEnum(AggregationType)).optional(),
  timeRange: timeRangeSchema.optional(),
  granularity: z.nativeEnum(TimeGranularity).optional(),
  ...paginationSchema.shape,
});

export const aggregationIdParamSchema = z.object({
  aggregationId: uuidSchema,
});

// ============================================
// REPORT SCHEMAS
// ============================================

export const reportScheduleSchema = z.object({
  frequency: z.nativeEnum(ScheduleFrequency),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  timezone: z.string().max(50).default('UTC'),
  enabled: z.boolean().default(true),
});

export const createReportSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: z.nativeEnum(ReportType),
  query: analyticsQuerySchema,
  schedule: reportScheduleSchema.optional(),
  format: z.nativeEnum(ReportFormat).default(ReportFormat.JSON),
  recipients: z.array(z.string().email()).max(50).optional(),
});

export const updateReportSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  query: analyticsQuerySchema.optional(),
  schedule: reportScheduleSchema.optional(),
  format: z.nativeEnum(ReportFormat).optional(),
  recipients: z.array(z.string().email()).max(50).optional(),
});

export const queryReportsSchema = z.object({
  types: z.array(z.nativeEnum(ReportType)).optional(),
  createdBy: z.string().max(100).optional(),
  ...paginationSchema.shape,
});

export const reportIdParamSchema = z.object({
  reportId: uuidSchema,
});

// ============================================
// DASHBOARD SCHEMAS
// ============================================

export const widgetPositionSchema = z.object({
  x: nonNegativeIntSchema,
  y: nonNegativeIntSchema,
});

export const widgetSizeSchema = z.object({
  width: positiveIntSchema.max(12),
  height: positiveIntSchema.max(12),
});

export const dashboardWidgetSchema = z.object({
  type: z.nativeEnum(WidgetType),
  title: z.string().min(1).max(200),
  query: analyticsQuerySchema,
  visualization: z.nativeEnum(VisualizationType),
  position: widgetPositionSchema,
  size: widgetSizeSchema,
  refreshInterval: z.number().int().min(0).max(86400).optional(),
});

export const dashboardLayoutSchema = z.object({
  columns: z.number().int().min(1).max(24).default(12),
  rowHeight: z.number().int().min(10).max(500).default(100),
});

export const createDashboardSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  widgets: z.array(dashboardWidgetSchema).max(50).default([]),
  layout: dashboardLayoutSchema.default({ columns: 12, rowHeight: 100 }),
  isPublic: z.boolean().default(false),
});

export const updateDashboardSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  widgets: z.array(dashboardWidgetSchema).max(50).optional(),
  layout: dashboardLayoutSchema.optional(),
  isPublic: z.boolean().optional(),
});

export const addWidgetSchema = dashboardWidgetSchema;

export const updateWidgetSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  query: analyticsQuerySchema.optional(),
  visualization: z.nativeEnum(VisualizationType).optional(),
  position: widgetPositionSchema.optional(),
  size: widgetSizeSchema.optional(),
  refreshInterval: z.number().int().min(0).max(86400).optional(),
});

export const queryDashboardsSchema = z.object({
  isPublic: z.boolean().optional(),
  createdBy: z.string().max(100).optional(),
  ...paginationSchema.shape,
});

export const dashboardIdParamSchema = z.object({
  dashboardId: uuidSchema,
});

export const widgetIdParamSchema = z.object({
  dashboardId: uuidSchema,
  widgetId: uuidSchema,
});

// ============================================
// ALERT SCHEMAS
// ============================================

export const alertChannelSchema = z.object({
  type: z.nativeEnum(AlertChannelType),
  config: z.record(z.unknown()),
});

export const createAlertSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  metricId: uuidSchema,
  condition: z.nativeEnum(AlertCondition),
  threshold: z.number(),
  severity: z.nativeEnum(AlertSeverity),
  channels: z.array(alertChannelSchema).min(1).max(10),
  enabled: z.boolean().default(true),
  cooldownMinutes: z.number().int().min(1).max(1440).default(15),
});

export const updateAlertSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  condition: z.nativeEnum(AlertCondition).optional(),
  threshold: z.number().optional(),
  severity: z.nativeEnum(AlertSeverity).optional(),
  channels: z.array(alertChannelSchema).min(1).max(10).optional(),
  enabled: z.boolean().optional(),
  cooldownMinutes: z.number().int().min(1).max(1440).optional(),
});

export const queryAlertsSchema = z.object({
  metricId: uuidSchema.optional(),
  severity: z.nativeEnum(AlertSeverity).optional(),
  enabled: z.boolean().optional(),
  ...paginationSchema.shape,
});

export const alertIdParamSchema = z.object({
  alertId: uuidSchema,
});

export const acknowledgeAlertSchema = z.object({
  alertEventId: uuidSchema,
  note: z.string().max(500).optional(),
});

// ============================================
// USER & AUTH SCHEMAS
// ============================================

export const createUserSchema = z.object({
  externalId: z.string().max(100).optional(),
  role: z.nativeEnum(UserRole).default(UserRole.VIEWER),
  tier: z.nativeEnum(UserTier).default(UserTier.BASIC),
  permissions: z.array(z.nativeEnum(Permission)).default([]),
});

export const updateUserSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  tier: z.nativeEnum(UserTier).optional(),
  permissions: z.array(z.nativeEnum(Permission)).optional(),
});

export const userIdParamSchema = z.object({
  userId: uuidSchema,
});

// ============================================
// EXPORT SCHEMAS
// ============================================

export const exportDataSchema = z.object({
  type: z.enum(['metrics', 'events', 'reports']),
  format: z.nativeEnum(ReportFormat),
  timeRange: timeRangeSchema,
  filters: z.array(queryFilterSchema).max(20).optional(),
  includeMetadata: z.boolean().default(true),
});

// ============================================
// HEALTH & STATUS SCHEMAS
// ============================================

export const healthCheckSchema = z.object({
  includeDetails: z.boolean().default(false),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateMetricDTO = z.infer<typeof createMetricSchema>;
export type UpdateMetricDTO = z.infer<typeof updateMetricSchema>;
export type RecordMetricDTO = z.infer<typeof recordMetricSchema>;
export type BatchRecordMetricsDTO = z.infer<typeof batchRecordMetricsSchema>;
export type QueryMetricsDTO = z.infer<typeof queryMetricsSchema>;

export type TrackEventDTO = z.infer<typeof trackEventSchema>;
export type BatchTrackEventsDTO = z.infer<typeof batchTrackEventsSchema>;
export type QueryEventsDTO = z.infer<typeof queryEventsSchema>;

export type AnalyticsQueryDTO = z.infer<typeof analyticsQuerySchema>;
export type ExecuteQueryDTO = z.infer<typeof executeQuerySchema>;

export type CreateAggregationDTO = z.infer<typeof createAggregationSchema>;
export type QueryAggregationsDTO = z.infer<typeof queryAggregationsSchema>;

export type CreateReportDTO = z.infer<typeof createReportSchema>;
export type UpdateReportDTO = z.infer<typeof updateReportSchema>;
export type QueryReportsDTO = z.infer<typeof queryReportsSchema>;

export type CreateDashboardDTO = z.infer<typeof createDashboardSchema>;
export type UpdateDashboardDTO = z.infer<typeof updateDashboardSchema>;
export type AddWidgetDTO = z.infer<typeof addWidgetSchema>;
export type UpdateWidgetDTO = z.infer<typeof updateWidgetSchema>;
export type QueryDashboardsDTO = z.infer<typeof queryDashboardsSchema>;

export type CreateAlertDTO = z.infer<typeof createAlertSchema>;
export type UpdateAlertDTO = z.infer<typeof updateAlertSchema>;
export type QueryAlertsDTO = z.infer<typeof queryAlertsSchema>;
export type AcknowledgeAlertDTO = z.infer<typeof acknowledgeAlertSchema>;

export type CreateUserDTO = z.infer<typeof createUserSchema>;
export type UpdateUserDTO = z.infer<typeof updateUserSchema>;

export type ExportDataDTO = z.infer<typeof exportDataSchema>;
export type PaginationDTO = z.infer<typeof paginationSchema>;
export type TimeRangeDTO = z.infer<typeof timeRangeSchema>;
