import { Request, Response, NextFunction } from 'express';
import { matchService } from '../services';
import { UpdateMatchDto } from '../types';

export class MatchController {
  /**
   * Get match by ID
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const match = await matchService.getById(req.params.id);

      res.json({
        success: true,
        data: match,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update match result
   */
  async updateResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: UpdateMatchDto = {
        player1Score: req.body.player1Score,
        player2Score: req.body.player2Score,
        winnerId: req.body.winnerId,
        status: req.body.status,
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined,
      };

      // Remove undefined values
      Object.keys(data).forEach(key => {
        if (data[key as keyof UpdateMatchDto] === undefined) {
          delete data[key as keyof UpdateMatchDto];
        }
      });

      const match = await matchService.updateResult(req.params.id, data);

      res.json({
        success: true,
        data: match,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Start match
   */
  async startMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const match = await matchService.startMatch(req.params.id);

      res.json({
        success: true,
        data: match,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel match
   */
  async cancelMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const match = await matchService.cancelMatch(req.params.id);

      res.json({
        success: true,
        data: match,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Schedule match
   */
  async scheduleMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const scheduledAt = new Date(req.body.scheduledAt);
      const match = await matchService.scheduleMatch(req.params.id, scheduledAt);

      res.json({
        success: true,
        data: match,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const matchController = new MatchController();
