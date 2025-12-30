import { Router } from 'express';
import { rewardsController } from '../controllers';
import { validate } from '../middleware/validation';
import { body, param, query } from 'express-validator';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

const seasonIdValidation = [
  param('seasonId').isUUID().withMessage('Invalid season ID format'),
];

const playerIdValidation = [
  param('playerId').isUUID().withMessage('Invalid player ID format'),
];

const tierValidation = [
  param('tier')
    .isIn(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'])
    .withMessage('Invalid tier'),
];

const createRewardValidation = [
  body('seasonId').isUUID().withMessage('Invalid season ID format'),
  body('tier')
    .isIn(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'])
    .withMessage('Invalid tier'),
  body('rewardType')
    .isIn(['CURRENCY', 'SKIN', 'BORDER', 'ICON', 'EMOTE', 'TITLE', 'CHEST'])
    .withMessage('Invalid reward type'),
  body('rewardId').isString().notEmpty().withMessage('Reward ID is required'),
  body('rewardName').isString().notEmpty().withMessage('Reward name is required'),
  body('rewardDescription').isString().notEmpty().withMessage('Reward description is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('isExclusive').optional().isBoolean().withMessage('isExclusive must be a boolean'),
];

const optionalSeasonIdValidation = [
  query('seasonId').optional().isUUID().withMessage('Invalid season ID format'),
];

router.post(
  '/',
  validate(createRewardValidation),
  asyncHandler(rewardsController.createSeasonReward.bind(rewardsController))
);

router.get(
  '/season/:seasonId',
  validate(seasonIdValidation),
  asyncHandler(rewardsController.getSeasonRewards.bind(rewardsController))
);

router.get(
  '/season/:seasonId/tier/:tier',
  validate([...seasonIdValidation, ...tierValidation]),
  asyncHandler(rewardsController.getRewardsForTier.bind(rewardsController))
);

router.post(
  '/season/:seasonId/distribute',
  validate(seasonIdValidation),
  asyncHandler(rewardsController.distributeSeasonRewards.bind(rewardsController))
);

router.post(
  '/season/:seasonId/setup-defaults',
  validate(seasonIdValidation),
  asyncHandler(rewardsController.setupDefaultRewards.bind(rewardsController))
);

router.get(
  '/player/:playerId',
  validate([...playerIdValidation, ...optionalSeasonIdValidation]),
  asyncHandler(rewardsController.getPlayerRewards.bind(rewardsController))
);

router.get(
  '/player/:playerId/unclaimed',
  validate(playerIdValidation),
  asyncHandler(rewardsController.getUnclaimedRewards.bind(rewardsController))
);

router.post(
  '/player/:playerId/claim/:rewardId',
  validate([...playerIdValidation, param('rewardId').isString().notEmpty().withMessage('Reward ID is required')]),
  asyncHandler(rewardsController.claimReward.bind(rewardsController))
);

export default router;
