import { Request, Response } from 'express';
import { progressionService } from '../services';

export class ProgressionController {
  public async getPlayerProgression(req: Request, res: Response): Promise<void> {
    const { playerId, seasonId } = req.params;
    const { days } = req.query as { days?: string };

    const progression = await progressionService.getPlayerProgression(
      playerId,
      seasonId,
      days ? parseInt(days, 10) : 30
    );

    res.json({
      success: true,
      data: progression,
    });
  }

  public async getPlayerMilestones(req: Request, res: Response): Promise<void> {
    const { playerId } = req.params;
    const { seasonId } = req.query as { seasonId?: string };

    const milestones = await progressionService.getPlayerMilestones(playerId, seasonId);

    res.json({
      success: true,
      data: milestones,
    });
  }

  public async getPlayerStats(req: Request, res: Response): Promise<void> {
    const { playerId, seasonId } = req.params;

    const stats = await progressionService.getPlayerStats(playerId, seasonId);

    if (!stats) {
      res.status(404).json({
        success: false,
        error: 'Player stats not found',
      });
      return;
    }

    res.json({
      success: true,
      data: stats,
    });
  }

  public async getSeasonSummary(req: Request, res: Response): Promise<void> {
    const { seasonId } = req.params;

    const summary = await progressionService.getSeasonSummary(seasonId);

    res.json({
      success: true,
      data: summary,
    });
  }
}

export const progressionController = new ProgressionController();
