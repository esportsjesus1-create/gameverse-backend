import { Request, Response, NextFunction } from 'express';
import { seasonService } from '../services';
import { ApiResponse, PlayerRank, PlayerSeason, UpdateMMRDTO, MatchResult, PaginatedResponse } from '../types';

export class PlayerController {
  public async getPlayerRank(
    req: Request<{ playerId: string; seasonId: string }>,
    res: Response<ApiResponse<PlayerRank>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const rank = await seasonService.getPlayerRank(
        req.params.playerId,
        req.params.seasonId
      );
      res.json({
        success: true,
        data: rank,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getPlayerSeasonData(
    req: Request<{ playerId: string; seasonId: string }>,
    res: Response<ApiResponse<PlayerSeason>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const playerSeason = await seasonService.getOrCreatePlayerSeason(
        req.params.playerId,
        req.params.seasonId
      );
      res.json({
        success: true,
        data: playerSeason,
      });
    } catch (error) {
      next(error);
    }
  }

  public async updateMMR(
    req: Request<object, ApiResponse<{ player: PlayerSeason; opponent: PlayerSeason; matchResult: MatchResult }>, UpdateMMRDTO>,
    res: Response<ApiResponse<{ player: PlayerSeason; opponent: PlayerSeason; matchResult: MatchResult }>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await seasonService.updateMMR(req.body);
      res.json({
        success: true,
        data: result,
        message: 'MMR updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  public async getMatchHistory(
    req: Request<{ playerId: string; seasonId: string }, object, object, { page?: string; limit?: string }>,
    res: Response<ApiResponse<PaginatedResponse<MatchResult>>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '20', 10);

      const history = await seasonService.getPlayerMatchHistory(
        req.params.playerId,
        req.params.seasonId,
        page,
        limit
      );
      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const playerController = new PlayerController();
