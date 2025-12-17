import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain, body, param, query } from 'express-validator';
import { ValidationError } from '../utils/errors';

export function validate(validations: ValidationChain[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      next();
      return;
    }

    const errorMessages = errors.array().map(err => {
      if ('path' in err) {
        return `${err.path}: ${err.msg}`;
      }
      return err.msg;
    });

    next(new ValidationError(errorMessages.join(', ')));
  };
}

export const itemValidation = {
  create: [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
    body('description').optional().isString(),
    body('category').optional().isString(),
    body('imageUrl').optional().isURL().withMessage('Image URL must be a valid URL'),
    body('metadata').optional().isObject(),
    body('isActive').optional().isBoolean(),
  ],
  update: [
    param('id').isUUID().withMessage('Invalid item ID'),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
    body('description').optional().isString(),
    body('category').optional().isString(),
    body('imageUrl').optional().isURL().withMessage('Image URL must be a valid URL'),
    body('metadata').optional().isObject(),
    body('isActive').optional().isBoolean(),
  ],
  getById: [
    param('id').isUUID().withMessage('Invalid item ID'),
  ],
  search: [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('query').optional().isString(),
    query('category').optional().isString(),
    query('minPrice').optional().isFloat({ min: 0 }).toFloat(),
    query('maxPrice').optional().isFloat({ min: 0 }).toFloat(),
    query('isActive').optional().isBoolean().toBoolean(),
  ],
};

export const bundleValidation = {
  create: [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('discountType').isIn(['percentage', 'fixed']).withMessage('Discount type must be "percentage" or "fixed"'),
    body('discountValue').isFloat({ min: 0 }).withMessage('Discount value must be a non-negative number'),
    body('description').optional().isString(),
    body('isActive').optional().isBoolean(),
    body('items').isArray({ min: 1 }).withMessage('Bundle must contain at least one item'),
    body('items.*.itemId').isUUID().withMessage('Invalid item ID in bundle'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Item quantity must be at least 1'),
  ],
  update: [
    param('id').isUUID().withMessage('Invalid bundle ID'),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('discountType').optional().isIn(['percentage', 'fixed']).withMessage('Discount type must be "percentage" or "fixed"'),
    body('discountValue').optional().isFloat({ min: 0 }).withMessage('Discount value must be a non-negative number'),
    body('description').optional().isString(),
    body('isActive').optional().isBoolean(),
    body('items').optional().isArray({ min: 1 }).withMessage('Bundle must contain at least one item'),
    body('items.*.itemId').optional().isUUID().withMessage('Invalid item ID in bundle'),
    body('items.*.quantity').optional().isInt({ min: 1 }).withMessage('Item quantity must be at least 1'),
  ],
  getById: [
    param('id').isUUID().withMessage('Invalid bundle ID'),
  ],
  list: [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
};

export const inventoryValidation = {
  create: [
    body('itemId').isUUID().withMessage('Invalid item ID'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
    body('lowStockThreshold').optional().isInt({ min: 0 }).withMessage('Low stock threshold must be a non-negative integer'),
  ],
  update: [
    param('itemId').isUUID().withMessage('Invalid item ID'),
    body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
    body('lowStockThreshold').optional().isInt({ min: 0 }).withMessage('Low stock threshold must be a non-negative integer'),
  ],
  getByItemId: [
    param('itemId').isUUID().withMessage('Invalid item ID'),
  ],
  reserve: [
    param('itemId').isUUID().withMessage('Invalid item ID'),
    body('quantity').isInt({ min: 1 }).withMessage('Reserve quantity must be a positive integer'),
    body('reason').optional().isString(),
  ],
  release: [
    param('itemId').isUUID().withMessage('Invalid item ID'),
    body('quantity').isInt({ min: 1 }).withMessage('Release quantity must be a positive integer'),
    body('reason').optional().isString(),
  ],
  list: [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  history: [
    param('itemId').isUUID().withMessage('Invalid item ID'),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
};
