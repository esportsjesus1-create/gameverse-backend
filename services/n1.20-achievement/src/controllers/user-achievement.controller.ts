import { Request, Response } from 'express';
import { AchievementService } from '../services/achievement.service.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError } from '../utils/errors.js';
import { UpdateProgressInput } from '../types/achievement.types.js';

export const getUserAchievements = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  const achievements = await AchievementService.getUserAchievements(userId);
  sendSuccess(res, achievements);
});

export const getUserUnlockedAchievements = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  const achievements = await AchievementService.getUserUnlockedAchievements(userId);
  sendSuccess(res, achievements);
});

export const getUserAchievementProgress = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId, achievementId } = req.params;
  const progress = await AchievementService.getUserAchievementProgress(userId, achievementId);
  
  if (!progress) {
    const achievement = await AchievementService.getAchievementById(achievementId);
    if (!achievement) {
      throw new NotFoundError('Achievement', achievementId);
    }
    sendSuccess(res, {
      userId,
      achievementId,
      progress: 0,
      currentTier: 0,
      unlocked: false,
      unlockedAt: null
    });
    return;
  }
  
  sendSuccess(res, progress);
});

export const updateUserProgress = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId, achievementId } = req.params;
  const input = req.body as UpdateProgressInput;
  
  const result = await AchievementService.updateProgress(userId, achievementId, input);
  sendSuccess(res, result);
});

export const getUserStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  const stats = await AchievementService.getUserStats(userId);
  sendSuccess(res, stats);
});

export const checkAndUnlockAchievement = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId, achievementId } = req.params;
  const result = await AchievementService.checkAndUnlockAchievement(userId, achievementId);
  
  if (!result.achievement) {
    throw new NotFoundError('Achievement', achievementId);
  }
  
  sendSuccess(res, result);
});
