import { z } from 'zod';

export const EventTypeSchema = z.enum([
  'user_action',
  'system_event',
  'error',
  'performance',
  'custom'
]);

export type EventType = z.infer<typeof EventTypeSchema>;

export const TelemetryEventSchema = z.object({
  id: z.string().uuid().optional(),
  type: EventTypeSchema,
  name: z.string().min(1).max(255),
  timestamp: z.number().int().positive().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  properties: z.record(z.unknown()).optional()
});

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;

export interface StoredEvent extends TelemetryEvent {
  id: string;
  timestamp: number;
  receivedAt: number;
}

export const BatchEventsSchema = z.object({
  events: z.array(TelemetryEventSchema).min(1).max(100)
});

export type BatchEvents = z.infer<typeof BatchEventsSchema>;

export const SessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().optional(),
  startTime: z.number().int().positive(),
  endTime: z.number().int().positive().optional(),
  duration: z.number().int().nonnegative().optional(),
  pageViews: z.number().int().nonnegative().default(0),
  events: z.number().int().nonnegative().default(0),
  metadata: z.record(z.unknown()).optional()
});

export type Session = z.infer<typeof SessionSchema>;

export interface SessionAnalytics {
  totalSessions: number;
  activeSessions: number;
  averageDuration: number;
  bounceRate: number;
  sessionsOverTime: TimeSeriesData[];
}

export const MetricTypeSchema = z.enum([
  'counter',
  'gauge',
  'histogram',
  'summary'
]);

export type MetricType = z.infer<typeof MetricTypeSchema>;

export const MetricSchema = z.object({
  name: z.string().min(1).max(255),
  type: MetricTypeSchema,
  value: z.number(),
  timestamp: z.number().int().positive().optional(),
  tags: z.record(z.string()).optional(),
  unit: z.string().optional()
});

export type Metric = z.infer<typeof MetricSchema>;

export interface StoredMetric extends Metric {
  id: string;
  timestamp: number;
}

export const AggregationPeriodSchema = z.enum([
  'minute',
  'hour',
  'day',
  'week',
  'month'
]);

export type AggregationPeriod = z.infer<typeof AggregationPeriodSchema>;

export interface AggregatedMetric {
  name: string;
  period: AggregationPeriod;
  startTime: number;
  endTime: number;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface TimeSeriesData {
  timestamp: number;
  value: number;
}

export interface UserBehavior {
  userId: string;
  totalSessions: number;
  totalEvents: number;
  firstSeen: number;
  lastSeen: number;
  averageSessionDuration: number;
  topEvents: Array<{ name: string; count: number }>;
}

export interface FunnelStep {
  name: string;
  eventName: string;
  count: number;
  conversionRate: number;
  dropoffRate: number;
}

export interface FunnelAnalysis {
  name: string;
  steps: FunnelStep[];
  overallConversionRate: number;
  totalUsers: number;
}

export const DashboardWidgetTypeSchema = z.enum([
  'line_chart',
  'bar_chart',
  'pie_chart',
  'metric_card',
  'table',
  'heatmap'
]);

export type DashboardWidgetType = z.infer<typeof DashboardWidgetTypeSchema>;

export const DashboardWidgetSchema = z.object({
  id: z.string().uuid(),
  type: DashboardWidgetTypeSchema,
  title: z.string().min(1).max(255),
  config: z.record(z.unknown()),
  position: z.object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive()
  })
});

export type DashboardWidget = z.infer<typeof DashboardWidgetSchema>;

export const DashboardSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  widgets: z.array(DashboardWidgetSchema).optional(),
  createdAt: z.number().int().positive().optional(),
  updatedAt: z.number().int().positive().optional()
});

export type Dashboard = z.infer<typeof DashboardSchema>;

export interface StoredDashboard extends Omit<Dashboard, 'widgets'> {
  id: string;
  widgets: DashboardWidget[];
  createdAt: number;
  updatedAt: number;
}

export const ExportFormatSchema = z.enum(['json', 'csv']);

export type ExportFormat = z.infer<typeof ExportFormatSchema>;

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  version: string;
  checks: Record<string, {
    status: 'pass' | 'fail';
    message?: string;
  }>;
}

export interface SystemStatus {
  eventsProcessed: number;
  metricsRecorded: number;
  activeSessions: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
}

export interface AlertThreshold {
  id: string;
  metricName: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
}

export interface Alert {
  id: string;
  thresholdId: string;
  metricName: string;
  currentValue: number;
  thresholdValue: number;
  severity: 'info' | 'warning' | 'critical';
  triggeredAt: number;
  resolved: boolean;
  resolvedAt?: number;
}

export interface QueryOptions {
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
  userId?: string;
  sessionId?: string;
  eventType?: EventType;
  metricName?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface WebSocketMessage {
  type: 'event' | 'metric' | 'alert' | 'status';
  payload: unknown;
  timestamp: number;
}
