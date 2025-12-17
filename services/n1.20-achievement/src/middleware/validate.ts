import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError, formatZodError } from '../utils/errors.js';

type RequestLocation = 'body' | 'query' | 'params';

export function validate<T>(
  schema: ZodSchema<T>,
  location: RequestLocation = 'body'
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data: unknown = req[location];
      const parsed = schema.parse(data);
      (req as Record<string, unknown>)[location] = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = formatZodError(error);
        next(new ValidationError('Validation failed', errors));
      } else {
        next(error);
      }
    }
  };
}

export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return validate(schema, 'body');
}

export function validateQuery<T>(schema: ZodSchema<T>): RequestHandler {
  return validate(schema, 'query');
}

export function validateParams<T>(schema: ZodSchema<T>): RequestHandler {
  return validate(schema, 'params');
}
