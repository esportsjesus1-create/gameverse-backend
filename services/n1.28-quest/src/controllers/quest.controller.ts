import { Request, Response, NextFunction } from 'express';
import { questService } from '../services/quest.service';
import { QuestType, QuestStatus } from '../types';

export class QuestController {
  async createQuest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quest = await questService.createQuest(req.body);
      res.status(201).json({
        success: true,
        data: quest
      });
    } catch (error) {
      next(error);
    }
  }

  async getQuest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const quest = await questService.getQuestById(id);
      res.json({
        success: true,
        data: quest
      });
    } catch (error) {
      next(error);
    }
  }

  async getQuests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, status, minLevel, maxLevel, page = 1, limit = 20 } = req.query;

      const filter = {
        type: type as QuestType | undefined,
        status: status as QuestStatus | undefined,
        minLevel: minLevel ? parseInt(minLevel as string, 10) : undefined,
        maxLevel: maxLevel ? parseInt(maxLevel as string, 10) : undefined
      };

      const pagination = {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10)
      };

      const result = await questService.getQuests(filter, pagination);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  async getActiveQuests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.query;
      const quests = await questService.getActiveQuests(type as QuestType | undefined);
      res.json({
        success: true,
        data: quests
      });
    } catch (error) {
      next(error);
    }
  }

  async updateQuestStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const quest = await questService.updateQuestStatus(id, status);
      res.json({
        success: true,
        data: quest
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteQuest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await questService.deleteQuest(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const questController = new QuestController();
