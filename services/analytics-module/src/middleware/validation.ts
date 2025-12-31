/**
 * GameVerse Analytics Module - Validation Middleware
 * Zod-based validation with input sanitization
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger, LogEventType } from '../utils/logger';
import { ValidationError, AnalyticsErrorCode } from '../utils/errors';
import { AuthenticatedRequest } from './rbac';

/**
 * Validation source types
 */
export type ValidationSource = 'body' | 'query' | 'params';

/**
 * Validation options
 */
export interface ValidationOptions {
  stripUnknown?: boolean;
  sanitize?: boolean;
}

/**
 * Sanitize string input to prevent XSS and injection attacks
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return input;
  }

  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // Remove potential script injections
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    // Trim whitespace
    .trim();
}

/**
 * Recursively sanitize an object
 */
export function sanitizeObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Format Zod errors into field errors
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    const field = path || '_root';

    if (!fieldErrors[field]) {
      fieldErrors[field] = [];
    }

    fieldErrors[field].push(issue.message);
  }

  return fieldErrors;
}

/**
 * Validation middleware factory
 */
export function validate<T>(
  schema: ZodSchema<T>,
  source: ValidationSource = 'body',
  options: ValidationOptions = {}
) {
  const { sanitize = true } = options;

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      let data: unknown;

      switch (source) {
        case 'body':
          data = req.body;
          break;
        case 'query':
          data = req.query;
          break;
        case 'params':
          data = req.params;
          break;
        default:
          data = req.body;
      }

      // Sanitize input if enabled
      if (sanitize) {
        data = sanitizeObject(data);
        logger.logSecurity(LogEventType.INPUT_SANITIZED, 'Input sanitized', {
          source,
          path: req.path,
        });
      }

      // Parse and validate
      const result = schema.safeParse(data);

      if (!result.success) {
        const fieldErrors = formatZodErrors(result.error);
        const error = new ValidationError(
          AnalyticsErrorCode.VALIDATION_SCHEMA_FAILED,
          'Validation failed',
          fieldErrors
        );

        logger.warn(LogEventType.QUERY_FAILED, 'Validation failed', {
          source,
          path: req.path,
          errors: fieldErrors,
        });

        res.status(error.statusCode).json(error.toResponse(req.requestId, req.path));
        return;
      }

      // Attach validated data to request
      switch (source) {
        case 'body':
          req.body = result.data;
          break;
        case 'query':
          (req as Request & { validatedQuery: T }).validatedQuery = result.data;
          break;
        case 'params':
          (req as Request & { validatedParams: T }).validatedParams = result.data;
          break;
      }

      next();
    } catch (err) {
      const error = new ValidationError(
        AnalyticsErrorCode.VALIDATION_SCHEMA_FAILED,
        'Validation error occurred',
        { _error: [String(err)] }
      );

      logger.error(LogEventType.QUERY_FAILED, 'Validation error', err as Error, {
        source,
        path: req.path,
      });

      res.status(error.statusCode).json(error.toResponse(req.requestId, req.path));
    }
  };
}

/**
 * Validate multiple sources at once
 */
export function validateMultiple(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}, options: ValidationOptions = {}) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const { sanitize = true } = options;
    const errors: Record<string, Record<string, string[]>> = {};

    // Sanitize all inputs if enabled
    if (sanitize) {
      if (schemas.body) {
        req.body = sanitizeObject(req.body);
      }
      if (schemas.query) {
        req.query = sanitizeObject(req.query) as typeof req.query;
      }
      if (schemas.params) {
        req.params = sanitizeObject(req.params) as typeof req.params;
      }
    }

    // Validate body
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.body = formatZodErrors(result.error);
      } else {
        req.body = result.data;
      }
    }

    // Validate query
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.query = formatZodErrors(result.error);
      } else {
        (req as Request & { validatedQuery: unknown }).validatedQuery = result.data;
      }
    }

    // Validate params
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.params = formatZodErrors(result.error);
      } else {
        (req as Request & { validatedParams: unknown }).validatedParams = result.data;
      }
    }

    // Check for errors
    if (Object.keys(errors).length > 0) {
      // Flatten errors into a single Record<string, string[]>
      const flattenedErrors: Record<string, string[]> = {};
      for (const [source, sourceErrors] of Object.entries(errors)) {
        for (const [field, messages] of Object.entries(sourceErrors)) {
          flattenedErrors[`${source}.${field}`] = messages;
        }
      }
      const error = new ValidationError(
        AnalyticsErrorCode.VALIDATION_SCHEMA_FAILED,
        'Validation failed',
        flattenedErrors
      );

      logger.warn(LogEventType.QUERY_FAILED, 'Multiple validation failures', {
        path: req.path,
        errors,
      });

      res.status(error.statusCode).json(error.toResponse(req.requestId, req.path));
      return;
    }

    next();
  };
}

/**
 * Validate request ID header
 */
export function validateRequestId(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const requestId = req.headers['x-request-id'] as string;

  if (requestId) {
    req.requestId = sanitizeString(requestId);
  } else {
    req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  next();
}

/**
 * Check for required fields
 */
export function requireFields(...fields: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const missingFields: string[] = [];

    for (const field of fields) {
      const value = req.body[field];
      if (value === undefined || value === null || value === '') {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      const fieldErrors: Record<string, string[]> = {};
      for (const field of missingFields) {
        fieldErrors[field] = ['This field is required'];
      }

      const error = new ValidationError(
        AnalyticsErrorCode.VALIDATION_REQUIRED_FIELD,
        `Missing required fields: ${missingFields.join(', ')}`,
        fieldErrors
      );

      res.status(error.statusCode).json(error.toResponse(req.requestId, req.path));
      return;
    }

    next();
  };
}

export default {
  validate,
  validateMultiple,
  validateRequestId,
  requireFields,
  sanitizeString,
  sanitizeObject,
};
