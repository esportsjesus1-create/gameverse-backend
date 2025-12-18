import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';

export function validateBody(requiredFields: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const field of requiredFields) {
      if (req.body[field] === undefined || req.body[field] === null) {
        errors.push(`${field} is required`);
      }
    }

    if (errors.length > 0) {
      next(new ValidationError('Validation failed', errors));
      return;
    }

    next();
  };
}

export function validateParams(requiredParams: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const param of requiredParams) {
      if (!req.params[param]) {
        errors.push(`${param} parameter is required`);
      }
    }

    if (errors.length > 0) {
      next(new ValidationError('Validation failed', errors));
      return;
    }

    next();
  };
}

export function validateQuery(requiredQuery: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const query of requiredQuery) {
      if (!req.query[query]) {
        errors.push(`${query} query parameter is required`);
      }
    }

    if (errors.length > 0) {
      next(new ValidationError('Validation failed', errors));
      return;
    }

    next();
  };
}

export function validateUUID(paramName: string) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return (req: Request, _res: Response, next: NextFunction): void => {
    const value = req.params[paramName];

    if (value && !uuidRegex.test(value)) {
      next(new ValidationError(`Invalid ${paramName} format`));
      return;
    }

    next();
  };
}
