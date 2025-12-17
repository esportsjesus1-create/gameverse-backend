import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import {
  CreateAchievementSchema,
  UpdateAchievementSchema
} from '../types/achievement.types.js';
import {
  getAllAchievements,
  getAchievementById,
  getAchievementsByCategory,
  createAchievement,
  updateAchievement,
  deleteAchievement
} from '../controllers/achievement.controller.js';

const router = Router();

router.get('/', getAllAchievements);

router.get('/category/:category', getAchievementsByCategory);

router.get('/:id', getAchievementById);

router.post('/', validateBody(CreateAchievementSchema), createAchievement);

router.put('/:id', validateBody(UpdateAchievementSchema), updateAchievement);

router.delete('/:id', deleteAchievement);

export default router;
