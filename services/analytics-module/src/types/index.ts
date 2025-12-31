/**
 * GameVerse Analytics Module - Type Definitions
 * Comprehensive types for analytics, metrics, events, and queries
 */

// Metric Types
export enum MetricType {
  COUNTER = 'COUNTER',
  GAUGE = 'GAUGE',
  HISTOGRAM = 'HISTOGRAM',
  SUMMARY = 'SUMMARY',
  TIMER = 'TIMER',
}

export enum MetricCategory {
  PLAYER = 'PLAYER',
  GAME = 'GAME',
  SESSION = 'SESSION',
  ECONOMY = 'ECONOMY',
  SOCIAL = 'SOCIAL',
  PERFORMANCE = 'PERFORMANCE',
  ENGAGEMENT = 'ENGAGEMENT',
  RETENTION = 'RETENTION',
  MONETIZATION = 'MONETIZATION',
  CUSTOM = 'CUSTOM',
}

// Event Types
export enum AnalyticsEventType {
  // Player Events
  PLAYER_LOGIN = 'PLAYER_LOGIN',
  PLAYER_LOGOUT = 'PLAYER_LOGOUT',
  PLAYER_REGISTER = 'PLAYER_REGISTER',
  PLAYER_LEVEL_UP = 'PLAYER_LEVEL_UP',
  PLAYER_ACHIEVEMENT = 'PLAYER_ACHIEVEMENT',
  PLAYER_PROFILE_UPDATE = 'PLAYER_PROFILE_UPDATE',

  // Game Events
  GAME_START = 'GAME_START',
  GAME_END = 'GAME_END',
  GAME_PAUSE = 'GAME_PAUSE',
  GAME_RESUME = 'GAME_RESUME',
  MATCH_JOIN = 'MATCH_JOIN',
  MATCH_LEAVE = 'MATCH_LEAVE',
  MATCH_COMPLETE = 'MATCH_COMPLETE',

  // Economy Events
  CURRENCY_EARNED = 'CURRENCY_EARNED',
  CURRENCY_SPENT = 'CURRENCY_SPENT',
  ITEM_PURCHASED = 'ITEM_PURCHASED',
  ITEM_SOLD = 'ITEM_SOLD',
  TRADE_COMPLETED = 'TRADE_COMPLETED',

  // Social Events
  FRIEND_ADDED = 'FRIEND_ADDED',
  FRIEND_REMOVED = 'FRIEND_REMOVED',
  PARTY_CREATED = 'PARTY_CREATED',
  PARTY_JOINED = 'PARTY_JOINED',
  PARTY_LEFT = 'PARTY_LEFT',
  MESSAGE_SENT = 'MESSAGE_SENT',

  // Engagement Events
  FEATURE_USED = 'FEATURE_USED',
  TUTORIAL_STARTED = 'TUTORIAL_STARTED',
  TUTORIAL_COMPLETED = 'TUTORIAL_COMPLETED',
  QUEST_STARTED = 'QUEST_STARTED',
  QUEST_COMPLETED = 'QUEST_COMPLETED',

  // System Events
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  PERFORMANCE_METRIC = 'PERFORMANCE_METRIC',
  API_CALL = 'API_CALL',

  // Custom Events
  CUSTOM = 'CUSTOM',
}

// Aggregation Types
export enum AggregationType {
  SUM = 'SUM',
  AVG = 'AVG',
  MIN = 'MIN',
  MAX = 'MAX',
  COUNT = 'COUNT',
  COUNT_DISTINCT = 'COUNT_DISTINCT',
  PERCENTILE = 'PERCENTILE',
  MEDIAN = 'MEDIAN',
  STDDEV = 'STDDEV',
  VARIANCE = 'VARIANCE',
}

// Time Granularity
export enum TimeGranularity {
  MINUTE = 'MINUTE',
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR',
}

// User Tier for Rate Limiting
export enum UserTier {
  BASIC = 'BASIC',
  STANDARD = 'STANDARD',
  PREMIUM = 'PREMIUM',
}

// User Role for RBAC
export enum UserRole {
  ADMIN = 'ADMIN',
  ANALYST = 'ANALYST',
  VIEWER = 'VIEWER',
}

// Permission Types
export enum Permission {
  // Metrics Permissions
  METRICS_READ = 'METRICS_READ',
  METRICS_WRITE = 'METRICS_WRITE',
  METRICS_DELETE = 'METRICS_DELETE',
  METRICS_EXPORT = 'METRICS_EXPORT',

  // Events Permissions
  EVENTS_READ = 'EVENTS_READ',
  EVENTS_WRITE = 'EVENTS_WRITE',
  EVENTS_DELETE = 'EVENTS_DELETE',
  EVENTS_EXPORT = 'EVENTS_EXPORT',

  // Query Permissions
  QUERY_BASIC = 'QUERY_BASIC',
  QUERY_ADVANCED = 'QUERY_ADVANCED',
  QUERY_EXPORT = 'QUERY_EXPORT',

  // Report Permissions
  REPORTS_READ = 'REPORTS_READ',
  REPORTS_CREATE = 'REPORTS_CREATE',
  REPORTS_SCHEDULE = 'REPORTS_SCHEDULE',

  // Admin Permissions
  ADMIN_USERS = 'ADMIN_USERS',
  ADMIN_CONFIG = 'ADMIN_CONFIG',
  ADMIN_AUDIT = 'ADMIN_AUDIT',
}

// Interfaces

export interface Metric {
  id: string;
  name: string;
  type: MetricType;
  category: MetricCategory;
  description?: string;
  unit?: string;
  value: number;
  labels: Record<string, string>;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

export interface MetricSeries {
  metricId: string;
  name: string;
  type: MetricType;
  dataPoints: MetricDataPoint[];
}

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  playerId?: string;
  sessionId?: string;
  correlationId?: string;
  payload: Record<string, unknown>;
  metadata: EventMetadata;
  timestamp: Date;
  processedAt?: Date;
  createdAt: Date;
}

