import { Request, Response, NextFunction } from 'express';
import { seasonService } from '../services';
import { ApiResponse, LeaderboardEntry, PaginatedResponse, RankedTier, TierLeaderboard } from '../types';

export class LeaderboardController {
  public async getLeaderboard(
    req: Request<{ seasonId: string }, object, object, { page?: string; limit?: string }>,
    res: Response<ApiResponse<PaginatedResponse<LeaderboardEntry>>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);

      const leaderboard = await seasonService.getLeaderboard(
        req.params.seasonId,
        page,
        limit
      );
      res.json({
        success: true,
        data: leaderboard,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getTierLeaderboard(
    req: Request<{ seasonId: string; tier: string }, object, object, { page?: string; limit?: string }>,
    res: Response<ApiResponse<TierLeaderboard>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
      const tier = req.params.tier as RankedTier;

      const leaderboard = await seasonService.getTierLeaderboard(
        req.params.seasonId,
        tier,
        page,
        limit
      );
      res.json({
        success: true,
        data: leaderboard,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getTopPlayersByTier(
    req: Request<{ seasonId: string }, object, object, { limit?: string }>,
    res: Response<ApiResponse<Record<RankedTier, LeaderboardEntry[]>>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);

      const topPlayers = await seasonService.getTopPlayersByTier(
        req.params.seasonId,
        limit
      );
      res.json({
        success: true,
        data: topPlayers,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const leaderboardController = new LeaderboardController();
