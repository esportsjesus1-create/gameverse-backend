import { Router } from 'express';
import leaderboardRoutes from './leaderboard.routes';

const router = Router();

router.use('/leaderboard', leaderboardRoutes);

export default router;
