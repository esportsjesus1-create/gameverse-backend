import { AchievementService } from '../../src/services/achievement.service';
import { AchievementModel } from '../../src/models/achievement.model';
import { UserAchievementModel } from '../../src/models/user-achievement.model';
import { NotificationService } from '../../src/services/notification.service';
import {
  Achievement,
  AchievementType,
  AchievementCategory,
  AchievementRarity,
  UserAchievement
} from '../../src/types/achievement.types';

jest.mock('../../src/models/achievement.model');
jest.mock('../../src/models/user-achievement.model');
jest.mock('../../src/services/notification.service');

const mockedAchievementModel = jest.mocked(AchievementModel);
const mockedUserAchievementModel = jest.mocked(UserAchievementModel);
const mockedNotificationService = jest.mocked(NotificationService);

describe('AchievementService', () => {
  const mockAchievement: Achievement = {
    id: 'ach-123',
    name: 'Test Achievement',
    description: 'Test description',
    iconUrl: null,
    points: 100,
    rarity: AchievementRarity.COMMON,
    type: AchievementType.PROGRESSIVE,
    category: AchievementCategory.GAMEPLAY,
    criteria: { type: 'count', target: 10 },
    isHidden: false,
    tiers: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockUserAchievement: UserAchievement = {
    id: 'ua-123',
    userId: 'user-123',
    achievementId: 'ach-123',
    progress: 5,
    currentTier: 0,
    unlocked: false,
    unlockedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllAchievements', () => {
    it('should return all achievements', async () => {
      mockedAchievementModel.findAll.mockResolvedValue([mockAchievement]);

      const result = await AchievementService.getAllAchievements();

      expect(result).toEqual([mockAchievement]);
      expect(mockedAchievementModel.findAll).toHaveBeenCalledWith(false);
    });

    it('should include hidden achievements when requested', async () => {
      mockedAchievementModel.findAll.mockResolvedValue([mockAchievement]);

      await AchievementService.getAllAchievements(true);

      expect(mockedAchievementModel.findAll).toHaveBeenCalledWith(true);
    });
  });

  describe('getAchievementById', () => {
    it('should return achievement by id', async () => {
      mockedAchievementModel.findById.mockResolvedValue(mockAchievement);

      const result = await AchievementService.getAchievementById('ach-123');

      expect(result).toEqual(mockAchievement);
      expect(mockedAchievementModel.findById).toHaveBeenCalledWith('ach-123');
    });

    it('should return null for non-existent achievement', async () => {
      mockedAchievementModel.findById.mockResolvedValue(null);

      const result = await AchievementService.getAchievementById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateProgress', () => {
    it('should update progress with increment', async () => {
      mockedAchievementModel.findById.mockResolvedValue(mockAchievement);
      mockedUserAchievementModel.getOrCreate.mockResolvedValue(mockUserAchievement);
      mockedUserAchievementModel.updateProgress.mockResolvedValue({
        ...mockUserAchievement,
        progress: 8
      });

      const result = await AchievementService.updateProgress(
        'user-123',
        'ach-123',
        { increment: 3 }
      );

      expect(result.previousProgress).toBe(5);
      expect(result.currentProgress).toBe(8);
      expect(result.unlocked).toBe(false);
      expect(result.newlyUnlocked).toBe(false);
    });

    it('should update progress with setValue', async () => {
      mockedAchievementModel.findById.mockResolvedValue(mockAchievement);
      mockedUserAchievementModel.getOrCreate.mockResolvedValue(mockUserAchievement);
      mockedUserAchievementModel.updateProgress.mockResolvedValue({
        ...mockUserAchievement,
        progress: 7
      });

      const result = await AchievementService.updateProgress(
        'user-123',
        'ach-123',
        { setValue: 7 }
      );

      expect(result.currentProgress).toBe(7);
    });

    it('should unlock achievement when target is reached', async () => {
      mockedAchievementModel.findById.mockResolvedValue(mockAchievement);
      mockedUserAchievementModel.getOrCreate.mockResolvedValue({
        ...mockUserAchievement,
        progress: 9
      });
      mockedUserAchievementModel.updateProgress.mockResolvedValue({
        ...mockUserAchievement,
        progress: 10
      });
      mockedUserAchievementModel.unlock.mockResolvedValue({
        ...mockUserAchievement,
        progress: 10,
        unlocked: true,
        unlockedAt: new Date()
      });
      mockedNotificationService.createAchievementUnlockedNotification.mockResolvedValue({
        id: 'notif-123',
        userId: 'user-123',
        type: 'achievement_unlocked' as const,
        title: 'Achievement Unlocked!',
        message: 'Test',
        data: null,
        isRead: false,
        createdAt: new Date()
      });

      const result = await AchievementService.updateProgress(
        'user-123',
        'ach-123',
        { increment: 1 }
      );

      expect(result.unlocked).toBe(true);
      expect(result.newlyUnlocked).toBe(true);
      expect(mockedUserAchievementModel.unlock).toHaveBeenCalled();
      expect(mockedNotificationService.createAchievementUnlockedNotification).toHaveBeenCalled();
    });

    it('should throw error for non-existent achievement', async () => {
      mockedAchievementModel.findById.mockResolvedValue(null);

      await expect(
        AchievementService.updateProgress('user-123', 'non-existent', { increment: 1 })
      ).rejects.toThrow('Achievement not found');
    });

    it('should handle tiered achievements', async () => {
      const tieredAchievement: Achievement = {
        ...mockAchievement,
        type: AchievementType.TIERED,
        criteria: { type: 'count', target: 100 },
        tiers: [
          { level: 1, target: 10, points: 10, name: 'Bronze' },
          { level: 2, target: 50, points: 50, name: 'Silver' },
          { level: 3, target: 100, points: 100, name: 'Gold' }
        ]
      };

      mockedAchievementModel.findById.mockResolvedValue(tieredAchievement);
      mockedUserAchievementModel.getOrCreate.mockResolvedValue({
        ...mockUserAchievement,
        progress: 8,
        currentTier: 0
      });
      mockedUserAchievementModel.updateProgress.mockResolvedValue({
        ...mockUserAchievement,
        progress: 15,
        currentTier: 1
      });
      mockedNotificationService.createTierAdvancedNotification.mockResolvedValue({
        id: 'notif-123',
        userId: 'user-123',
        type: 'tier_advanced' as const,
        title: 'Tier Advanced!',
        message: 'Test',
        data: null,
        isRead: false,
        createdAt: new Date()
      });

      const result = await AchievementService.updateProgress(
        'user-123',
        'ach-123',
        { increment: 7 }
      );

      expect(result.tierAdvanced).toBe(true);
      expect(result.currentTier).toBe(1);
      expect(mockedNotificationService.createTierAdvancedNotification).toHaveBeenCalled();
    });
  });

  describe('getUserStats', () => {
    it('should return user stats', async () => {
      mockedAchievementModel.count.mockResolvedValue(10);
      mockedAchievementModel.getTotalPoints.mockResolvedValue(1000);
      mockedUserAchievementModel.countUnlockedByUser.mockResolvedValue(5);
      mockedUserAchievementModel.getEarnedPointsByUser.mockResolvedValue(500);
      mockedUserAchievementModel.findRecentUnlocks.mockResolvedValue([]);
      mockedUserAchievementModel.getCategoryBreakdown.mockResolvedValue({
        [AchievementCategory.GAMEPLAY]: { total: 5, unlocked: 3 },
        [AchievementCategory.SOCIAL]: { total: 2, unlocked: 1 },
        [AchievementCategory.COLLECTION]: { total: 1, unlocked: 0 },
        [AchievementCategory.EXPLORATION]: { total: 1, unlocked: 1 },
        [AchievementCategory.COMPETITIVE]: { total: 1, unlocked: 0 },
        [AchievementCategory.SPECIAL]: { total: 0, unlocked: 0 }
      });

      const result = await AchievementService.getUserStats('user-123');

      expect(result.totalAchievements).toBe(10);
      expect(result.unlockedCount).toBe(5);
      expect(result.totalPoints).toBe(1000);
      expect(result.earnedPoints).toBe(500);
      expect(result.completionPercentage).toBe(50);
    });
  });
});
