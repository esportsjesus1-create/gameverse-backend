import { NotificationModel } from '../models/notification.model.js';
import { notificationCache } from '../config/redis.js';
import {
  Notification,
  NotificationType,
  CreateNotificationInput,
  NotificationFilter,
  NotificationListResult
} from '../types/notification.types.js';
import { Achievement } from '../types/achievement.types.js';

export class NotificationService {
  static async getNotifications(filter: NotificationFilter): Promise<NotificationListResult> {
    return NotificationModel.findByUser(filter);
  }

  static async getNotificationById(id: string): Promise<Notification | null> {
    return NotificationModel.findById(id);
  }

  static async createNotification(input: CreateNotificationInput): Promise<Notification> {
    const notification = await NotificationModel.create(input);
    
    await this.publishNotification(notification);
    
    return notification;
  }

  static async createAchievementUnlockedNotification(
    userId: string,
    achievement: Achievement
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      type: NotificationType.ACHIEVEMENT_UNLOCKED,
      title: 'Achievement Unlocked!',
      message: `You've unlocked "${achievement.name}" and earned ${achievement.points} points!`,
      data: {
        achievementId: achievement.id,
        achievementName: achievement.name,
        points: achievement.points,
        iconUrl: achievement.iconUrl
      }
    });
  }

  static async createTierAdvancedNotification(
    userId: string,
    achievement: Achievement,
    tier: number
  ): Promise<Notification> {
    const tierInfo = achievement.tiers?.find(t => t.level === tier);
    const tierName = tierInfo?.name ?? `Tier ${tier}`;
    const tierPoints = tierInfo?.points ?? 0;

    return this.createNotification({
      userId,
      type: NotificationType.TIER_ADVANCED,
      title: 'Tier Advanced!',
      message: `You've reached ${tierName} in "${achievement.name}" and earned ${tierPoints} points!`,
      data: {
        achievementId: achievement.id,
        achievementName: achievement.name,
        tier,
        tierName,
        points: tierPoints,
        iconUrl: achievement.iconUrl
      }
    });
  }

  static async createProgressMilestoneNotification(
    userId: string,
    achievement: Achievement,
    progress: number,
    milestone: number
  ): Promise<Notification> {
    const percentage = Math.round((progress / achievement.criteria.target) * 100);

    return this.createNotification({
      userId,
      type: NotificationType.PROGRESS_MILESTONE,
      title: 'Progress Milestone!',
      message: `You're ${percentage}% of the way to unlocking "${achievement.name}"!`,
      data: {
        achievementId: achievement.id,
        achievementName: achievement.name,
        progress,
        milestone,
        percentage,
        iconUrl: achievement.iconUrl
      }
    });
  }

  static async markAsRead(id: string, userId: string): Promise<Notification | null> {
    return NotificationModel.markAsRead(id, userId);
  }

  static async markAllAsRead(userId: string): Promise<number> {
    return NotificationModel.markAllAsRead(userId);
  }

  static async deleteNotification(id: string, userId: string): Promise<boolean> {
    return NotificationModel.delete(id, userId);
  }

  static async getUnreadCount(userId: string): Promise<number> {
    return NotificationModel.getUnreadCount(userId);
  }

  static async cleanupOldNotifications(): Promise<number> {
    return NotificationModel.deleteOldNotifications();
  }

  private static async publishNotification(notification: Notification): Promise<void> {
    const channel = `notifications:${notification.userId}`;
    const message = JSON.stringify({
      type: 'notification',
      data: notification
    });

    await notificationCache.pushToList(channel, message);
    await notificationCache.trimList(channel, -100, -1);
    await notificationCache.expire(channel, 86400);
  }

  static async getRealtimeNotifications(
    userId: string,
    limit: number = 10
  ): Promise<Notification[]> {
    const channel = `notifications:${userId}`;
    const messages = await notificationCache.getListRange(channel, -limit, -1);
    
    return messages
      .map(msg => {
        try {
          const parsed = JSON.parse(msg) as { type: string; data: Notification };
          return parsed.data;
        } catch {
          return null;
        }
      })
      .filter((n): n is Notification => n !== null);
  }
}
