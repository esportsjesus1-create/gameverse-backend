import { Router } from 'express';
import { param, query } from 'express-validator';
import { leaderboardController } from '../controllers';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

const leaderboardValidation = [
  param('seasonId').isUUID().withMessage('Season ID must be a valid UUID'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
];

router.get(
  '/:seasonId',
  validate(leaderboardValidation),
  asyncHandler(leaderboardController.getLeaderboard.bind(leaderboardController))
);

export default router;
