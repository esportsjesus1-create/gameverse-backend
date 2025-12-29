import { Router } from 'express';
import seasonRoutes from './season.routes';
import playerRoutes from './player.routes';
import leaderboardRoutes from './leaderboard.routes';
import rewardsRoutes from './rewards.routes';
import progressionRoutes from './progression.routes';

const router = Router();

router.use('/seasons', seasonRoutes);
router.use('/players', playerRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/rewards', rewardsRoutes);
router.use('/progression', progressionRoutes);

export default router;
