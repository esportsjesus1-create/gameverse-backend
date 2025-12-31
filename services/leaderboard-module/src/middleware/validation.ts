import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors';

export const validate = <T>(schema: ZodSchema<T>, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
      const result = schema.safeParse(data);

      if (!result.success) {
        const errors: Record<string, string[]> = {};
        for (const issue of result.error.issues) {
          const path = issue.path.join('.') || 'root';
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(issue.message);
        }
        throw new ValidationError('Validation failed', errors);
      }

      if (source === 'body') {
        req.body = result.data;
      } else if (source === 'query') {
        (req as Request & { validatedQuery: T }).validatedQuery = result.data;
      } else {
        (req as Request & { validatedParams: T }).validatedParams = result.data;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const validateBody = <T>(schema: ZodSchema<T>) => validate(schema, 'body');
export const validateQuery = <T>(schema: ZodSchema<T>) => validate(schema, 'query');
export const validateParams = <T>(schema: ZodSchema<T>) => validate(schema, 'params');

export default validate;
