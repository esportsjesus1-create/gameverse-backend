import { pool } from '../config/database';
import { redis, CACHE_KEYS } from '../config/redis';
import { User, UserStatus } from '../types';

export class UserService {
  async createUser(username: string, displayName: string, avatarUrl?: string): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (username, display_name, avatar_url, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [username, displayName, avatarUrl || null, UserStatus.OFFLINE]
    );

    return this.mapUserRow(result.rows[0]);
  }

  async getUser(userId: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) return null;
    return this.mapUserRow(result.rows[0]);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) return null;
    return this.mapUserRow(result.rows[0]);
  }

  async updateUser(userId: string, updates: Partial<Pick<User, 'displayName' | 'avatarUrl' | 'status'>>): Promise<User> {
    const updateFields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.displayName !== undefined) {
      updateFields.push(`display_name = $${paramIndex++}`);
      values.push(updates.displayName);
    }
    if (updates.avatarUrl !== undefined) {
      updateFields.push(`avatar_url = $${paramIndex++}`);
      values.push(updates.avatarUrl);
    }
    if (updates.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }

    if (updateFields.length === 0) {
      const user = await this.getUser(userId);
      if (!user) throw new Error('User not found');
      return user;
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const result = await pool.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return this.mapUserRow(result.rows[0]);
  }

  async setUserStatus(userId: string, status: UserStatus): Promise<void> {
    await pool.query(
      'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, userId]
    );

    if (status === UserStatus.ONLINE) {
      await redis.sadd(CACHE_KEYS.ONLINE_USERS, userId);
    } else {
      await redis.srem(CACHE_KEYS.ONLINE_USERS, userId);
    }
  }

  async getOnlineUsers(): Promise<string[]> {
    return redis.smembers(CACHE_KEYS.ONLINE_USERS);
  }

  async isUserOnline(userId: string): Promise<boolean> {
    return (await redis.sismember(CACHE_KEYS.ONLINE_USERS, userId)) === 1;
  }

  async searchUsers(query: string, limit: number = 20): Promise<User[]> {
    const result = await pool.query(
      `SELECT * FROM users 
       WHERE username ILIKE $1 OR display_name ILIKE $1
       ORDER BY username ASC
       LIMIT $2`,
      [`%${query}%`, limit]
    );

    return result.rows.map((row: Record<string, unknown>) => this.mapUserRow(row));
  }

  async deleteUser(userId: string): Promise<void> {
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await redis.srem(CACHE_KEYS.ONLINE_USERS, userId);
  }

  private mapUserRow(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      username: row.username as string,
      displayName: row.display_name as string,
      avatarUrl: row.avatar_url as string | undefined,
      status: row.status as UserStatus,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export const userService = new UserService();
