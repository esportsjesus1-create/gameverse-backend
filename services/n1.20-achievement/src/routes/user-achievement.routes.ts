import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { UpdateProgressSchema } from '../types/achievement.types.js';
import {
  getUserAchievements,
  getUserUnlockedAchievements,
  getUserAchievementProgress,
  updateUserProgress,
  getUserStats,
  checkAndUnlockAchievement
} from '../controllers/user-achievement.controller.js';

const router = Router();

router.get('/:userId/achievements', getUserAchievements);

router.get('/:userId/achievements/unlocked', getUserUnlockedAchievements);

router.get('/:userId/achievements/stats', getUserStats);

router.get('/:userId/achievements/:achievementId/progress', getUserAchievementProgress);

router.post(
  '/:userId/achievements/:achievementId/progress',
  validateBody(UpdateProgressSchema),
  updateUserProgress
);

router.post('/:userId/achievements/:achievementId/unlock', checkAndUnlockAchievement);

export default router;
