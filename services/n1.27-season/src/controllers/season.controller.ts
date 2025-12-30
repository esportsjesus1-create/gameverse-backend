import { Request, Response, NextFunction } from 'express';
import { seasonService } from '../services';
import { ApiResponse, Season, CreateSeasonDTO } from '../types';

export class SeasonController {
  public async createSeason(
    req: Request<object, ApiResponse<Season>, CreateSeasonDTO>,
    res: Response<ApiResponse<Season>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const season = await seasonService.createSeason(req.body);
      res.status(201).json({
        success: true,
        data: season,
        message: 'Season created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  public async getActiveSeason(
    _req: Request,
    res: Response<ApiResponse<Season | null>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const season = await seasonService.getActiveSeason();
      res.json({
        success: true,
        data: season,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getSeasonById(
    req: Request<{ seasonId: string }>,
    res: Response<ApiResponse<Season>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const season = await seasonService.getSeasonById(req.params.seasonId);
      res.json({
        success: true,
        data: season,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getSeasonByNumber(
    req: Request<{ number: string }>,
    res: Response<ApiResponse<Season>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const season = await seasonService.getSeasonByNumber(parseInt(req.params.number, 10));
      res.json({
        success: true,
        data: season,
      });
    } catch (error) {
      next(error);
    }
  }

  public async endSeason(
    req: Request<{ seasonId: string }>,
    res: Response<ApiResponse<Season>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const season = await seasonService.endSeason(req.params.seasonId);
      res.json({
        success: true,
        data: season,
        message: 'Season ended successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  public async performSoftReset(
    req: Request<{ seasonId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const results = await seasonService.performSoftReset(req.params.seasonId);
      res.json({
        success: true,
        data: results,
        message: `Soft reset calculated for ${results.length} players`,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const seasonController = new SeasonController();
