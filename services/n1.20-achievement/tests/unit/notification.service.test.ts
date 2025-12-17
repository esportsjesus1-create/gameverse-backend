import { NotificationService } from '../../src/services/notification.service';
import { NotificationModel } from '../../src/models/notification.model';
import {
  Notification,
  NotificationType,
  NotificationListResult
} from '../../src/types/notification.types';
import {
  Achievement,
  AchievementType,
  AchievementCategory,
  AchievementRarity
} from '../../src/types/achievement.types';

jest.mock('../../src/models/notification.model');

const mockedNotificationModel = jest.mocked(NotificationModel);

describe('NotificationService', () => {
  const mockNotification: Notification = {
    id: 'notif-123',
    userId: 'user-123',
    type: NotificationType.ACHIEVEMENT_UNLOCKED,
    title: 'Achievement Unlocked!',
    message: 'You unlocked Test Achievement',
    data: { achievementId: 'ach-123' },
    isRead: false,
    createdAt: new Date()
  };

  const mockAchievement: Achievement = {
    id: 'ach-123',
    name: 'Test Achievement',
    description: 'Test description',
    iconUrl: 'https://example.com/icon.png',
    points: 100,
    rarity: AchievementRarity.COMMON,
    type: AchievementType.SINGLE,
    category: AchievementCategory.GAMEPLAY,
    criteria: { type: 'count', target: 1 },
    isHidden: false,
    tiers: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('should return notifications for user', async () => {
      const mockResult: NotificationListResult = {
        notifications: [mockNotification],
        total: 1,
        unreadCount: 1
      };
      mockedNotificationModel.findByUser.mockResolvedValue(mockResult);

      const result = await NotificationService.getNotifications({
        userId: 'user-123',
        limit: 20,
        offset: 0
      });

      expect(result).toEqual(mockResult);
      expect(mockedNotificationModel.findByUser).toHaveBeenCalledWith({
        userId: 'user-123',
        limit: 20,
        offset: 0
      });
    });
  });

  describe('createAchievementUnlockedNotification', () => {
    it('should create achievement unlocked notification', async () => {
      mockedNotificationModel.create.mockResolvedValue(mockNotification);

      const result = await NotificationService.createAchievementUnlockedNotification(
        'user-123',
        mockAchievement
      );

      expect(result).toEqual(mockNotification);
      expect(mockedNotificationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          type: NotificationType.ACHIEVEMENT_UNLOCKED,
          title: 'Achievement Unlocked!',
          data: expect.objectContaining({
            achievementId: 'ach-123',
            achievementName: 'Test Achievement',
            points: 100
          })
        })
      );
    });
  });

  describe('createTierAdvancedNotification', () => {
    it('should create tier advanced notification', async () => {
      const tieredAchievement: Achievement = {
        ...mockAchievement,
        type: AchievementType.TIERED,
        tiers: [
          { level: 1, target: 10, points: 10, name: 'Bronze' },
          { level: 2, target: 50, points: 50, name: 'Silver' }
        ]
      };
      mockedNotificationModel.create.mockResolvedValue({
        ...mockNotification,
        type: NotificationType.TIER_ADVANCED
      });

      const result = await NotificationService.createTierAdvancedNotification(
        'user-123',
        tieredAchievement,
        1
      );

      expect(result.type).toBe(NotificationType.TIER_ADVANCED);
      expect(mockedNotificationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.TIER_ADVANCED,
          data: expect.objectContaining({
            tier: 1,
            tierName: 'Bronze'
          })
        })
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const readNotification = { ...mockNotification, isRead: true };
      mockedNotificationModel.markAsRead.mockResolvedValue(readNotification);

      const result = await NotificationService.markAsRead('notif-123', 'user-123');

      expect(result).toEqual(readNotification);
      expect(mockedNotificationModel.markAsRead).toHaveBeenCalledWith('notif-123', 'user-123');
    });

    it('should return null for non-existent notification', async () => {
      mockedNotificationModel.markAsRead.mockResolvedValue(null);

      const result = await NotificationService.markAsRead('non-existent', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockedNotificationModel.markAllAsRead.mockResolvedValue(5);

      const result = await NotificationService.markAllAsRead('user-123');

      expect(result).toBe(5);
      expect(mockedNotificationModel.markAllAsRead).toHaveBeenCalledWith('user-123');
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      mockedNotificationModel.delete.mockResolvedValue(true);

      const result = await NotificationService.deleteNotification('notif-123', 'user-123');

      expect(result).toBe(true);
      expect(mockedNotificationModel.delete).toHaveBeenCalledWith('notif-123', 'user-123');
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockedNotificationModel.getUnreadCount.mockResolvedValue(3);

      const result = await NotificationService.getUnreadCount('user-123');

      expect(result).toBe(3);
    });
  });
});
