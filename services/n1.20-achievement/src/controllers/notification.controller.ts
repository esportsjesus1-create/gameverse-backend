import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { sendSuccess, sendNoContent } from '../utils/response.js';
import { NotFoundError } from '../utils/errors.js';
import { NotificationType, NotificationFilter } from '../types/notification.types.js';

export const getUserNotifications = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  const { type, isRead, limit, offset } = req.query;
  
  const filter: NotificationFilter = {
    userId,
    type: type as NotificationType | undefined,
    isRead: isRead !== undefined ? isRead === 'true' : undefined,
    limit: limit ? parseInt(limit as string, 10) : 20,
    offset: offset ? parseInt(offset as string, 10) : 0
  };
  
  const result = await NotificationService.getNotifications(filter);
  sendSuccess(res, result);
});

export const markNotificationAsRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId, id } = req.params;
  const notification = await NotificationService.markAsRead(id, userId);
  
  if (!notification) {
    throw new NotFoundError('Notification', id);
  }
  
  sendSuccess(res, notification);
});

export const markAllNotificationsAsRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  const count = await NotificationService.markAllAsRead(userId);
  sendSuccess(res, { markedAsRead: count });
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId, id } = req.params;
  const deleted = await NotificationService.deleteNotification(id, userId);
  
  if (!deleted) {
    throw new NotFoundError('Notification', id);
  }
  
  sendNoContent(res);
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  const count = await NotificationService.getUnreadCount(userId);
  sendSuccess(res, { unreadCount: count });
});

export const getRealtimeNotifications = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 10;
  const notifications = await NotificationService.getRealtimeNotifications(userId, limit);
  sendSuccess(res, notifications);
});
