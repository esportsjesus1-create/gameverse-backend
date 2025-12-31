/**
 * GameVerse Analytics Module - Custom Error Handling System
 * 40+ domain-specific error codes with structured responses
 */

// Error code categories
export enum AnalyticsErrorCode {
  // Analytics Core Errors (1000-1099)
  ANALYTICS_INITIALIZATION_FAILED = 'ANALYTICS_1000',
  ANALYTICS_SERVICE_UNAVAILABLE = 'ANALYTICS_1001',
  ANALYTICS_CONFIGURATION_INVALID = 'ANALYTICS_1002',
  ANALYTICS_DEPENDENCY_MISSING = 'ANALYTICS_1003',
  ANALYTICS_TIMEOUT = 'ANALYTICS_1004',
  ANALYTICS_CIRCUIT_BREAKER_OPEN = 'ANALYTICS_1005',
  ANALYTICS_SHUTDOWN_IN_PROGRESS = 'ANALYTICS_1006',

  // Metrics Errors (1100-1199)
  METRICS_NOT_FOUND = 'METRICS_1100',
  METRICS_INVALID_TYPE = 'METRICS_1101',
  METRICS_INVALID_VALUE = 'METRICS_1102',
  METRICS_DUPLICATE_NAME = 'METRICS_1103',
  METRICS_LIMIT_EXCEEDED = 'METRICS_1104',
  METRICS_RECORDING_FAILED = 'METRICS_1105',
  METRICS_AGGREGATION_FAILED = 'METRICS_1106',
  METRICS_EXPORT_FAILED = 'METRICS_1107',
  METRICS_INVALID_TIMESTAMP = 'METRICS_1108',
  METRICS_BATCH_TOO_LARGE = 'METRICS_1109',

  // Event Tracking Errors (1200-1299)
  EVENT_NOT_FOUND = 'EVENT_1200',
  EVENT_INVALID_TYPE = 'EVENT_1201',
  EVENT_INVALID_PAYLOAD = 'EVENT_1202',
  EVENT_DUPLICATE = 'EVENT_1203',
  EVENT_TRACKING_DISABLED = 'EVENT_1204',
  EVENT_QUEUE_FULL = 'EVENT_1205',
  EVENT_PROCESSING_FAILED = 'EVENT_1206',
  EVENT_BATCH_FAILED = 'EVENT_1207',
  EVENT_SCHEMA_MISMATCH = 'EVENT_1208',
  EVENT_CORRELATION_INVALID = 'EVENT_1209',

  // Query Errors (1300-1399)
  QUERY_INVALID_SYNTAX = 'QUERY_1300',
  QUERY_INVALID_PARAMETERS = 'QUERY_1301',
  QUERY_TIMEOUT = 'QUERY_1302',
  QUERY_RESULT_TOO_LARGE = 'QUERY_1303',
  QUERY_UNSUPPORTED_OPERATION = 'QUERY_1304',
  QUERY_INVALID_TIME_RANGE = 'QUERY_1305',
  QUERY_INVALID_AGGREGATION = 'QUERY_1306',
  QUERY_INVALID_FILTER = 'QUERY_1307',
  QUERY_EXECUTION_FAILED = 'QUERY_1308',
  QUERY_CANCELLED = 'QUERY_1309',

  // Aggregation Errors (1400-1499)
  AGGREGATION_NOT_FOUND = 'AGGREGATION_1400',
  AGGREGATION_INVALID_TYPE = 'AGGREGATION_1401',
  AGGREGATION_COMPUTATION_FAILED = 'AGGREGATION_1402',
  AGGREGATION_WINDOW_INVALID = 'AGGREGATION_1403',
  AGGREGATION_BUCKET_OVERFLOW = 'AGGREGATION_1404',
  AGGREGATION_PRECISION_LOSS = 'AGGREGATION_1405',

  // Cache Errors (1500-1599)
  CACHE_CONNECTION_FAILED = 'CACHE_1500',
  CACHE_KEY_NOT_FOUND = 'CACHE_1501',
  CACHE_WRITE_FAILED = 'CACHE_1502',
  CACHE_INVALIDATION_FAILED = 'CACHE_1503',
  CACHE_CAPACITY_EXCEEDED = 'CACHE_1504',
  CACHE_SERIALIZATION_FAILED = 'CACHE_1505',
  CACHE_DESERIALIZATION_FAILED = 'CACHE_1506',
  CACHE_TTL_INVALID = 'CACHE_1507',