export interface EventMetadata {
  source: string;
  version: string;
  platform?: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  gameId?: string;
  serverId?: string;
}

export interface AnalyticsQuery {
  id: string;
  name?: string;
  metrics: string[];
  filters: QueryFilter[];
  groupBy?: string[];
  aggregations: QueryAggregation[];
  timeRange: TimeRange;
  granularity?: TimeGranularity;
  limit?: number;
  offset?: number;
  orderBy?: QueryOrderBy[];
}

export interface QueryFilter {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

export enum FilterOperator {
  EQ = 'EQ',
  NE = 'NE',
  GT = 'GT',
  GTE = 'GTE',
  LT = 'LT',
  LTE = 'LTE',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
  CONTAINS = 'CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',
  BETWEEN = 'BETWEEN',
  IS_NULL = 'IS_NULL',
  IS_NOT_NULL = 'IS_NOT_NULL',
}

export interface QueryAggregation {
  field: string;
  type: AggregationType;
  alias?: string;
  percentile?: number;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface QueryOrderBy {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface QueryResult {
  queryId: string;
  data: Record<string, unknown>[];
  metadata: QueryResultMetadata;
  executedAt: Date;
}

export interface QueryResultMetadata {
  totalRows: number;
  executionTimeMs: number;
  fromCache: boolean;
  cacheKey?: string;
  truncated: boolean;
}

export interface Aggregation {
  id: string;
  name: string;
  type: AggregationType;
  metricId: string;
  timeRange: TimeRange;
  granularity: TimeGranularity;
  value: number;
  count: number;
  computedAt: Date;
}

export interface Report {
  id: string;
  name: string;
  description?: string;
  type: ReportType;
  query: AnalyticsQuery;
  schedule?: ReportSchedule;
  format: ReportFormat;
  recipients?: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt?: Date;
}

export enum ReportType {
  DASHBOARD = 'DASHBOARD',
  SCHEDULED = 'SCHEDULED',
  AD_HOC = 'AD_HOC',
  ALERT = 'ALERT',
}

export enum ReportFormat {
  JSON = 'JSON',
  CSV = 'CSV',
  PDF = 'PDF',
  EXCEL = 'EXCEL',
}

export interface ReportSchedule {
  frequency: ScheduleFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour: number;
  minute: number;
  timezone: string;
  enabled: boolean;
}

export enum ScheduleFrequency {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  query: AnalyticsQuery;
  visualization: VisualizationType;
  position: WidgetPosition;
  size: WidgetSize;
  refreshInterval?: number;
}

export enum WidgetType {
  METRIC = 'METRIC',
  CHART = 'CHART',
  TABLE = 'TABLE',
  TEXT = 'TEXT',
  ALERT = 'ALERT',
}

export enum VisualizationType {
  LINE = 'LINE',
  BAR = 'BAR',
  PIE = 'PIE',
  AREA = 'AREA',
  SCATTER = 'SCATTER',
  HEATMAP = 'HEATMAP',
  GAUGE = 'GAUGE',
  NUMBER = 'NUMBER',
  TABLE = 'TABLE',
}

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface WidgetSize {
  width: number;
  height: number;
}

export interface DashboardLayout {
  columns: number;
  rowHeight: number;
}

export interface Alert {
  id: string;
  name: string;
  description?: string;
  metricId: string;
  condition: AlertCondition;
  threshold: number;
  severity: AlertSeverity;
  channels: AlertChannel[];
  enabled: boolean;
  cooldownMinutes: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastTriggeredAt?: Date;
}

export enum AlertCondition {
  ABOVE = 'ABOVE',
  BELOW = 'BELOW',
  EQUALS = 'EQUALS',
  CHANGE_PERCENT = 'CHANGE_PERCENT',
  ANOMALY = 'ANOMALY',
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export interface AlertChannel {
  type: AlertChannelType;
  config: Record<string, unknown>;
}

export enum AlertChannelType {
  EMAIL = 'EMAIL',
  WEBHOOK = 'WEBHOOK',
  SLACK = 'SLACK',
  SMS = 'SMS',
}

export interface AlertEvent {
  id: string;
  alertId: string;
  triggeredAt: Date;
  value: number;
  threshold: number;
  severity: AlertSeverity;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

// User and Session Types
export interface AnalyticsUser {
  id: string;
  externalId?: string;
  role: UserRole;
  tier: UserTier;
  permissions: Permission[];
  apiKey?: string;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt?: Date;
}

export interface AnalyticsSession {
  id: string;
  userId: string;
  playerId?: string;
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
  events: string[];
  metadata: Record<string, unknown>;
}

// Cache Types
export interface CacheEntry<T> {
  key: string;
  value: T;
  ttl: number;
  createdAt: Date;
  expiresAt: Date;
  hits: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  hitRate: number;
  evictions: number;
}

// Rate Limit Types
export interface RateLimitConfig {
  tier: UserTier;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
}

export interface RateLimitState {
  userId: string;
  tier: UserTier;
  minuteCount: number;
  hourCount: number;
  dayCount: number;
  lastRequestAt: Date;
  windowStart: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
    executionTimeMs?: number;
    fromCache?: boolean;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

// Audit Types
export interface AuditLog {
  id: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  userId: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export enum AuditAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  EXPORT = 'EXPORT',
  QUERY = 'QUERY',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  CONFIG_CHANGE = 'CONFIG_CHANGE',
}

// Health Check Types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: Date;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  latencyMs?: number;
}
