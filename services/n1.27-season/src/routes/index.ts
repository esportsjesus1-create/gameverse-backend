import { Router } from 'express';
import seasonRoutes from './season.routes';
import playerRoutes from './player.routes';
import leaderboardRoutes from './leaderboard.routes';

const router = Router();

router.use('/seasons', seasonRoutes);
router.use('/players', playerRoutes);
router.use('/leaderboard', leaderboardRoutes);

export default router;
