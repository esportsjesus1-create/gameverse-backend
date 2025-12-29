import { Router } from 'express';
import { progressionController } from '../controllers';
import { validate } from '../middleware/validation';
import { param, query } from 'express-validator';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

const playerSeasonValidation = [
  param('playerId').isUUID().withMessage('Invalid player ID format'),
  param('seasonId').isUUID().withMessage('Invalid season ID format'),
];

const playerIdValidation = [
  param('playerId').isUUID().withMessage('Invalid player ID format'),
];

const seasonIdValidation = [
  param('seasonId').isUUID().withMessage('Invalid season ID format'),
];

const daysValidation = [
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365'),
];

const optionalSeasonIdValidation = [
  query('seasonId').optional().isUUID().withMessage('Invalid season ID format'),
];

router.get(
  '/player/:playerId/season/:seasonId',
  validate([...playerSeasonValidation, ...daysValidation]),
  asyncHandler(progressionController.getPlayerProgression.bind(progressionController))
);

router.get(
  '/milestones/:playerId',
  validate([...playerIdValidation, ...optionalSeasonIdValidation]),
  asyncHandler(progressionController.getPlayerMilestones.bind(progressionController))
);

router.get(
  '/stats/:playerId/season/:seasonId',
  validate(playerSeasonValidation),
  asyncHandler(progressionController.getPlayerStats.bind(progressionController))
);

router.get(
  '/summary/:seasonId',
  validate(seasonIdValidation),
  asyncHandler(progressionController.getSeasonSummary.bind(progressionController))
);

export default router;