  // Rate Limit Errors (1600-1699)
  RATE_LIMIT_EXCEEDED_BASIC = 'RATE_LIMIT_1600',
  RATE_LIMIT_EXCEEDED_STANDARD = 'RATE_LIMIT_1601',
  RATE_LIMIT_EXCEEDED_PREMIUM = 'RATE_LIMIT_1602',
  RATE_LIMIT_QUOTA_EXHAUSTED = 'RATE_LIMIT_1603',
  RATE_LIMIT_BURST_EXCEEDED = 'RATE_LIMIT_1604',

  // Validation Errors (1700-1799)
  VALIDATION_REQUIRED_FIELD = 'VALIDATION_1700',
  VALIDATION_INVALID_FORMAT = 'VALIDATION_1701',
  VALIDATION_OUT_OF_RANGE = 'VALIDATION_1702',
  VALIDATION_TYPE_MISMATCH = 'VALIDATION_1703',
  VALIDATION_CONSTRAINT_VIOLATED = 'VALIDATION_1704',
  VALIDATION_SCHEMA_FAILED = 'VALIDATION_1705',

  // Permission Errors (1800-1899)
  PERMISSION_DENIED = 'PERMISSION_1800',
  PERMISSION_INSUFFICIENT_ROLE = 'PERMISSION_1801',
  PERMISSION_RESOURCE_RESTRICTED = 'PERMISSION_1802',
  PERMISSION_ACTION_FORBIDDEN = 'PERMISSION_1803',
  PERMISSION_SCOPE_INVALID = 'PERMISSION_1804',

  // Data Errors (1900-1999)
  DATA_INTEGRITY_VIOLATION = 'DATA_1900',
  DATA_CORRUPTION_DETECTED = 'DATA_1901',
  DATA_MIGRATION_FAILED = 'DATA_1902',
  DATA_EXPORT_FAILED = 'DATA_1903',
  DATA_IMPORT_FAILED = 'DATA_1904',
  DATA_RETENTION_POLICY_VIOLATED = 'DATA_1905',
}

