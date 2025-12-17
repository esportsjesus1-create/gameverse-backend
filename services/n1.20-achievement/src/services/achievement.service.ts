import { AchievementModel } from '../models/achievement.model.js';
import { UserAchievementModel } from '../models/user-achievement.model.js';
import { NotificationService } from './notification.service.js';
import { statsCache } from '../config/redis.js';
import { config } from '../config/index.js';
import {
  Achievement,
  CreateAchievementInput,
  UpdateAchievementInput,
  UserAchievement,
  UserAchievementWithDetails,
  AchievementStats,
  UpdateProgressInput,
  ProgressUpdateResult,
  AchievementType,
  AchievementCategory
} from '../types/achievement.types.js';

export class AchievementService {
  static async getAllAchievements(includeHidden: boolean = false): Promise<Achievement[]> {
    return AchievementModel.findAll(includeHidden);
  }

  static async getAchievementById(id: string): Promise<Achievement | null> {
    return AchievementModel.findById(id);
  }

  static async getAchievementsByCategory(category: AchievementCategory): Promise<Achievement[]> {
    return AchievementModel.findByCategory(category);
  }

  static async createAchievement(input: CreateAchievementInput): Promise<Achievement> {
    return AchievementModel.create(input);
  }

  static async updateAchievement(id: string, input: UpdateAchievementInput): Promise<Achievement | null> {
    return AchievementModel.update(id, input);
  }

  static async deleteAchievement(id: string): Promise<boolean> {
    return AchievementModel.delete(id);
  }

  static async getUserAchievements(userId: string): Promise<UserAchievementWithDetails[]> {
    return UserAchievementModel.findAllByUser(userId);
  }

  static async getUserUnlockedAchievements(userId: string): Promise<UserAchievementWithDetails[]> {
    return UserAchievementModel.findUnlockedByUser(userId);
  }

  static async getUserAchievementProgress(
    userId: string,
    achievementId: string
  ): Promise<UserAchievement | null> {
    return UserAchievementModel.findByUserAndAchievement(userId, achievementId);
  }

  static async updateProgress(
    userId: string,
    achievementId: string,
    input: UpdateProgressInput
  ): Promise<ProgressUpdateResult> {
    const achievement = await AchievementModel.findById(achievementId);
    if (!achievement) {
      throw new Error(`Achievement not found: ${achievementId}`);
    }

    let userAchievement = await UserAchievementModel.getOrCreate(userId, achievementId);
    const previousProgress = userAchievement.progress;
    const previousTier = userAchievement.currentTier;
    const wasUnlocked = userAchievement.unlocked;

    let newProgress: number;
    if (input.setValue !== undefined) {
      newProgress = input.setValue;
    } else if (input.increment !== undefined) {
      newProgress = previousProgress + input.increment;
    } else {
      throw new Error('Either increment or setValue must be provided');
    }

    newProgress = Math.max(0, newProgress);

    const { shouldUnlock, newTier, tierAdvanced } = this.evaluateUnlockCondition(
      achievement,
      newProgress,
      previousTier
    );

    userAchievement = (await UserAchievementModel.updateProgress(
      userId,
      achievementId,
      newProgress,
      newTier
    ))!;

    let newlyUnlocked = false;
    if (shouldUnlock && !wasUnlocked) {
      await UserAchievementModel.unlock(userId, achievementId);
      newlyUnlocked = true;

      await NotificationService.createAchievementUnlockedNotification(
        userId,
        achievement
      );
    } else if (tierAdvanced) {
      await NotificationService.createTierAdvancedNotification(
        userId,
        achievement,
        newTier
      );
    }

    return {
      previousProgress,
      currentProgress: newProgress,
      unlocked: shouldUnlock || wasUnlocked,
      newlyUnlocked,
      tierAdvanced,
      previousTier,
      currentTier: newTier,
      achievement
    };
  }

  private static evaluateUnlockCondition(
    achievement: Achievement,
    progress: number,
    currentTier: number
  ): { shouldUnlock: boolean; newTier: number; tierAdvanced: boolean } {
    const { criteria, type, tiers } = achievement;

    switch (type) {
      case AchievementType.SINGLE:
        return {
          shouldUnlock: progress >= criteria.target,
          newTier: 0,
          tierAdvanced: false
        };

      case AchievementType.PROGRESSIVE:
        return {
          shouldUnlock: progress >= criteria.target,
          newTier: 0,
          tierAdvanced: false
        };

      case AchievementType.TIERED: {
        if (!tiers || tiers.length === 0) {
          return {
            shouldUnlock: progress >= criteria.target,
            newTier: 0,
            tierAdvanced: false
          };
        }

        let newTier = currentTier;
        for (const tier of tiers) {
          if (progress >= tier.target && tier.level > newTier) {
            newTier = tier.level;
          }
        }

        const maxTier = Math.max(...tiers.map(t => t.level));
        const shouldUnlock = newTier >= maxTier;
        const tierAdvanced = newTier > currentTier;

        return { shouldUnlock, newTier, tierAdvanced };
      }

      default:
        return {
          shouldUnlock: progress >= criteria.target,
          newTier: 0,
          tierAdvanced: false
        };
    }
  }

  static async getUserStats(userId: string): Promise<AchievementStats> {
    const cacheKey = `user:${userId}`;
    const cached = await statsCache.get<AchievementStats>(cacheKey);
    if (cached) return cached;

    const [
      totalAchievements,
      totalPoints,
      unlockedCount,
      earnedPoints,
      recentUnlocks,
      categoryBreakdown
    ] = await Promise.all([
      AchievementModel.count(),
      AchievementModel.getTotalPoints(),
      UserAchievementModel.countUnlockedByUser(userId),
      UserAchievementModel.getEarnedPointsByUser(userId),
      UserAchievementModel.findRecentUnlocks(userId, 5),
      UserAchievementModel.getCategoryBreakdown(userId)
    ]);

    const completionPercentage = totalAchievements > 0
      ? Math.round((unlockedCount / totalAchievements) * 100)
      : 0;

    const stats: AchievementStats = {
      totalAchievements,
      unlockedCount,
      totalPoints,
      earnedPoints,
      completionPercentage,
      recentUnlocks,
      categoryBreakdown
    };

    await statsCache.set(cacheKey, stats, config.cache.statsTtl);
    return stats;
  }

  static async checkAndUnlockAchievement(
    userId: string,
    achievementId: string
  ): Promise<{ unlocked: boolean; achievement: Achievement | null }> {
    const achievement = await AchievementModel.findById(achievementId);
    if (!achievement) {
      return { unlocked: false, achievement: null };
    }

    const userAchievement = await UserAchievementModel.findByUserAndAchievement(
      userId,
      achievementId
    );

    if (userAchievement?.unlocked) {
      return { unlocked: true, achievement };
    }

    const progress = userAchievement?.progress ?? 0;
    const { shouldUnlock } = this.evaluateUnlockCondition(
      achievement,
      progress,
      userAchievement?.currentTier ?? 0
    );

    if (shouldUnlock) {
      if (!userAchievement) {
        await UserAchievementModel.create(userId, achievementId, progress);
      }
      await UserAchievementModel.unlock(userId, achievementId);
      await NotificationService.createAchievementUnlockedNotification(userId, achievement);
      return { unlocked: true, achievement };
    }

    return { unlocked: false, achievement };
  }
}
