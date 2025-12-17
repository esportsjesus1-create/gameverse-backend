import { query, queryOne } from '../config/database.js';
import { progressCache, statsCache } from '../config/redis.js';
import { config } from '../config/index.js';
import {
  UserAchievement,
  UserAchievementWithDetails,
  Achievement,
  AchievementCategory
} from '../types/achievement.types.js';
import { v4 as uuidv4 } from 'uuid';

interface UserAchievementRow {
  id: string;
  user_id: string;
  achievement_id: string;
  progress: number;
  current_tier: number;
  unlocked: boolean;
  unlocked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface UserAchievementWithDetailsRow extends UserAchievementRow {
  achievement_name: string;
  achievement_description: string;
  achievement_icon_url: string | null;
  achievement_points: number;
  achievement_rarity: string;
  achievement_type: string;
  achievement_category: string;
  achievement_criteria: object;
  achievement_is_hidden: boolean;
  achievement_tiers: object | null;
  achievement_created_at: Date;
  achievement_updated_at: Date;
}

function rowToUserAchievement(row: UserAchievementRow): UserAchievement {
  return {
    id: row.id,
    userId: row.user_id,
    achievementId: row.achievement_id,
    progress: row.progress,
    currentTier: row.current_tier,
    unlocked: row.unlocked,
    unlockedAt: row.unlocked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToUserAchievementWithDetails(row: UserAchievementWithDetailsRow): UserAchievementWithDetails {
  return {
    id: row.id,
    userId: row.user_id,
    achievementId: row.achievement_id,
    progress: row.progress,
    currentTier: row.current_tier,
    unlocked: row.unlocked,
    unlockedAt: row.unlocked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    achievement: {
      id: row.achievement_id,
      name: row.achievement_name,
      description: row.achievement_description,
      iconUrl: row.achievement_icon_url,
      points: row.achievement_points,
      rarity: row.achievement_rarity,
      type: row.achievement_type,
      category: row.achievement_category,
      criteria: row.achievement_criteria,
      isHidden: row.achievement_is_hidden,
      tiers: row.achievement_tiers,
      createdAt: row.achievement_created_at,
      updatedAt: row.achievement_updated_at
    } as Achievement
  };
}

export class UserAchievementModel {
  private static getCacheKey(userId: string, achievementId: string): string {
    return `${userId}:${achievementId}`;
  }

  static async findByUserAndAchievement(
    userId: string,
    achievementId: string
  ): Promise<UserAchievement | null> {
    const cacheKey = this.getCacheKey(userId, achievementId);
    const cached = await progressCache.get<UserAchievement>(cacheKey);
    if (cached) return cached;

    const row = await queryOne<UserAchievementRow>(
      'SELECT * FROM user_achievements WHERE user_id = $1 AND achievement_id = $2',
      [userId, achievementId]
    );

    if (!row) return null;

    const userAchievement = rowToUserAchievement(row);
    await progressCache.set(cacheKey, userAchievement, config.cache.progressTtl);
    return userAchievement;
  }

  static async findAllByUser(userId: string): Promise<UserAchievementWithDetails[]> {
    const rows = await query<UserAchievementWithDetailsRow>(
      `SELECT 
        ua.*,
        a.name as achievement_name,
        a.description as achievement_description,
        a.icon_url as achievement_icon_url,
        a.points as achievement_points,
        a.rarity as achievement_rarity,
        a.type as achievement_type,
        a.category as achievement_category,
        a.criteria as achievement_criteria,
        a.is_hidden as achievement_is_hidden,
        a.tiers as achievement_tiers,
        a.created_at as achievement_created_at,
        a.updated_at as achievement_updated_at
      FROM user_achievements ua
      JOIN achievements a ON ua.achievement_id = a.id
      WHERE ua.user_id = $1
      ORDER BY ua.unlocked DESC, ua.unlocked_at DESC NULLS LAST`,
      [userId]
    );

    return rows.map(rowToUserAchievementWithDetails);
  }

  static async findUnlockedByUser(userId: string): Promise<UserAchievementWithDetails[]> {
    const rows = await query<UserAchievementWithDetailsRow>(
      `SELECT 
        ua.*,
        a.name as achievement_name,
        a.description as achievement_description,
        a.icon_url as achievement_icon_url,
        a.points as achievement_points,
        a.rarity as achievement_rarity,
        a.type as achievement_type,
        a.category as achievement_category,
        a.criteria as achievement_criteria,
        a.is_hidden as achievement_is_hidden,
        a.tiers as achievement_tiers,
        a.created_at as achievement_created_at,
        a.updated_at as achievement_updated_at
      FROM user_achievements ua
      JOIN achievements a ON ua.achievement_id = a.id
      WHERE ua.user_id = $1 AND ua.unlocked = true
      ORDER BY ua.unlocked_at DESC`,
      [userId]
    );

    return rows.map(rowToUserAchievementWithDetails);
  }

  static async findRecentUnlocks(userId: string, limit: number = 5): Promise<UserAchievementWithDetails[]> {
    const rows = await query<UserAchievementWithDetailsRow>(
      `SELECT 
        ua.*,
        a.name as achievement_name,
        a.description as achievement_description,
        a.icon_url as achievement_icon_url,
        a.points as achievement_points,
        a.rarity as achievement_rarity,
        a.type as achievement_type,
        a.category as achievement_category,
        a.criteria as achievement_criteria,
        a.is_hidden as achievement_is_hidden,
        a.tiers as achievement_tiers,
        a.created_at as achievement_created_at,
        a.updated_at as achievement_updated_at
      FROM user_achievements ua
      JOIN achievements a ON ua.achievement_id = a.id
      WHERE ua.user_id = $1 AND ua.unlocked = true
      ORDER BY ua.unlocked_at DESC
      LIMIT $2`,
      [userId, limit]
    );

    return rows.map(rowToUserAchievementWithDetails);
  }

  static async create(
    userId: string,
    achievementId: string,
    progress: number = 0
  ): Promise<UserAchievement> {
    const id = uuidv4();
    const now = new Date();

    const row = await queryOne<UserAchievementRow>(
      `INSERT INTO user_achievements (id, user_id, achievement_id, progress, current_tier, unlocked, unlocked_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, userId, achievementId, progress, 0, false, null, now, now]
    );

    if (!row) {
      throw new Error('Failed to create user achievement');
    }

    const userAchievement = rowToUserAchievement(row);
    await this.invalidateCache(userId, achievementId);
    return userAchievement;
  }

  static async updateProgress(
    userId: string,
    achievementId: string,
    progress: number,
    currentTier: number = 0
  ): Promise<UserAchievement | null> {
    const row = await queryOne<UserAchievementRow>(
      `UPDATE user_achievements 
       SET progress = $1, current_tier = $2, updated_at = $3
       WHERE user_id = $4 AND achievement_id = $5
       RETURNING *`,
      [progress, currentTier, new Date(), userId, achievementId]
    );

    if (!row) return null;

    const userAchievement = rowToUserAchievement(row);
    await this.invalidateCache(userId, achievementId);
    return userAchievement;
  }

  static async unlock(userId: string, achievementId: string): Promise<UserAchievement | null> {
    const now = new Date();
    const row = await queryOne<UserAchievementRow>(
      `UPDATE user_achievements 
       SET unlocked = true, unlocked_at = $1, updated_at = $2
       WHERE user_id = $3 AND achievement_id = $4 AND unlocked = false
       RETURNING *`,
      [now, now, userId, achievementId]
    );

    if (!row) return null;

    const userAchievement = rowToUserAchievement(row);
    await this.invalidateCache(userId, achievementId);
    return userAchievement;
  }

  static async getOrCreate(userId: string, achievementId: string): Promise<UserAchievement> {
    const existing = await this.findByUserAndAchievement(userId, achievementId);
    if (existing) return existing;
    return this.create(userId, achievementId);
  }

  static async countUnlockedByUser(userId: string): Promise<number> {
    const result = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM user_achievements WHERE user_id = $1 AND unlocked = true',
      [userId]
    );
    return result ? parseInt(result.count, 10) : 0;
  }

  static async getEarnedPointsByUser(userId: string): Promise<number> {
    const result = await queryOne<{ total: string }>(
      `SELECT COALESCE(SUM(a.points), 0) as total
       FROM user_achievements ua
       JOIN achievements a ON ua.achievement_id = a.id
       WHERE ua.user_id = $1 AND ua.unlocked = true`,
      [userId]
    );
    return result ? parseInt(result.total, 10) : 0;
  }

  static async getCategoryBreakdown(
    userId: string
  ): Promise<Record<AchievementCategory, { total: number; unlocked: number }>> {
    const rows = await query<{
      category: AchievementCategory;
      total: string;
      unlocked: string;
    }>(
      `SELECT 
        a.category,
        COUNT(DISTINCT a.id) as total,
        COUNT(DISTINCT CASE WHEN ua.unlocked = true THEN ua.id END) as unlocked
       FROM achievements a
       LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
       GROUP BY a.category`,
      [userId]
    );

    const breakdown: Record<string, { total: number; unlocked: number }> = {};
    for (const category of Object.values(AchievementCategory)) {
      breakdown[category] = { total: 0, unlocked: 0 };
    }

    for (const row of rows) {
      breakdown[row.category] = {
        total: parseInt(row.total, 10),
        unlocked: parseInt(row.unlocked, 10)
      };
    }

    return breakdown as Record<AchievementCategory, { total: number; unlocked: number }>;
  }

  private static async invalidateCache(userId: string, achievementId: string): Promise<void> {
    await progressCache.delete(this.getCacheKey(userId, achievementId));
    await statsCache.delete(`user:${userId}`);
  }
}
