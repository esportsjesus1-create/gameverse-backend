import { Request, Response, NextFunction } from 'express';
import { userQuestService } from '../services/user-quest.service';

export class UserQuestController {
  async acceptQuest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, questId } = req.params;
      const userQuest = await userQuestService.acceptQuest(userId, questId);
      res.status(201).json({
        success: true,
        data: userQuest
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserQuests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const pagination = {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10)
      };

      const result = await userQuestService.getUserQuests(userId, pagination);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserQuestByQuestId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, questId } = req.params;
      const userQuest = await userQuestService.getUserQuestByQuestId(userId, questId);
      res.json({
        success: true,
        data: userQuest
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, questId } = req.params;
      const userQuest = await userQuestService.updateProgress(userId, questId, req.body);
      res.json({
        success: true,
        data: userQuest
      });
    } catch (error) {
      next(error);
    }
  }

  async getActiveUserQuests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const userQuests = await userQuestService.getActiveUserQuests(userId);
      res.json({
        success: true,
        data: userQuests
      });
    } catch (error) {
      next(error);
    }
  }
}

export const userQuestController = new UserQuestController();
