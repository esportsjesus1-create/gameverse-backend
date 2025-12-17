import { pool } from '../config/database';
import { redis, CACHE_KEYS } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  Quest,
  QuestObjective,
  QuestReward,
  QuestType,
  QuestStatus,
  QuestFilter,
  PaginationOptions,
  PaginatedResult,
  CreateQuestInput
} from '../types';
import { NotFoundError } from '../utils/errors';

export class QuestService {
  async createQuest(input: CreateQuestInput): Promise<Quest> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
      const expiresAt = input.expiresAt
        ? new Date(input.expiresAt)
        : this.calculateExpiration(input.type, startsAt);

      const questResult = await client.query<{
        id: string;
        name: string;
        description: string;
        type: QuestType;
        status: QuestStatus;
        required_level: number;
        starts_at: Date;
        expires_at: Date;
        created_at: Date;
        updated_at: Date;
      }>(
        `INSERT INTO quests (name, description, type, status, required_level, starts_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          input.name,
          input.description || '',
          input.type,
          QuestStatus.ACTIVE,
          input.requiredLevel || 1,
          startsAt,
          expiresAt
        ]
      );

      const quest = questResult.rows[0];

      const objectives: QuestObjective[] = [];
      for (let i = 0; i < input.objectives.length; i++) {
        const obj = input.objectives[i];
        const objResult = await client.query<{
          id: string;
          quest_id: string;
          type: string;
          description: string;
          target_value: number;
          target_id: string | null;
          order_index: number;
          is_optional: boolean;
        }>(
          `INSERT INTO quest_objectives (quest_id, type, description, target_value, target_id, order_index, is_optional)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            quest.id,
            obj.type,
            obj.description || '',
            obj.targetValue,
            obj.targetId || null,
            obj.orderIndex ?? i,
            obj.isOptional || false
          ]
        );
        objectives.push(this.mapObjectiveRow(objResult.rows[0]));
      }

      const rewards: QuestReward[] = [];
      for (const reward of input.rewards) {
        const rewardResult = await client.query<{
          id: string;
          quest_id: string;
          type: string;
          value: number;
          item_id: string | null;
          metadata: Record<string, unknown> | null;
        }>(
          `INSERT INTO quest_rewards (quest_id, type, value, item_id, metadata)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            quest.id,
            reward.type,
            reward.value,
            reward.itemId || null,
            reward.metadata ? JSON.stringify(reward.metadata) : null
          ]
        );
        rewards.push(this.mapRewardRow(rewardResult.rows[0]));
      }

      await client.query('COMMIT');

      const fullQuest = this.mapQuestRow(quest, objectives, rewards);
      await this.invalidateQuestCache(input.type);

      logger.info(`Quest created: ${fullQuest.id}`);
      return fullQuest;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getQuestById(id: string): Promise<Quest> {
    const cacheKey = CACHE_KEYS.QUEST(id);
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Quest;
    }

    const questResult = await pool.query<{
      id: string;
      name: string;
      description: string;
      type: QuestType;
      status: QuestStatus;
      required_level: number;
      starts_at: Date;
      expires_at: Date;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM quests WHERE id = $1', [id]);

    if (questResult.rows.length === 0) {
      throw new NotFoundError('Quest', id);
    }

    const objectives = await this.getQuestObjectives(id);
    const rewards = await this.getQuestRewards(id);

    const quest = this.mapQuestRow(questResult.rows[0], objectives, rewards);
    await redis.setex(cacheKey, config.quest.cacheTtl, JSON.stringify(quest));

    return quest;
  }

  async getQuests(
    filter: QuestFilter,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<Quest>> {
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (filter.type) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(filter.type);
    }
    if (filter.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filter.status);
    }
    if (filter.minLevel !== undefined) {
      conditions.push(`required_level >= $${paramIndex++}`);
      params.push(filter.minLevel);
    }
    if (filter.maxLevel !== undefined) {
      conditions.push(`required_level <= $${paramIndex++}`);
      params.push(filter.maxLevel);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (pagination.page - 1) * pagination.limit;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM quests ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const questsResult = await pool.query<{
      id: string;
      name: string;
      description: string;
      type: QuestType;
      status: QuestStatus;
      required_level: number;
      starts_at: Date;
      expires_at: Date;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM quests ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, pagination.limit, offset]
    );

    const quests: Quest[] = [];
    for (const row of questsResult.rows) {
      const objectives = await this.getQuestObjectives(row.id);
      const rewards = await this.getQuestRewards(row.id);
      quests.push(this.mapQuestRow(row, objectives, rewards));
    }

    return {
      data: quests,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit)
    };
  }

  async getActiveQuests(type?: QuestType): Promise<Quest[]> {
    const cacheKey = CACHE_KEYS.QUESTS_LIST(type);
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Quest[];
    }

    const now = new Date();
    const params: (string | Date)[] = [now, now];
    let typeCondition = '';

    if (type) {
      typeCondition = 'AND type = $3';
      params.push(type);
    }

    const result = await pool.query<{
      id: string;
      name: string;
      description: string;
      type: QuestType;
      status: QuestStatus;
      required_level: number;
      starts_at: Date;
      expires_at: Date;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM quests 
       WHERE status = 'active' 
       AND starts_at <= $1 
       AND (expires_at IS NULL OR expires_at > $2)
       ${typeCondition}
       ORDER BY created_at DESC`,
      params
    );

    const quests: Quest[] = [];
    for (const row of result.rows) {
      const objectives = await this.getQuestObjectives(row.id);
      const rewards = await this.getQuestRewards(row.id);
      quests.push(this.mapQuestRow(row, objectives, rewards));
    }

    await redis.setex(cacheKey, config.quest.cacheTtl, JSON.stringify(quests));
    return quests;
  }

  async updateQuestStatus(id: string, status: QuestStatus): Promise<Quest> {
    const result = await pool.query<{
      id: string;
      name: string;
      description: string;
      type: QuestType;
      status: QuestStatus;
      required_level: number;
      starts_at: Date;
      expires_at: Date;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE quests SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Quest', id);
    }

    const objectives = await this.getQuestObjectives(id);
    const rewards = await this.getQuestRewards(id);
    const quest = this.mapQuestRow(result.rows[0], objectives, rewards);

    await this.invalidateQuestCache(quest.type);
    await redis.del(CACHE_KEYS.QUEST(id));

    return quest;
  }

  async deleteQuest(id: string): Promise<void> {
    const quest = await this.getQuestById(id);
    await pool.query('DELETE FROM quests WHERE id = $1', [id]);
    await this.invalidateQuestCache(quest.type);
    await redis.del(CACHE_KEYS.QUEST(id));
    logger.info(`Quest deleted: ${id}`);
  }

  private async getQuestObjectives(questId: string): Promise<QuestObjective[]> {
    const result = await pool.query<{
      id: string;
      quest_id: string;
      type: string;
      description: string;
      target_value: number;
      target_id: string | null;
      order_index: number;
      is_optional: boolean;
    }>(
      'SELECT * FROM quest_objectives WHERE quest_id = $1 ORDER BY order_index',
      [questId]
    );
    return result.rows.map((row) => this.mapObjectiveRow(row));
  }

  private async getQuestRewards(questId: string): Promise<QuestReward[]> {
    const result = await pool.query<{
      id: string;
      quest_id: string;
      type: string;
      value: number;
      item_id: string | null;
      metadata: Record<string, unknown> | null;
    }>('SELECT * FROM quest_rewards WHERE quest_id = $1', [questId]);
    return result.rows.map((row) => this.mapRewardRow(row));
  }

  private calculateExpiration(type: QuestType, startsAt: Date): Date {
    const expiration = new Date(startsAt);
    if (type === QuestType.DAILY) {
      expiration.setUTCDate(expiration.getUTCDate() + 1);
      expiration.setUTCHours(config.quest.dailyResetHour, 0, 0, 0);
    } else if (type === QuestType.WEEKLY) {
      const daysUntilReset = (7 - expiration.getUTCDay() + config.quest.weeklyResetDay) % 7 || 7;
      expiration.setUTCDate(expiration.getUTCDate() + daysUntilReset);
      expiration.setUTCHours(0, 0, 0, 0);
    } else {
      expiration.setUTCDate(expiration.getUTCDate() + 30);
    }
    return expiration;
  }

  private async invalidateQuestCache(type: QuestType): Promise<void> {
    await redis.del(CACHE_KEYS.QUESTS_LIST(type));
    await redis.del(CACHE_KEYS.QUESTS_LIST());
  }

  private mapQuestRow(
    row: {
      id: string;
      name: string;
      description: string;
      type: QuestType;
      status: QuestStatus;
      required_level: number;
      starts_at: Date;
      expires_at: Date;
      created_at: Date;
      updated_at: Date;
    },
    objectives: QuestObjective[],
    rewards: QuestReward[]
  ): Quest {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      status: row.status,
      requiredLevel: row.required_level,
      objectives,
      rewards,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapObjectiveRow(row: {
    id: string;
    quest_id: string;
    type: string;
    description: string;
    target_value: number;
    target_id: string | null;
    order_index: number;
    is_optional: boolean;
  }): QuestObjective {
    return {
      id: row.id,
      questId: row.quest_id,
      type: row.type as QuestObjective['type'],
      description: row.description,
      targetValue: row.target_value,
      targetId: row.target_id || undefined,
      orderIndex: row.order_index,
      isOptional: row.is_optional
    };
  }

  private mapRewardRow(row: {
    id: string;
    quest_id: string;
    type: string;
    value: number;
    item_id: string | null;
    metadata: Record<string, unknown> | null;
  }): QuestReward {
    return {
      id: row.id,
      questId: row.quest_id,
      type: row.type as QuestReward['type'],
      value: row.value,
      itemId: row.item_id || undefined,
      metadata: row.metadata || undefined
    };
  }
}

export const questService = new QuestService();
