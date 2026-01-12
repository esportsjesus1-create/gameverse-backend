import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ValidationError } from '../utils/errors';

export function validateRequest(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMap: Record<string, string[]> = {};
    
    errors.array().forEach(error => {
      const field = 'path' in error ? error.path : 'unknown';
      if (!errorMap[field]) {
        errorMap[field] = [];
      }
      errorMap[field].push(error.msg as string);
    });
    
    throw new ValidationError(errorMap);
  }
  
  next();
}
