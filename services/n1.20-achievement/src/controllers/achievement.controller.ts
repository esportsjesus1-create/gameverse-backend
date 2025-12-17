import { Request, Response } from 'express';
import { AchievementService } from '../services/achievement.service.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.js';
import { NotFoundError } from '../utils/errors.js';
import {
  CreateAchievementInput,
  UpdateAchievementInput,
  AchievementCategory
} from '../types/achievement.types.js';

export const getAllAchievements = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const includeHidden = req.query['includeHidden'] === 'true';
  const achievements = await AchievementService.getAllAchievements(includeHidden);
  sendSuccess(res, achievements);
});

export const getAchievementById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const achievement = await AchievementService.getAchievementById(id);
  
  if (!achievement) {
    throw new NotFoundError('Achievement', id);
  }
  
  sendSuccess(res, achievement);
});

export const getAchievementsByCategory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const category = req.params['category'] as AchievementCategory;
  const achievements = await AchievementService.getAchievementsByCategory(category);
  sendSuccess(res, achievements);
});

export const createAchievement = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = req.body as CreateAchievementInput;
  const achievement = await AchievementService.createAchievement(input);
  sendCreated(res, achievement);
});

export const updateAchievement = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const input = req.body as UpdateAchievementInput;
  const achievement = await AchievementService.updateAchievement(id, input);
  
  if (!achievement) {
    throw new NotFoundError('Achievement', id);
  }
  
  sendSuccess(res, achievement);
});

export const deleteAchievement = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const deleted = await AchievementService.deleteAchievement(id);
  
  if (!deleted) {
    throw new NotFoundError('Achievement', id);
  }
  
  sendNoContent(res);
});
