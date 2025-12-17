import { Router } from 'express';
import questRoutes from './quest.routes';
import userQuestRoutes from './user-quest.routes';
import healthRoutes from './health.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/quests', questRoutes);
router.use('/users', userQuestRoutes);

export default router;
