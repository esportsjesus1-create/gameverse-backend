import { Request, Response, NextFunction } from 'express';
import { rewardService } from '../services/reward.service';

export class RewardController {
  async claimRewards(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, questId } = req.params;
      const rewards = await rewardService.claimRewards(userId, questId);
      res.status(201).json({
        success: true,
        data: rewards
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserRewards(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const pagination = {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10)
      };

      const result = await rewardService.getUserRewards(userId, pagination);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  async getRecentRewards(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { limit = 10 } = req.query;
      const rewards = await rewardService.getRecentRewards(userId, parseInt(limit as string, 10));
      res.json({
        success: true,
        data: rewards
      });
    } catch (error) {
      next(error);
    }
  }

  async getRewardsByQuestId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, questId } = req.params;
      const rewards = await rewardService.getRewardsByQuestId(userId, questId);
      res.json({
        success: true,
        data: rewards
      });
    } catch (error) {
      next(error);
    }
  }

  async getRewardSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const summary = await rewardService.getRewardSummary(userId);
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }
}

export const rewardController = new RewardController();
