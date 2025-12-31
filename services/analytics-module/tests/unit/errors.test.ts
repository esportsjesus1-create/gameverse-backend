/**
 * GameVerse Analytics Module - Error Handling Tests
 * Comprehensive tests for custom error handling system
 */

import {
  AnalyticsError,
  AnalyticsErrorCode,
  MetricsError,
  EventTrackingError,
  QueryError,
  AggregationError,
  CacheError,
  RateLimitError,
  ValidationError,
  PermissionError,
  DataError,
  isAnalyticsError,
  toAnalyticsError,
  getErrorCode,
  getDefaultMessage,
  getStatusCode,
} from '../../src/utils/errors';

describe('AnalyticsError', () => {
  describe('constructor', () => {
    it('should create an error with default message', () => {
      const error = new AnalyticsError(AnalyticsErrorCode.ANALYTICS_SERVICE_UNAVAILABLE);
      
      expect(error.code).toBe(AnalyticsErrorCode.ANALYTICS_SERVICE_UNAVAILABLE);
      expect(error.message).toBe('Analytics service is temporarily unavailable');
      expect(error.statusCode).toBe(503);
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should create an error with custom message', () => {
      const error = new AnalyticsError(
        AnalyticsErrorCode.METRICS_NOT_FOUND,
        'Custom metric error message'
      );
      
      expect(error.message).toBe('Custom metric error message');
      expect(error.statusCode).toBe(404);
    });

    it('should create an error with details', () => {
      const details = { metricId: '123', reason: 'not found' };
      const error = new AnalyticsError(
        AnalyticsErrorCode.METRICS_NOT_FOUND,
        'Metric not found',
        details
      );
      
      expect(error.details).toEqual(details);
    });

    it('should create a non-operational error', () => {
      const error = new AnalyticsError(
        AnalyticsErrorCode.ANALYTICS_INITIALIZATION_FAILED,
        'Init failed',
        undefined,
        false
      );
      
      expect(error.isOperational).toBe(false);
    });
  });

  describe('toResponse', () => {
    it('should generate a proper error response', () => {
      const error = new AnalyticsError(
        AnalyticsErrorCode.QUERY_TIMEOUT,
        'Query timed out',
        { queryId: 'q123' }
      );
      
      const response = error.toResponse('req-123', '/api/v1/queries');
      
      expect(response.success).toBe(false);
      expect(response.error.code).toBe(AnalyticsErrorCode.QUERY_TIMEOUT);
      expect(response.error.message).toBe('Query timed out');
      expect(response.error.details).toEqual({ queryId: 'q123' });
      expect(response.error.requestId).toBe('req-123');
      expect(response.error.path).toBe('/api/v1/queries');
      expect(response.error.timestamp).toBeDefined();
    });
  });
});

describe('Specialized Error Classes', () => {
  describe('MetricsError', () => {
    it('should create a metrics-specific error', () => {
      const error = new MetricsError(
        AnalyticsErrorCode.METRICS_INVALID_VALUE,
        'Invalid metric value'
      );
      
      expect(error).toBeInstanceOf(AnalyticsError);
      expect(error.code).toBe(AnalyticsErrorCode.METRICS_INVALID_VALUE);
      expect(error.statusCode).toBe(400);
    });
  });

  describe('EventTrackingError', () => {
    it('should create an event tracking error', () => {
      const error = new EventTrackingError(
        AnalyticsErrorCode.EVENT_QUEUE_FULL,
        'Event queue is full'
      );
      
      expect(error).toBeInstanceOf(AnalyticsError);
      expect(error.code).toBe(AnalyticsErrorCode.EVENT_QUEUE_FULL);
      expect(error.statusCode).toBe(503);
    });
  });

  describe('QueryError', () => {
    it('should create a query error', () => {
      const error = new QueryError(
        AnalyticsErrorCode.QUERY_INVALID_SYNTAX,
        'Invalid query syntax'
      );
      
      expect(error).toBeInstanceOf(AnalyticsError);
      expect(error.code).toBe(AnalyticsErrorCode.QUERY_INVALID_SYNTAX);
      expect(error.statusCode).toBe(400);
    });
  });

  describe('AggregationError', () => {
    it('should create an aggregation error', () => {
      const error = new AggregationError(
        AnalyticsErrorCode.AGGREGATION_COMPUTATION_FAILED,
        'Aggregation failed'
      );
      
      expect(error).toBeInstanceOf(AnalyticsError);
      expect(error.code).toBe(AnalyticsErrorCode.AGGREGATION_COMPUTATION_FAILED);
      expect(error.statusCode).toBe(500);
    });
  });

  describe('CacheError', () => {
    it('should create a cache error', () => {
      const error = new CacheError(
        AnalyticsErrorCode.CACHE_CONNECTION_FAILED,
        'Cache connection failed'
      );
      
      expect(error).toBeInstanceOf(AnalyticsError);
      expect(error.code).toBe(AnalyticsErrorCode.CACHE_CONNECTION_FAILED);
      expect(error.statusCode).toBe(503);
    });
  });

  describe('RateLimitError', () => {
    it('should create a rate limit error with retry after', () => {
      const error = new RateLimitError(
        AnalyticsErrorCode.RATE_LIMIT_EXCEEDED_BASIC,
        'Rate limit exceeded',
        { tier: 'BASIC' },
        60
      );
      
      expect(error).toBeInstanceOf(AnalyticsError);
      expect(error.code).toBe(AnalyticsErrorCode.RATE_LIMIT_EXCEEDED_BASIC);
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error with field errors', () => {
      const fieldErrors = {
        name: ['Name is required'],
        value: ['Value must be a number'],
      };
      const error = new ValidationError(
        AnalyticsErrorCode.VALIDATION_SCHEMA_FAILED,
        'Validation failed',
        fieldErrors
      );
      
      expect(error).toBeInstanceOf(AnalyticsError);
      expect(error.code).toBe(AnalyticsErrorCode.VALIDATION_SCHEMA_FAILED);
      expect(error.statusCode).toBe(400);
      expect(error.fieldErrors).toEqual(fieldErrors);
    });
  });

  describe('PermissionError', () => {
    it('should create a permission error with required role', () => {
      const error = new PermissionError(
        AnalyticsErrorCode.PERMISSION_INSUFFICIENT_ROLE,
        'Insufficient permissions',
        { requiredRole: 'ADMIN', requiredPermission: 'METRICS_WRITE' }
      );
      
      expect(error).toBeInstanceOf(AnalyticsError);
      expect(error.code).toBe(AnalyticsErrorCode.PERMISSION_INSUFFICIENT_ROLE);
      expect(error.statusCode).toBe(403);
      expect(error.requiredRole).toBe('ADMIN');
      expect(error.requiredPermission).toBe('METRICS_WRITE');
    });
  });

  describe('DataError', () => {
    it('should create a data error', () => {
      const error = new DataError(
        AnalyticsErrorCode.DATA_INTEGRITY_VIOLATION,
        'Data integrity violation'
      );
      
      expect(error).toBeInstanceOf(AnalyticsError);
      expect(error.code).toBe(AnalyticsErrorCode.DATA_INTEGRITY_VIOLATION);
      expect(error.statusCode).toBe(500);
    });
  });
});

