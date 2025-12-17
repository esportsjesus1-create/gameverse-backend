import { query, queryOne, transaction } from '../config/database.js';
import { achievementCache } from '../config/redis.js';
import { config } from '../config/index.js';
import {
  Achievement,
  CreateAchievementInput,
  UpdateAchievementInput,
  AchievementCriteria,
  AchievementTier,
  AchievementRarity,
  AchievementType,
  AchievementCategory
} from '../types/achievement.types.js';
import { v4 as uuidv4 } from 'uuid';

interface AchievementRow {
  id: string;
  name: string;
  description: string;
  icon_url: string | null;
  points: number;
  rarity: AchievementRarity;
  type: AchievementType;
  category: AchievementCategory;
  criteria: AchievementCriteria;
  is_hidden: boolean;
  tiers: AchievementTier[] | null;
  created_at: Date;
  updated_at: Date;
}

function rowToAchievement(row: AchievementRow): Achievement {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    iconUrl: row.icon_url,
    points: row.points,
    rarity: row.rarity,
    type: row.type,
    category: row.category,
    criteria: row.criteria,
    isHidden: row.is_hidden,
    tiers: row.tiers,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class AchievementModel {
  private static readonly CACHE_KEY_ALL = 'all';
  private static readonly CACHE_KEY_PREFIX = 'id:';

  static async findAll(includeHidden: boolean = false): Promise<Achievement[]> {
    const cacheKey = includeHidden ? `${this.CACHE_KEY_ALL}:hidden` : this.CACHE_KEY_ALL;
    const cached = await achievementCache.get<Achievement[]>(cacheKey);
    if (cached) return cached;

    const sql = includeHidden
      ? 'SELECT * FROM achievements ORDER BY category, points DESC'
      : 'SELECT * FROM achievements WHERE is_hidden = false ORDER BY category, points DESC';

    const rows = await query<AchievementRow>(sql);
    const achievements = rows.map(rowToAchievement);

    await achievementCache.set(cacheKey, achievements, config.cache.achievementTtl);
    return achievements;
  }

  static async findById(id: string): Promise<Achievement | null> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}${id}`;
    const cached = await achievementCache.get<Achievement>(cacheKey);
    if (cached) return cached;

    const row = await queryOne<AchievementRow>(
      'SELECT * FROM achievements WHERE id = $1',
      [id]
    );

    if (!row) return null;

    const achievement = rowToAchievement(row);
    await achievementCache.set(cacheKey, achievement, config.cache.achievementTtl);
    return achievement;
  }

  static async findByCategory(category: AchievementCategory): Promise<Achievement[]> {
    const cacheKey = `category:${category}`;
    const cached = await achievementCache.get<Achievement[]>(cacheKey);
    if (cached) return cached;

    const rows = await query<AchievementRow>(
      'SELECT * FROM achievements WHERE category = $1 AND is_hidden = false ORDER BY points DESC',
      [category]
    );

    const achievements = rows.map(rowToAchievement);
    await achievementCache.set(cacheKey, achievements, config.cache.achievementTtl);
    return achievements;
  }

  static async create(input: CreateAchievementInput): Promise<Achievement> {
    const id = uuidv4();
    const now = new Date();

    const row = await queryOne<AchievementRow>(
      `INSERT INTO achievements (id, name, description, icon_url, points, rarity, type, category, criteria, is_hidden, tiers, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        id,
        input.name,
        input.description,
        input.iconUrl ?? null,
        input.points,
        input.rarity,
        input.type,
        input.category,
        JSON.stringify(input.criteria),
        input.isHidden,
        input.tiers ? JSON.stringify(input.tiers) : null,
        now,
        now
      ]
    );

    if (!row) {
      throw new Error('Failed to create achievement');
    }

    await this.invalidateCache();
    return rowToAchievement(row);
  }

  static async update(id: string, input: UpdateAchievementInput): Promise<Achievement | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.iconUrl !== undefined) {
      updates.push(`icon_url = $${paramIndex++}`);
      values.push(input.iconUrl);
    }
    if (input.points !== undefined) {
      updates.push(`points = $${paramIndex++}`);
      values.push(input.points);
    }
    if (input.rarity !== undefined) {
      updates.push(`rarity = $${paramIndex++}`);
      values.push(input.rarity);
    }
    if (input.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(input.type);
    }
    if (input.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(input.category);
    }
    if (input.criteria !== undefined) {
      updates.push(`criteria = $${paramIndex++}`);
      values.push(JSON.stringify(input.criteria));
    }
    if (input.isHidden !== undefined) {
      updates.push(`is_hidden = $${paramIndex++}`);
      values.push(input.isHidden);
    }
    if (input.tiers !== undefined) {
      updates.push(`tiers = $${paramIndex++}`);
      values.push(input.tiers ? JSON.stringify(input.tiers) : null);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id);

    const row = await queryOne<AchievementRow>(
      `UPDATE achievements SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (!row) return null;

    await this.invalidateCache(id);
    return rowToAchievement(row);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await transaction(async (client) => {
      await client.execute('DELETE FROM user_achievements WHERE achievement_id = $1', [id]);
      const deleted = await client.execute('DELETE FROM achievements WHERE id = $1', [id]);
      return deleted > 0;
    });

    if (result) {
      await this.invalidateCache(id);
    }
    return result;
  }

  static async count(): Promise<number> {
    const result = await queryOne<{ count: string }>('SELECT COUNT(*) as count FROM achievements');
    return result ? parseInt(result.count, 10) : 0;
  }

  static async getTotalPoints(): Promise<number> {
    const result = await queryOne<{ total: string }>('SELECT COALESCE(SUM(points), 0) as total FROM achievements');
    return result ? parseInt(result.total, 10) : 0;
  }

  private static async invalidateCache(id?: string): Promise<void> {
    await achievementCache.delete(this.CACHE_KEY_ALL);
    await achievementCache.delete(`${this.CACHE_KEY_ALL}:hidden`);
    await achievementCache.deletePattern('category:*');
    if (id) {
      await achievementCache.delete(`${this.CACHE_KEY_PREFIX}${id}`);
    }
  }
}
