import { Router } from 'express';
import * as leaderboardController from '../controllers/leaderboardController';

const router = Router();

router.post('/scores', leaderboardController.submitScore);

router.get('/:gameId', leaderboardController.getLeaderboard);

router.get('/:gameId/player/:playerId', leaderboardController.getPlayerRank);

router.get('/:gameId/player/:playerId/nearby', leaderboardController.getPlayersAroundPlayer);

router.post('/:gameId/decay', leaderboardController.applyDecay);

router.post('/:gameId/sync', leaderboardController.syncLeaderboard);

export default router;