describe('Error Utility Functions', () => {
  describe('isAnalyticsError', () => {
    it('should return true for AnalyticsError instances', () => {
      const error = new AnalyticsError(AnalyticsErrorCode.ANALYTICS_SERVICE_UNAVAILABLE);
      expect(isAnalyticsError(error)).toBe(true);
    });

    it('should return true for specialized error instances', () => {
      const error = new MetricsError(AnalyticsErrorCode.METRICS_NOT_FOUND);
      expect(isAnalyticsError(error)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('Regular error');
      expect(isAnalyticsError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isAnalyticsError('string')).toBe(false);
      expect(isAnalyticsError(null)).toBe(false);
      expect(isAnalyticsError(undefined)).toBe(false);
      expect(isAnalyticsError({})).toBe(false);
    });
  });

  describe('toAnalyticsError', () => {
    it('should return the same error if already AnalyticsError', () => {
      const original = new AnalyticsError(AnalyticsErrorCode.METRICS_NOT_FOUND);
      const result = toAnalyticsError(original);
      expect(result).toBe(original);
    });

    it('should convert regular Error to AnalyticsError', () => {
      const original = new Error('Something went wrong');
      const result = toAnalyticsError(original);
      
      expect(result).toBeInstanceOf(AnalyticsError);
      expect(result.message).toBe('Something went wrong');
      expect(result.code).toBe(AnalyticsErrorCode.ANALYTICS_SERVICE_UNAVAILABLE);
      expect(result.isOperational).toBe(false);
    });

    it('should convert unknown values to AnalyticsError', () => {
      const result = toAnalyticsError('string error');
      
      expect(result).toBeInstanceOf(AnalyticsError);
      expect(result.code).toBe(AnalyticsErrorCode.ANALYTICS_SERVICE_UNAVAILABLE);
    });
  });

  describe('getErrorCode', () => {
    it('should return error code for valid code string', () => {
      const code = getErrorCode('ANALYTICS_1000');
      expect(code).toBe(AnalyticsErrorCode.ANALYTICS_INITIALIZATION_FAILED);
    });

    it('should return undefined for invalid code string', () => {
      const code = getErrorCode('INVALID_CODE');
      expect(code).toBeUndefined();
    });
  });

  describe('getDefaultMessage', () => {
    it('should return default message for error code', () => {
      const message = getDefaultMessage(AnalyticsErrorCode.METRICS_NOT_FOUND);
      expect(message).toBe('Metric not found');
    });
  });

  describe('getStatusCode', () => {
    it('should return HTTP status code for error code', () => {
      expect(getStatusCode(AnalyticsErrorCode.METRICS_NOT_FOUND)).toBe(404);
      expect(getStatusCode(AnalyticsErrorCode.VALIDATION_REQUIRED_FIELD)).toBe(400);
      expect(getStatusCode(AnalyticsErrorCode.PERMISSION_DENIED)).toBe(403);
      expect(getStatusCode(AnalyticsErrorCode.RATE_LIMIT_EXCEEDED_BASIC)).toBe(429);
      expect(getStatusCode(AnalyticsErrorCode.ANALYTICS_SERVICE_UNAVAILABLE)).toBe(503);
    });
  });
});

describe('Error Code Coverage', () => {
  it('should have 40+ unique error codes', () => {
    const errorCodes = Object.values(AnalyticsErrorCode);
    expect(errorCodes.length).toBeGreaterThanOrEqual(40);
  });

  it('should have status codes for all error codes', () => {
    const errorCodes = Object.values(AnalyticsErrorCode);
    errorCodes.forEach((code) => {
      const statusCode = getStatusCode(code);
      expect(statusCode).toBeGreaterThanOrEqual(400);
      expect(statusCode).toBeLessThan(600);
    });
  });

  it('should have default messages for all error codes', () => {
    const errorCodes = Object.values(AnalyticsErrorCode);
    errorCodes.forEach((code) => {
      const message = getDefaultMessage(code);
      expect(message).toBeDefined();
      expect(message.length).toBeGreaterThan(0);
    });
  });
});
