import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';

export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      next();
      return;
    }

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: 'path' in err ? err.path : 'unknown',
        message: err.msg
      })),
      timestamp: new Date().toISOString()
    });
  };
};

export const createLobbyValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Lobby name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Lobby name must be between 1 and 100 characters'),
  body('gameType')
    .trim()
    .notEmpty()
    .withMessage('Game type is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Game type must be between 1 and 50 characters'),
  body('maxPlayers')
    .optional()
    .isInt({ min: 2, max: 100 })
    .withMessage('Max players must be between 2 and 100'),
  body('minPlayers')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Min players must be between 1 and 100'),
  body('countdownDuration')
    .optional()
    .isInt({ min: 1, max: 60 })
    .withMessage('Countdown duration must be between 1 and 60 seconds')
];

export const lobbyIdValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid lobby ID format')
];

export const joinLobbyValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid lobby ID format')
];

export const setReadyValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid lobby ID format'),
  body('ready')
    .isBoolean()
    .withMessage('Ready status must be a boolean')
];

export const listLobbiesValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['waiting', 'ready_check', 'countdown', 'in_game', 'closed'])
    .withMessage('Invalid status value'),
  query('gameType')
    .optional()
    .isString()
    .withMessage('Game type must be a string'),
  query('hasSpace')
    .optional()
    .isBoolean()
    .withMessage('hasSpace must be a boolean')
];
