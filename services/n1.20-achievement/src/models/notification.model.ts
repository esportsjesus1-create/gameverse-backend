import { query, queryOne, execute } from '../config/database.js';
import { notificationCache } from '../config/redis.js';
import { config } from '../config/index.js';
import {
  Notification,
  NotificationType,
  NotificationData,
  CreateNotificationInput,
  NotificationFilter,
  NotificationListResult
} from '../types/notification.types.js';
import { v4 as uuidv4 } from 'uuid';

interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: NotificationData | null;
  is_read: boolean;
  created_at: Date;
}

function rowToNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    data: row.data,
    isRead: row.is_read,
    createdAt: row.created_at
  };
}

export class NotificationModel {
  static async findById(id: string): Promise<Notification | null> {
    const row = await queryOne<NotificationRow>(
      'SELECT * FROM notifications WHERE id = $1',
      [id]
    );
    return row ? rowToNotification(row) : null;
  }

  static async findByUser(filter: NotificationFilter): Promise<NotificationListResult> {
    const { userId, type, isRead, limit = 20, offset = 0 } = filter;

    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (type !== undefined) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(type);
    }

    if (isRead !== undefined) {
      conditions.push(`is_read = $${paramIndex++}`);
      params.push(isRead);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM notifications WHERE ${whereClause}`,
      params
    );
    const total = countResult ? parseInt(countResult.count, 10) : 0;

    const unreadResult = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    const unreadCount = unreadResult ? parseInt(unreadResult.count, 10) : 0;

    params.push(limit, offset);
    const rows = await query<NotificationRow>(
      `SELECT * FROM notifications 
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return {
      notifications: rows.map(rowToNotification),
      total,
      unreadCount
    };
  }

  static async create(input: CreateNotificationInput): Promise<Notification> {
    const id = uuidv4();
    const now = new Date();

    const row = await queryOne<NotificationRow>(
      `INSERT INTO notifications (id, user_id, type, title, message, data, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        input.userId,
        input.type,
        input.title,
        input.message,
        input.data ? JSON.stringify(input.data) : null,
        false,
        now
      ]
    );

    if (!row) {
      throw new Error('Failed to create notification');
    }

    await this.enforceMaxNotifications(input.userId);
    await this.invalidateCache(input.userId);

    return rowToNotification(row);
  }

  static async markAsRead(id: string, userId: string): Promise<Notification | null> {
    const row = await queryOne<NotificationRow>(
      `UPDATE notifications 
       SET is_read = true
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (row) {
      await this.invalidateCache(userId);
    }

    return row ? rowToNotification(row) : null;
  }

  static async markAllAsRead(userId: string): Promise<number> {
    const result = await execute(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    if (result > 0) {
      await this.invalidateCache(userId);
    }

    return result;
  }

  static async delete(id: string, userId: string): Promise<boolean> {
    const result = await execute(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result > 0) {
      await this.invalidateCache(userId);
    }

    return result > 0;
  }

  static async deleteOldNotifications(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.notifications.retentionDays);

    return execute(
      'DELETE FROM notifications WHERE created_at < $1',
      [cutoffDate]
    );
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = `unread:${userId}`;
    const cached = await notificationCache.get<number>(cacheKey);
    if (cached !== null) return cached;

    const result = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    const count = result ? parseInt(result.count, 10) : 0;
    await notificationCache.set(cacheKey, count, 60);
    return count;
  }

  private static async enforceMaxNotifications(userId: string): Promise<void> {
    const countResult = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1',
      [userId]
    );

    const count = countResult ? parseInt(countResult.count, 10) : 0;

    if (count > config.notifications.maxPerUser) {
      const excess = count - config.notifications.maxPerUser;
      await execute(
        `DELETE FROM notifications 
         WHERE id IN (
           SELECT id FROM notifications 
           WHERE user_id = $1 
           ORDER BY created_at ASC 
           LIMIT $2
         )`,
        [userId, excess]
      );
    }
  }

  private static async invalidateCache(userId: string): Promise<void> {
    await notificationCache.delete(`unread:${userId}`);
    await notificationCache.deletePattern(`list:${userId}:*`);
  }
}