// HTTP status codes mapping
const ERROR_STATUS_CODES: Record<AnalyticsErrorCode, number> = {
  // Analytics Core Errors
  [AnalyticsErrorCode.ANALYTICS_INITIALIZATION_FAILED]: 500,
  [AnalyticsErrorCode.ANALYTICS_SERVICE_UNAVAILABLE]: 503,
  [AnalyticsErrorCode.ANALYTICS_CONFIGURATION_INVALID]: 500,
  [AnalyticsErrorCode.ANALYTICS_DEPENDENCY_MISSING]: 500,
  [AnalyticsErrorCode.ANALYTICS_TIMEOUT]: 504,
  [AnalyticsErrorCode.ANALYTICS_CIRCUIT_BREAKER_OPEN]: 503,
  [AnalyticsErrorCode.ANALYTICS_SHUTDOWN_IN_PROGRESS]: 503,

  // Metrics Errors
  [AnalyticsErrorCode.METRICS_NOT_FOUND]: 404,
  [AnalyticsErrorCode.METRICS_INVALID_TYPE]: 400,
  [AnalyticsErrorCode.METRICS_INVALID_VALUE]: 400,
  [AnalyticsErrorCode.METRICS_DUPLICATE_NAME]: 409,
  [AnalyticsErrorCode.METRICS_LIMIT_EXCEEDED]: 429,
  [AnalyticsErrorCode.METRICS_RECORDING_FAILED]: 500,
  [AnalyticsErrorCode.METRICS_AGGREGATION_FAILED]: 500,
  [AnalyticsErrorCode.METRICS_EXPORT_FAILED]: 500,
  [AnalyticsErrorCode.METRICS_INVALID_TIMESTAMP]: 400,
  [AnalyticsErrorCode.METRICS_BATCH_TOO_LARGE]: 413,

  // Event Tracking Errors
  [AnalyticsErrorCode.EVENT_NOT_FOUND]: 404,
  [AnalyticsErrorCode.EVENT_INVALID_TYPE]: 400,
  [AnalyticsErrorCode.EVENT_INVALID_PAYLOAD]: 400,
  [AnalyticsErrorCode.EVENT_DUPLICATE]: 409,
  [AnalyticsErrorCode.EVENT_TRACKING_DISABLED]: 403,
  [AnalyticsErrorCode.EVENT_QUEUE_FULL]: 503,
  [AnalyticsErrorCode.EVENT_PROCESSING_FAILED]: 500,
  [AnalyticsErrorCode.EVENT_BATCH_FAILED]: 500,
  [AnalyticsErrorCode.EVENT_SCHEMA_MISMATCH]: 400,
  [AnalyticsErrorCode.EVENT_CORRELATION_INVALID]: 400,

  // Query Errors
  [AnalyticsErrorCode.QUERY_INVALID_SYNTAX]: 400,
  [AnalyticsErrorCode.QUERY_INVALID_PARAMETERS]: 400,
  [AnalyticsErrorCode.QUERY_TIMEOUT]: 504,
  [AnalyticsErrorCode.QUERY_RESULT_TOO_LARGE]: 413,
  [AnalyticsErrorCode.QUERY_UNSUPPORTED_OPERATION]: 400,
  [AnalyticsErrorCode.QUERY_INVALID_TIME_RANGE]: 400,
  [AnalyticsErrorCode.QUERY_INVALID_AGGREGATION]: 400,
  [AnalyticsErrorCode.QUERY_INVALID_FILTER]: 400,
  [AnalyticsErrorCode.QUERY_EXECUTION_FAILED]: 500,
  [AnalyticsErrorCode.QUERY_CANCELLED]: 499,

  // Aggregation Errors
  [AnalyticsErrorCode.AGGREGATION_NOT_FOUND]: 404,
  [AnalyticsErrorCode.AGGREGATION_INVALID_TYPE]: 400,
  [AnalyticsErrorCode.AGGREGATION_COMPUTATION_FAILED]: 500,
  [AnalyticsErrorCode.AGGREGATION_WINDOW_INVALID]: 400,
  [AnalyticsErrorCode.AGGREGATION_BUCKET_OVERFLOW]: 500,
  [AnalyticsErrorCode.AGGREGATION_PRECISION_LOSS]: 500,

  // Cache Errors
  [AnalyticsErrorCode.CACHE_CONNECTION_FAILED]: 503,
  [AnalyticsErrorCode.CACHE_KEY_NOT_FOUND]: 404,
  [AnalyticsErrorCode.CACHE_WRITE_FAILED]: 500,
  [AnalyticsErrorCode.CACHE_INVALIDATION_FAILED]: 500,
  [AnalyticsErrorCode.CACHE_CAPACITY_EXCEEDED]: 507,
  [AnalyticsErrorCode.CACHE_SERIALIZATION_FAILED]: 500,
  [AnalyticsErrorCode.CACHE_DESERIALIZATION_FAILED]: 500,
  [AnalyticsErrorCode.CACHE_TTL_INVALID]: 400,

  // Rate Limit Errors
  [AnalyticsErrorCode.RATE_LIMIT_EXCEEDED_BASIC]: 429,
  [AnalyticsErrorCode.RATE_LIMIT_EXCEEDED_STANDARD]: 429,
  [AnalyticsErrorCode.RATE_LIMIT_EXCEEDED_PREMIUM]: 429,
  [AnalyticsErrorCode.RATE_LIMIT_QUOTA_EXHAUSTED]: 429,
  [AnalyticsErrorCode.RATE_LIMIT_BURST_EXCEEDED]: 429,

  // Validation Errors
  [AnalyticsErrorCode.VALIDATION_REQUIRED_FIELD]: 400,
  [AnalyticsErrorCode.VALIDATION_INVALID_FORMAT]: 400,
  [AnalyticsErrorCode.VALIDATION_OUT_OF_RANGE]: 400,
  [AnalyticsErrorCode.VALIDATION_TYPE_MISMATCH]: 400,
  [AnalyticsErrorCode.VALIDATION_CONSTRAINT_VIOLATED]: 400,
  [AnalyticsErrorCode.VALIDATION_SCHEMA_FAILED]: 400,

  // Permission Errors
  [AnalyticsErrorCode.PERMISSION_DENIED]: 403,
  [AnalyticsErrorCode.PERMISSION_INSUFFICIENT_ROLE]: 403,
  [AnalyticsErrorCode.PERMISSION_RESOURCE_RESTRICTED]: 403,
  [AnalyticsErrorCode.PERMISSION_ACTION_FORBIDDEN]: 403,
  [AnalyticsErrorCode.PERMISSION_SCOPE_INVALID]: 403,

  // Data Errors
  [AnalyticsErrorCode.DATA_INTEGRITY_VIOLATION]: 500,
  [AnalyticsErrorCode.DATA_CORRUPTION_DETECTED]: 500,
  [AnalyticsErrorCode.DATA_MIGRATION_FAILED]: 500,
  [AnalyticsErrorCode.DATA_EXPORT_FAILED]: 500,
  [AnalyticsErrorCode.DATA_IMPORT_FAILED]: 500,
  [AnalyticsErrorCode.DATA_RETENTION_POLICY_VIOLATED]: 400,
};

