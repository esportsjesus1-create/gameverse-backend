import { Router } from 'express';
import achievementRoutes from './achievement.routes.js';
import userAchievementRoutes from './user-achievement.routes.js';
import notificationRoutes from './notification.routes.js';
import healthRoutes from './health.routes.js';

const router = Router();

router.use('/health', healthRoutes);

router.use('/achievements', achievementRoutes);

router.use('/users', userAchievementRoutes);

router.use('/users', notificationRoutes);

export default router;
