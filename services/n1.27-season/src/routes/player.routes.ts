import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { playerController } from '../controllers';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

const playerSeasonValidation = [
  param('playerId').isUUID().withMessage('Player ID must be a valid UUID'),
  param('seasonId').isUUID().withMessage('Season ID must be a valid UUID'),
];

const updateMMRValidation = [
  body('playerId').isUUID().withMessage('Player ID must be a valid UUID'),
  body('opponentId').isUUID().withMessage('Opponent ID must be a valid UUID'),
  body('isWin').isBoolean().withMessage('isWin must be a boolean'),
  body('gameMode').optional().isString().withMessage('Game mode must be a string'),
];

const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
];

router.get(
  '/:playerId/season/:seasonId/rank',
  validate(playerSeasonValidation),
  asyncHandler(playerController.getPlayerRank.bind(playerController))
);

router.get(
  '/:playerId/season/:seasonId',
  validate(playerSeasonValidation),
  asyncHandler(playerController.getPlayerSeasonData.bind(playerController))
);

router.get(
  '/:playerId/season/:seasonId/history',
  validate([...playerSeasonValidation, ...paginationValidation]),
  asyncHandler(playerController.getMatchHistory.bind(playerController))
);

router.post('/mmr', validate(updateMMRValidation), asyncHandler(playerController.updateMMR.bind(playerController)));

export default router;
