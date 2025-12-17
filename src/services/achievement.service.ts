import { v4 as uuidv4 } from 'uuid';
import {
  Achievement,
  UserAchievement,
  AchievementProgress,
  UnlockResult,
  CreateAchievementInput,
  ProgressUpdateInput,
  StatUpdateInput,
  EventTriggerInput,
  UserStats,
  AchievementError,
  AchievementNotFoundError,
  AchievementAlreadyUnlockedError,
  PrerequisitesNotMetError,
  RewardsAlreadyClaimedError,
} from '../types';

const achievements: Map<string, Achievement> = new Map();
const userAchievements: Map<string, Map<string, UserAchievement>> = new Map();
const userStats: Map<string, UserStats> = new Map();

export class AchievementService {
  async createAchievement(input: CreateAchievementInput): Promise<Achievement> {
    const achievementId = uuidv4();
    const now = new Date();

    const achievement: Achievement = {
      id: achievementId,
      name: input.name,
      description: input.description,
      type: input.type,
      category: input.category,
      iconUrl: input.iconUrl,
      points: input.points,
      isActive: true,
      isHidden: input.isHidden || false,
      trigger: input.trigger,
      rewards: input.rewards,
      prerequisites: input.prerequisites,
      tiers: input.tiers,
      seasonId: input.seasonId,
      expiresAt: input.expiresAt,
      createdAt: now,
      updatedAt: now,
    };

    achievements.set(achievementId, achievement);
    return achievement;
  }

  async getAchievementById(id: string): Promise<Achievement | null> {
    return achievements.get(id) || null;
  }

