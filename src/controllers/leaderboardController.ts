import { Request, Response } from 'express';
import * as leaderboardService from '../services/leaderboardService';
import * as playerService from '../services/playerService';

export const submitScore = async (req: Request, res: Response): Promise<void> => {
  try {
    const { playerId, gameId, score } = req.body;

    if (!playerId || !gameId || score === undefined) {
      res.status(400).json({
        error: 'Missing required fields: playerId, gameId, and score are required',
      });
      return;
    }

    if (typeof score !== 'number' || score < 0) {
      res.status(400).json({
        error: 'Score must be a non-negative number',
      });
      return;
    }

    const player = await playerService.getPlayerById(playerId);
    if (!player) {
      res.status(404).json({
        error: 'Player not found',
      });
      return;
    }

    const result = await leaderboardService.submitScore(playerId, gameId, score);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error submitting score:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

export const getLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 10, 100);

    if (!gameId) {
      res.status(400).json({
        error: 'gameId is required',
      });
      return;
    }

    if (page < 1) {
      res.status(400).json({
        error: 'Page must be a positive integer',
      });
      return;
    }

    const leaderboard = await leaderboardService.getLeaderboard(gameId, page, pageSize);
    res.status(200).json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

export const getPlayerRank = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId, playerId } = req.params;

    if (!gameId || !playerId) {
      res.status(400).json({
        error: 'gameId and playerId are required',
      });
      return;
    }

    const rankInfo = await leaderboardService.getPlayerRank(gameId, playerId);
    if (!rankInfo) {
      res.status(404).json({
        error: 'Player not found in leaderboard',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: rankInfo,
    });
  } catch (error) {
    console.error('Error getting player rank:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

export const getPlayersAroundPlayer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId, playerId } = req.params;
    const range = parseInt(req.query.range as string) || 5;

    if (!gameId || !playerId) {
      res.status(400).json({
        error: 'gameId and playerId are required',
      });
      return;
    }

    const nearbyPlayers = await leaderboardService.getPlayersAroundPlayer(
      gameId,
      playerId,
      Math.min(range, 50)
    );

    res.status(200).json({
      success: true,
      data: nearbyPlayers,
    });
  } catch (error) {
    console.error('Error getting players around player:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

export const applyDecay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;

    if (!gameId) {
      res.status(400).json({
        error: 'gameId is required',
      });
      return;
    }

    const updatedCount = await leaderboardService.applyDecayToAllScores(gameId);
    res.status(200).json({
      success: true,
      message: `Decay applied to ${updatedCount} scores`,
      updatedCount,
    });
  } catch (error) {
    console.error('Error applying decay:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};

export const syncLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;

    if (!gameId) {
      res.status(400).json({
        error: 'gameId is required',
      });
      return;
    }

    const syncedCount = await leaderboardService.syncLeaderboardFromPostgres(gameId);
    res.status(200).json({
      success: true,
      message: `Synced ${syncedCount} scores to Redis`,
      syncedCount,
    });
  } catch (error) {
    console.error('Error syncing leaderboard:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};