// Error messages mapping
const ERROR_MESSAGES: Record<AnalyticsErrorCode, string> = {
  // Analytics Core Errors
  [AnalyticsErrorCode.ANALYTICS_INITIALIZATION_FAILED]: 'Analytics service failed to initialize',
  [AnalyticsErrorCode.ANALYTICS_SERVICE_UNAVAILABLE]: 'Analytics service is temporarily unavailable',
  [AnalyticsErrorCode.ANALYTICS_CONFIGURATION_INVALID]: 'Invalid analytics configuration',
  [AnalyticsErrorCode.ANALYTICS_DEPENDENCY_MISSING]: 'Required analytics dependency is missing',
  [AnalyticsErrorCode.ANALYTICS_TIMEOUT]: 'Analytics operation timed out',
  [AnalyticsErrorCode.ANALYTICS_CIRCUIT_BREAKER_OPEN]: 'Analytics circuit breaker is open',
  [AnalyticsErrorCode.ANALYTICS_SHUTDOWN_IN_PROGRESS]: 'Analytics service is shutting down',

  // Metrics Errors
  [AnalyticsErrorCode.METRICS_NOT_FOUND]: 'Metric not found',
  [AnalyticsErrorCode.METRICS_INVALID_TYPE]: 'Invalid metric type',
  [AnalyticsErrorCode.METRICS_INVALID_VALUE]: 'Invalid metric value',
  [AnalyticsErrorCode.METRICS_DUPLICATE_NAME]: 'Metric with this name already exists',
  [AnalyticsErrorCode.METRICS_LIMIT_EXCEEDED]: 'Metrics limit exceeded',
  [AnalyticsErrorCode.METRICS_RECORDING_FAILED]: 'Failed to record metric',
  [AnalyticsErrorCode.METRICS_AGGREGATION_FAILED]: 'Metric aggregation failed',
  [AnalyticsErrorCode.METRICS_EXPORT_FAILED]: 'Metric export failed',
  [AnalyticsErrorCode.METRICS_INVALID_TIMESTAMP]: 'Invalid metric timestamp',
  [AnalyticsErrorCode.METRICS_BATCH_TOO_LARGE]: 'Metrics batch size exceeds limit',

  // Event Tracking Errors
  [AnalyticsErrorCode.EVENT_NOT_FOUND]: 'Event not found',
  [AnalyticsErrorCode.EVENT_INVALID_TYPE]: 'Invalid event type',
  [AnalyticsErrorCode.EVENT_INVALID_PAYLOAD]: 'Invalid event payload',
  [AnalyticsErrorCode.EVENT_DUPLICATE]: 'Duplicate event detected',
  [AnalyticsErrorCode.EVENT_TRACKING_DISABLED]: 'Event tracking is disabled',
  [AnalyticsErrorCode.EVENT_QUEUE_FULL]: 'Event queue is full',
  [AnalyticsErrorCode.EVENT_PROCESSING_FAILED]: 'Event processing failed',
  [AnalyticsErrorCode.EVENT_BATCH_FAILED]: 'Event batch processing failed',
  [AnalyticsErrorCode.EVENT_SCHEMA_MISMATCH]: 'Event schema mismatch',
  [AnalyticsErrorCode.EVENT_CORRELATION_INVALID]: 'Invalid event correlation ID',

  // Query Errors
  [AnalyticsErrorCode.QUERY_INVALID_SYNTAX]: 'Invalid query syntax',
  [AnalyticsErrorCode.QUERY_INVALID_PARAMETERS]: 'Invalid query parameters',
  [AnalyticsErrorCode.QUERY_TIMEOUT]: 'Query execution timed out',
  [AnalyticsErrorCode.QUERY_RESULT_TOO_LARGE]: 'Query result exceeds size limit',
  [AnalyticsErrorCode.QUERY_UNSUPPORTED_OPERATION]: 'Unsupported query operation',
  [AnalyticsErrorCode.QUERY_INVALID_TIME_RANGE]: 'Invalid time range for query',
  [AnalyticsErrorCode.QUERY_INVALID_AGGREGATION]: 'Invalid aggregation in query',
  [AnalyticsErrorCode.QUERY_INVALID_FILTER]: 'Invalid filter in query',
  [AnalyticsErrorCode.QUERY_EXECUTION_FAILED]: 'Query execution failed',
  [AnalyticsErrorCode.QUERY_CANCELLED]: 'Query was cancelled',

  // Aggregation Errors
  [AnalyticsErrorCode.AGGREGATION_NOT_FOUND]: 'Aggregation not found',
  [AnalyticsErrorCode.AGGREGATION_INVALID_TYPE]: 'Invalid aggregation type',
  [AnalyticsErrorCode.AGGREGATION_COMPUTATION_FAILED]: 'Aggregation computation failed',
  [AnalyticsErrorCode.AGGREGATION_WINDOW_INVALID]: 'Invalid aggregation window',
  [AnalyticsErrorCode.AGGREGATION_BUCKET_OVERFLOW]: 'Aggregation bucket overflow',
  [AnalyticsErrorCode.AGGREGATION_PRECISION_LOSS]: 'Aggregation precision loss detected',

  // Cache Errors
  [AnalyticsErrorCode.CACHE_CONNECTION_FAILED]: 'Cache connection failed',
  [AnalyticsErrorCode.CACHE_KEY_NOT_FOUND]: 'Cache key not found',
  [AnalyticsErrorCode.CACHE_WRITE_FAILED]: 'Cache write operation failed',
  [AnalyticsErrorCode.CACHE_INVALIDATION_FAILED]: 'Cache invalidation failed',
  [AnalyticsErrorCode.CACHE_CAPACITY_EXCEEDED]: 'Cache capacity exceeded',
  [AnalyticsErrorCode.CACHE_SERIALIZATION_FAILED]: 'Cache serialization failed',
  [AnalyticsErrorCode.CACHE_DESERIALIZATION_FAILED]: 'Cache deserialization failed',
  [AnalyticsErrorCode.CACHE_TTL_INVALID]: 'Invalid cache TTL value',

  // Rate Limit Errors
  [AnalyticsErrorCode.RATE_LIMIT_EXCEEDED_BASIC]: 'Basic tier rate limit exceeded',
  [AnalyticsErrorCode.RATE_LIMIT_EXCEEDED_STANDARD]: 'Standard tier rate limit exceeded',
  [AnalyticsErrorCode.RATE_LIMIT_EXCEEDED_PREMIUM]: 'Premium tier rate limit exceeded',
  [AnalyticsErrorCode.RATE_LIMIT_QUOTA_EXHAUSTED]: 'Rate limit quota exhausted',
  [AnalyticsErrorCode.RATE_LIMIT_BURST_EXCEEDED]: 'Burst rate limit exceeded',

  // Validation Errors
  [AnalyticsErrorCode.VALIDATION_REQUIRED_FIELD]: 'Required field is missing',
  [AnalyticsErrorCode.VALIDATION_INVALID_FORMAT]: 'Invalid field format',
  [AnalyticsErrorCode.VALIDATION_OUT_OF_RANGE]: 'Value is out of allowed range',
  [AnalyticsErrorCode.VALIDATION_TYPE_MISMATCH]: 'Type mismatch in field',
  [AnalyticsErrorCode.VALIDATION_CONSTRAINT_VIOLATED]: 'Validation constraint violated',
  [AnalyticsErrorCode.VALIDATION_SCHEMA_FAILED]: 'Schema validation failed',

  // Permission Errors
  [AnalyticsErrorCode.PERMISSION_DENIED]: 'Permission denied',
  [AnalyticsErrorCode.PERMISSION_INSUFFICIENT_ROLE]: 'Insufficient role permissions',
  [AnalyticsErrorCode.PERMISSION_RESOURCE_RESTRICTED]: 'Resource access restricted',
  [AnalyticsErrorCode.PERMISSION_ACTION_FORBIDDEN]: 'Action is forbidden',
  [AnalyticsErrorCode.PERMISSION_SCOPE_INVALID]: 'Invalid permission scope',

  // Data Errors
  [AnalyticsErrorCode.DATA_INTEGRITY_VIOLATION]: 'Data integrity violation detected',
  [AnalyticsErrorCode.DATA_CORRUPTION_DETECTED]: 'Data corruption detected',
  [AnalyticsErrorCode.DATA_MIGRATION_FAILED]: 'Data migration failed',
  [AnalyticsErrorCode.DATA_EXPORT_FAILED]: 'Data export failed',
  [AnalyticsErrorCode.DATA_IMPORT_FAILED]: 'Data import failed',
  [AnalyticsErrorCode.DATA_RETENTION_POLICY_VIOLATED]: 'Data retention policy violated',
};

