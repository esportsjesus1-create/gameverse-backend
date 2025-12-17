import { z } from 'zod';

export enum NotificationType {
  ACHIEVEMENT_UNLOCKED = 'achievement_unlocked',
  TIER_ADVANCED = 'tier_advanced',
  PROGRESS_MILESTONE = 'progress_milestone',
  SYSTEM = 'system'
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: NotificationData | null;
  isRead: boolean;
  createdAt: Date;
}

export interface NotificationData {
  achievementId?: string;
  achievementName?: string;
  points?: number;
  tier?: number;
  progress?: number;
  iconUrl?: string;
  [key: string]: unknown;
}

export const CreateNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.nativeEnum(NotificationType),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  data: z.record(z.unknown()).optional()
});

export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;

export interface NotificationFilter {
  userId: string;
  type?: NotificationType;
  isRead?: boolean;
  limit?: number;
  offset?: number;
}

export interface NotificationListResult {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}