  async getAchievements(category?: string, type?: string, includeHidden?: boolean): Promise<Achievement[]> {
    let result = Array.from(achievements.values()).filter(a => a.isActive);

    if (category) {
      result = result.filter(a => a.category === category);
    }

    if (type) {
      result = result.filter(a => a.type === type);
    }

    if (!includeHidden) {
      result = result.filter(a => !a.isHidden);
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getUserProgress(userId: string, achievementId: string): Promise<AchievementProgress | null> {
    const achievement = achievements.get(achievementId);
    if (!achievement) return null;

    const userAchMap = userAchievements.get(userId);
    const userAch = userAchMap?.get(achievementId);

    const progress = userAch?.progress || 0;
    const threshold = achievement.trigger.threshold;
    const progressPercent = Math.min(100, (progress / threshold) * 100);

    let nextTierThreshold: number | undefined;
    if (achievement.tiers && userAch) {
      const nextTier = achievement.tiers.find(t => t.tier === userAch.currentTier + 1);
      nextTierThreshold = nextTier?.threshold;
    }

    return {
      userId,
      achievementId,
      achievement,
      progress,
      progressPercent,
      currentTier: userAch?.currentTier || 0,
      nextTierThreshold,
      isUnlocked: userAch?.isUnlocked || false,
      unlockedAt: userAch?.unlockedAt,
      claimedRewards: userAch?.claimedRewards || false,
    };
  }

  async getAllUserProgress(userId: string): Promise<AchievementProgress[]> {
    const progressList: AchievementProgress[] = [];

    for (const achievement of achievements.values()) {
      if (!achievement.isActive) continue;
      
      const progress = await this.getUserProgress(userId, achievement.id);
      if (progress) {
        progressList.push(progress);
      }
    }

    return progressList;
  }

  async updateProgress(input: ProgressUpdateInput): Promise<UnlockResult | null> {
    const achievement = achievements.get(input.achievementId);
    if (!achievement) {
      throw new AchievementNotFoundError();
    }

    if (!achievement.isActive) {
      throw new AchievementError('Achievement is not active', 400, 'ACHIEVEMENT_INACTIVE');
    }

    if (achievement.prerequisites && achievement.prerequisites.length > 0) {
      const prereqsMet = await this.checkPrerequisites(input.odbyId, achievement.prerequisites);
      if (!prereqsMet) {
        throw new PrerequisitesNotMetError();
      }
    }

    let userAchMap = userAchievements.get(input.odbyId);
    if (!userAchMap) {
      userAchMap = new Map();
      userAchievements.set(input.odbyId, userAchMap);
    }

    let userAch = userAchMap.get(input.achievementId);
    const now = new Date();

    if (!userAch) {
      userAch = {
        id: uuidv4(),
        odbyId: input.odbyId,
        achievementId: input.achievementId,
        progress: 0,
        currentTier: 0,
        isUnlocked: false,
        claimedRewards: false,
        createdAt: now,
        updatedAt: now,
      };
      userAchMap.set(input.achievementId, userAch);
    }

    if (userAch.isUnlocked && !achievement.tiers) {
      return null;
    }

    const previousProgress = userAch.progress;
    const previousTier = userAch.currentTier;

    if (input.increment) {
      userAch.progress += input.progress;
    } else {
      userAch.progress = input.progress;
    }

    userAch.updatedAt = now;

    const unlockResult = this.checkUnlock(achievement, userAch, previousProgress, previousTier);

    if (unlockResult) {
      if (unlockResult.isNewUnlock) {
        userAch.isUnlocked = true;
        userAch.unlockedAt = now;
      }
      if (unlockResult.isTierUp && unlockResult.tier !== undefined) {
        userAch.currentTier = unlockResult.tier;
      }
    }

    return unlockResult;
  }

  private checkUnlock(
    achievement: Achievement,
    userAch: UserAchievement,
    previousProgress: number,
    previousTier: number
  ): UnlockResult | null {
    const trigger = achievement.trigger;
    const currentProgress = userAch.progress;

    if (achievement.tiers && achievement.tiers.length > 0) {
      const sortedTiers = [...achievement.tiers].sort((a, b) => a.tier - b.tier);
      
      for (const tier of sortedTiers) {
        if (tier.tier > previousTier && this.meetsThreshold(currentProgress, tier.threshold, trigger.comparison)) {
          return {
            achievement,
            tier: tier.tier,
            rewards: tier.rewards,
            isNewUnlock: previousTier === 0,
            isTierUp: true,
          };
        }
      }
      return null;
    }

    if (!userAch.isUnlocked && this.meetsThreshold(currentProgress, trigger.threshold, trigger.comparison)) {
      return {
        achievement,
        rewards: achievement.rewards,
        isNewUnlock: true,
        isTierUp: false,
      };
    }

    return null;
  }

  private meetsThreshold(value: number, threshold: number, comparison: string): boolean {
    switch (comparison) {
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      default: return false;
    }
  }

  async checkPrerequisites(userId: string, prerequisites: string[]): Promise<boolean> {
    const userAchMap = userAchievements.get(userId);
    if (!userAchMap) return false;

    for (const prereqId of prerequisites) {
      const prereqAch = userAchMap.get(prereqId);
      if (!prereqAch || !prereqAch.isUnlocked) {
        return false;
      }
    }

    return true;
  }

  async updateStat(input: StatUpdateInput): Promise<UnlockResult[]> {
    let stats = userStats.get(input.odbyId);
    if (!stats) {
      stats = {
        odbyId: input.odbyId,
        stats: {},
        updatedAt: new Date(),
      };
      userStats.set(input.odbyId, stats);
    }

    if (input.increment) {
      stats.stats[input.statKey] = (stats.stats[input.statKey] || 0) + input.value;
    } else {
      stats.stats[input.statKey] = input.value;
    }
    stats.updatedAt = new Date();

    const unlockResults: UnlockResult[] = [];

    for (const achievement of achievements.values()) {
      if (!achievement.isActive) continue;
      if (achievement.trigger.type !== 'stat_threshold' && achievement.trigger.type !== 'cumulative') continue;
      if (achievement.trigger.statKey !== input.statKey) continue;

      const result = await this.updateProgress({
        odbyId: input.odbyId,
        achievementId: achievement.id,
        progress: stats.stats[input.statKey],
        increment: false,
      });

      if (result) {
        unlockResults.push(result);
      }
    }

    return unlockResults;
  }

  async triggerEvent(input: EventTriggerInput): Promise<UnlockResult[]> {
    const unlockResults: UnlockResult[] = [];

    for (const achievement of achievements.values()) {
      if (!achievement.isActive) continue;
      if (achievement.trigger.type !== 'event' && achievement.trigger.type !== 'first_time') continue;
      if (achievement.trigger.eventType !== input.eventType) continue;

      const result = await this.updateProgress({
        odbyId: input.odbyId,
        achievementId: achievement.id,
        progress: 1,
        increment: achievement.trigger.type === 'event',
      });

      if (result) {
        unlockResults.push(result);
      }
    }

    return unlockResults;
  }

  async claimRewards(userId: string, achievementId: string): Promise<{ rewards: Achievement['rewards']; tier?: number }> {
    const achievement = achievements.get(achievementId);
    if (!achievement) {
      throw new AchievementNotFoundError();
    }

    const userAchMap = userAchievements.get(userId);
    const userAch = userAchMap?.get(achievementId);

    if (!userAch || !userAch.isUnlocked) {
      throw new AchievementError('Achievement not unlocked', 400, 'ACHIEVEMENT_NOT_UNLOCKED');
    }

    if (userAch.claimedRewards) {
      throw new RewardsAlreadyClaimedError();
    }

    userAch.claimedRewards = true;
    userAch.updatedAt = new Date();

    let rewards = achievement.rewards;
    if (achievement.tiers && userAch.currentTier > 0) {
      const tier = achievement.tiers.find(t => t.tier === userAch.currentTier);
      if (tier) {
        rewards = tier.rewards;
      }
    }

    return { rewards, tier: userAch.currentTier || undefined };
  }

  async getUnlockedAchievements(userId: string): Promise<AchievementProgress[]> {
    const allProgress = await this.getAllUserProgress(userId);
    return allProgress.filter(p => p.isUnlocked);
  }

  async getAchievementStats(userId: string): Promise<{
    totalAchievements: number;
    unlockedCount: number;
    totalPoints: number;
    earnedPoints: number;
    completionPercent: number;
  }> {
    const activeAchievements = Array.from(achievements.values()).filter(a => a.isActive && !a.isHidden);
    const totalAchievements = activeAchievements.length;
    const totalPoints = activeAchievements.reduce((sum, a) => sum + a.points, 0);

    const userAchMap = userAchievements.get(userId);
    let unlockedCount = 0;
    let earnedPoints = 0;

    if (userAchMap) {
      for (const [achId, userAch] of userAchMap) {
        if (userAch.isUnlocked) {
          const achievement = achievements.get(achId);
          if (achievement && achievement.isActive) {
            unlockedCount++;
            earnedPoints += achievement.points;
          }
        }
      }
    }

    const completionPercent = totalAchievements > 0 ? (unlockedCount / totalAchievements) * 100 : 0;

    return {
      totalAchievements,
      unlockedCount,
      totalPoints,
      earnedPoints,
      completionPercent,
    };
  }

  async deleteAchievement(achievementId: string): Promise<void> {
    achievements.delete(achievementId);
  }

  async setAchievementActive(achievementId: string, active: boolean): Promise<Achievement> {
    const achievement = achievements.get(achievementId);
    if (!achievement) {
      throw new AchievementNotFoundError();
    }

    achievement.isActive = active;
    achievement.updatedAt = new Date();

    return achievement;
  }

  getUserStats(userId: string): UserStats | null {
    return userStats.get(userId) || null;
  }
}

export const achievementService = new AchievementService();
