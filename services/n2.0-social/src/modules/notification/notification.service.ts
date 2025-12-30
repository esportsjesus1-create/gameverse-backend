import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
  NotificationPriority,
} from '../../database/entities/notification.entity';
import { SocialProfile } from '../../database/entities/social-profile.entity';
import { RedisService } from '../presence/redis.service';
import {
  NotificationResponseDto,
  UnreadCountResponseDto,
  NotificationFilterDto,
} from './dto/notification.dto';
import { PaginationDto, PaginatedResponseDto } from '../friend/dto/friend.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(SocialProfile)
    private readonly profileRepository: Repository<SocialProfile>,
    private readonly redisService: RedisService,
  ) {}

  async createFriendRequestNotification(
    recipientId: string,
    senderId: string,
    senderDisplayName: string,
  ): Promise<Notification> {
    return this.createNotification({
      recipientId,
      senderId,
      type: NotificationType.FRIEND_REQUEST,
      title: 'New Friend Request',
      message: `${senderDisplayName} sent you a friend request`,
      actionUrl: `/friends/requests`,
      priority: NotificationPriority.NORMAL,
    });
  }

  async createFriendRequestAcceptedNotification(
    recipientId: string,
    senderId: string,
    senderDisplayName: string,
  ): Promise<Notification> {
    return this.createNotification({
      recipientId,
      senderId,
      type: NotificationType.FRIEND_REQUEST_ACCEPTED,
      title: 'Friend Request Accepted',
      message: `${senderDisplayName} accepted your friend request`,
      actionUrl: `/profile/${senderId}`,
      priority: NotificationPriority.NORMAL,
    });
  }

  async createNewFollowerNotification(
    recipientId: string,
    senderId: string,
    senderDisplayName: string,
  ): Promise<Notification> {
    return this.createNotification({
      recipientId,
      senderId,
      type: NotificationType.NEW_FOLLOWER,
      title: 'New Follower',
      message: `${senderDisplayName} started following you`,
      actionUrl: `/profile/${senderId}`,
      priority: NotificationPriority.LOW,
    });
  }

  async createPostLikedNotification(
    recipientId: string,
    senderId: string,
    senderDisplayName: string,
    postId: string,
  ): Promise<Notification> {
    return this.createNotification({
      recipientId,
      senderId,
      type: NotificationType.POST_LIKED,
      title: 'Post Liked',
      message: `${senderDisplayName} liked your post`,
      metadata: { postId },
      actionUrl: `/feed/post/${postId}`,
      priority: NotificationPriority.LOW,
    });
  }

  async createPostCommentedNotification(
    recipientId: string,
    senderId: string,
    senderDisplayName: string,
    postId: string,
  ): Promise<Notification> {
    return this.createNotification({
      recipientId,
      senderId,
      type: NotificationType.POST_COMMENTED,
      title: 'New Comment',
      message: `${senderDisplayName} commented on your post`,
      metadata: { postId },
      actionUrl: `/feed/post/${postId}`,
      priority: NotificationPriority.NORMAL,
    });
  }

  async createAchievementUnlockedNotification(
    recipientId: string,
    achievementName: string,
    achievementId: string,
    gameName?: string,
  ): Promise<Notification> {
    return this.createNotification({
      recipientId,
      senderId: null,
      type: NotificationType.ACHIEVEMENT_UNLOCKED,
      title: 'Achievement Unlocked!',
      message: `You unlocked "${achievementName}"${gameName ? ` in ${gameName}` : ''}`,
      metadata: { achievementId, achievementName, gameName },
      actionUrl: `/profile/achievements`,
      priority: NotificationPriority.HIGH,
    });
  }

  async markAsRead(
    userId: string,
    notificationId: string,
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, recipientId: userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.isRead = true;
    notification.readAt = new Date();

    return this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: new Date() })
      .where('recipientId = :userId', { userId })
      .andWhere('isRead = false')
      .andWhere('isDeleted = false')
      .execute();
  }

  async getUnreadCount(userId: string): Promise<UnreadCountResponseDto> {
    const count = await this.notificationRepository.count({
      where: { recipientId: userId, isRead: false, isDeleted: false },
    });

    return { count };
  }

  async deleteNotification(
    userId: string,
    notificationId: string,
  ): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, recipientId: userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.isDeleted = true;
    await this.notificationRepository.save(notification);
  }

  async getNotifications(
    userId: string,
    pagination: PaginationDto,
    filter?: NotificationFilterDto,
  ): Promise<PaginatedResponseDto<NotificationResponseDto>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const queryBuilder = this.notificationRepository
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.sender', 'sender')
      .where('n.recipientId = :userId', { userId })
      .andWhere('n.isDeleted = false');

    if (filter?.type) {
      queryBuilder.andWhere('n.type = :type', { type: filter.type });
    }

    if (filter?.isRead !== undefined) {
      queryBuilder.andWhere('n.isRead = :isRead', { isRead: filter.isRead });
    }

    const [notifications, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('n.createdAt', 'DESC')
      .getManyAndCount();

    const data: NotificationResponseDto[] = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      senderId: n.sender?.id,
      senderUsername: n.sender?.username,
      senderDisplayName: n.sender?.displayName,
      senderAvatarUrl: n.sender?.avatarUrl || undefined,
      metadata: n.metadata || undefined,
      actionUrl: n.actionUrl || undefined,
      priority: n.priority,
      isRead: n.isRead,
      readAt: n.readAt || undefined,
      createdAt: n.createdAt,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async createNotification(params: {
    recipientId: string;
    senderId: string | null;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
    actionUrl?: string;
    priority?: NotificationPriority;
  }): Promise<Notification> {
    const notification = this.notificationRepository.create({
      recipientId: params.recipientId,
      senderId: params.senderId,
      type: params.type,
      title: params.title,
      message: params.message,
      metadata: params.metadata || null,
      actionUrl: params.actionUrl || null,
      priority: params.priority || NotificationPriority.NORMAL,
    });

    const savedNotification =
      await this.notificationRepository.save(notification);

    await this.publishNotificationUpdate(params.recipientId, savedNotification);

    return savedNotification;
  }

  private async publishNotificationUpdate(
    userId: string,
    notification: Notification,
  ): Promise<void> {
    try {
      await this.redisService.publishPresenceUpdate({
        userId,
        status: 'notification',
        customMessage: JSON.stringify({
          type: 'new_notification',
          notificationId: notification.id,
          notificationType: notification.type,
          title: notification.title,
        }),
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Failed to publish notification update:', error);
    }
  }
}
