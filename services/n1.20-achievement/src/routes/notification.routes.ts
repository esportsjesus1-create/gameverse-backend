import { Router } from 'express';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getUnreadCount,
  getRealtimeNotifications
} from '../controllers/notification.controller.js';

const router = Router();

router.get('/:userId/notifications', getUserNotifications);

router.get('/:userId/notifications/unread-count', getUnreadCount);

router.get('/:userId/notifications/realtime', getRealtimeNotifications);

router.put('/:userId/notifications/read-all', markAllNotificationsAsRead);

router.put('/:userId/notifications/:id/read', markNotificationAsRead);

router.delete('/:userId/notifications/:id', deleteNotification);

export default router;
