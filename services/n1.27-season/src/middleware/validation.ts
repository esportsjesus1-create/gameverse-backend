import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ValidationError } from '../utils/errors';

export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      next();
      return;
    }

    const errorMap: Record<string, string[]> = {};
    errors.array().forEach((error) => {
      if ('path' in error) {
        const field = error.path;
        if (!errorMap[field]) {
          errorMap[field] = [];
        }
        errorMap[field].push(error.msg as string);
      }
    });

    next(new ValidationError('Validation failed', errorMap));
  };
};
