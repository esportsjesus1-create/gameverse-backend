import { Router } from 'express';
import { userQuestController } from '../controllers/user-quest.controller';
import { rewardController } from '../controllers/reward.controller';
import { validate } from '../middleware/validate';
import { updateProgressSchema, paginationSchema, uuidSchema } from '../utils/validation';
import { z } from 'zod';

const router = Router();

const userIdParam = z.object({ userId: z.string().min(1) });
const userQuestParams = z.object({ userId: z.string().min(1), questId: uuidSchema });

router.get(
  '/:userId/quests',
  validate(userIdParam, 'params'),
  validate(paginationSchema, 'query'),
  userQuestController.getUserQuests.bind(userQuestController)
);

router.get(
  '/:userId/quests/active',
  validate(userIdParam, 'params'),
  userQuestController.getActiveUserQuests.bind(userQuestController)
);

router.get(
  '/:userId/quests/:questId',
  validate(userQuestParams, 'params'),
  userQuestController.getUserQuestByQuestId.bind(userQuestController)
);

router.post(
  '/:userId/quests/:questId/accept',
  validate(userQuestParams, 'params'),
  userQuestController.acceptQuest.bind(userQuestController)
);

router.post(
  '/:userId/quests/:questId/progress',
  validate(userQuestParams, 'params'),
  validate(updateProgressSchema),
  userQuestController.updateProgress.bind(userQuestController)
);

router.post(
  '/:userId/quests/:questId/claim',
  validate(userQuestParams, 'params'),
  rewardController.claimRewards.bind(rewardController)
);

router.get(
  '/:userId/rewards',
  validate(userIdParam, 'params'),
  validate(paginationSchema, 'query'),
  rewardController.getUserRewards.bind(rewardController)
);

router.get(
  '/:userId/rewards/recent',
  validate(userIdParam, 'params'),
  rewardController.getRecentRewards.bind(rewardController)
);

router.get(
  '/:userId/rewards/summary',
  validate(userIdParam, 'params'),
  rewardController.getRewardSummary.bind(rewardController)
);

router.get(
  '/:userId/rewards/quest/:questId',
  validate(userQuestParams, 'params'),
  rewardController.getRewardsByQuestId.bind(rewardController)
);

export default router;