/**
 * Structured error response interface
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: AnalyticsErrorCode;
    message: string;
    details?: unknown;
    timestamp: string;
    requestId?: string;
    path?: string;
  };
}

/**
 * Base Analytics Error class
 */
export class AnalyticsError extends Error {
  public readonly code: AnalyticsErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;
  public readonly timestamp: Date;

  constructor(
    code: AnalyticsErrorCode,
    message?: string,
    details?: unknown,
    isOperational = true
  ) {
    super(message || ERROR_MESSAGES[code]);
    this.code = code;
    this.statusCode = ERROR_STATUS_CODES[code];
    this.isOperational = isOperational;
    this.details = details;
    this.timestamp = new Date();

    Object.setPrototypeOf(this, AnalyticsError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  toResponse(requestId?: string, path?: string): ErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp.toISOString(),
        requestId,
        path,
      },
    };
  }
}

// Specialized error classes for each category

export class MetricsError extends AnalyticsError {
  constructor(code: AnalyticsErrorCode, message?: string, details?: unknown) {
    super(code, message, details);
  }
}

export class EventTrackingError extends AnalyticsError {
  constructor(code: AnalyticsErrorCode, message?: string, details?: unknown) {
    super(code, message, details);
  }
}

export class QueryError extends AnalyticsError {
  constructor(code: AnalyticsErrorCode, message?: string, details?: unknown) {
    super(code, message, details);
  }
}

