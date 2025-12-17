import { Request, Response, NextFunction } from 'express';
import { seasonService } from '../services';
import { ApiResponse, LeaderboardEntry, PaginatedResponse } from '../types';

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
}

export const leaderboardController = new LeaderboardController();