export class AggregationError extends AnalyticsError {
  constructor(code: AnalyticsErrorCode, message?: string, details?: unknown) {
    super(code, message, details);
  }
}

export class CacheError extends AnalyticsError {
  constructor(code: AnalyticsErrorCode, message?: string, details?: unknown) {
    super(code, message, details);
  }
}

export class RateLimitError extends AnalyticsError {
  public readonly retryAfter?: number;

  constructor(
    code: AnalyticsErrorCode,
    message?: string,
    details?: unknown,
    retryAfter?: number
  ) {
    super(code, message, details);
    this.retryAfter = retryAfter;
  }
}

export class ValidationError extends AnalyticsError {
  public readonly fieldErrors?: Record<string, string[]>;

  constructor(
    code: AnalyticsErrorCode,
    message?: string,
    fieldErrors?: Record<string, string[]>
  ) {
    super(code, message, fieldErrors);
    this.fieldErrors = fieldErrors;
  }
}

export class PermissionError extends AnalyticsError {
  public readonly requiredRole?: string;
  public readonly requiredPermission?: string;

  constructor(
    code: AnalyticsErrorCode,
    message?: string,
    details?: { requiredRole?: string; requiredPermission?: string }
  ) {
    super(code, message, details);
    this.requiredRole = details?.requiredRole;
    this.requiredPermission = details?.requiredPermission;
  }
}

export class DataError extends AnalyticsError {
  constructor(code: AnalyticsErrorCode, message?: string, details?: unknown) {
    super(code, message, details);
  }
}

/**
 * Type guard to check if an error is an AnalyticsError
 */
export function isAnalyticsError(error: unknown): error is AnalyticsError {
  return error instanceof AnalyticsError;
}

/**
 * Convert unknown error to AnalyticsError
 */
export function toAnalyticsError(error: unknown): AnalyticsError {
  if (isAnalyticsError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AnalyticsError(
      AnalyticsErrorCode.ANALYTICS_SERVICE_UNAVAILABLE,
      error.message,
      { originalError: error.name, stack: error.stack },
      false
    );
  }

  return new AnalyticsError(
    AnalyticsErrorCode.ANALYTICS_SERVICE_UNAVAILABLE,
    'An unexpected error occurred',
    { originalError: String(error) },
    false
  );
}

/**
 * Get error code from string
 */
export function getErrorCode(code: string): AnalyticsErrorCode | undefined {
  return Object.values(AnalyticsErrorCode).find((c) => c === code);
}

/**
 * Get default message for error code
 */
export function getDefaultMessage(code: AnalyticsErrorCode): string {
  return ERROR_MESSAGES[code];
}

/**
 * Get HTTP status code for error code
 */
export function getStatusCode(code: AnalyticsErrorCode): number {
  return ERROR_STATUS_CODES[code];
}
