import { pool } from '../config/database';
import { redis, CACHE_KEYS } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  UserQuest,
  UserQuestProgress,
  UserQuestStatus,
  QuestType,
  QuestStatus,
  UpdateProgressInput,
  PaginationOptions,
  PaginatedResult
} from '../types';
import {
  NotFoundError,
  QuestNotAvailableError,
  QuestAlreadyAcceptedError
} from '../utils/errors';
import { questService } from './quest.service';

export class UserQuestService {
  async acceptQuest(userId: string, questId: string): Promise<UserQuest> {
    const quest = await questService.getQuestById(questId);

    const now = new Date();
    if (quest.startsAt > now) {
      throw new QuestNotAvailableError(questId, 'Quest has not started yet');
    }
    if (quest.expiresAt && quest.expiresAt < now) {
      throw new QuestNotAvailableError(questId, 'Quest has expired');
    }
    if (quest.status !== QuestStatus.ACTIVE) {
      throw new QuestNotAvailableError(questId, 'Quest is not active');
    }

    const existingResult = await pool.query<{ id: string }>(
      `SELECT id FROM user_quests WHERE user_id = $1 AND quest_id = $2`,
      [userId, questId]
    );

    if (existingResult.rows.length > 0) {
      throw new QuestAlreadyAcceptedError(questId);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userQuestResult = await client.query<{
        id: string;
        user_id: string;
        quest_id: string;
        status: UserQuestStatus;
        accepted_at: Date;
        completed_at: Date | null;
        claimed_at: Date | null;
        expires_at: Date;
        created_at: Date;
        updated_at: Date;
      }>(
        `INSERT INTO user_quests (user_id, quest_id, status, expires_at)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, questId, UserQuestStatus.ACCEPTED, quest.expiresAt]
      );

      const userQuest = userQuestResult.rows[0];

      const progress: UserQuestProgress[] = [];
      for (const objective of quest.objectives) {
        const progressResult = await client.query<{
          id: string;
          user_quest_id: string;
          objective_id: string;
          current_value: number;
          is_completed: boolean;
          updated_at: Date;
        }>(
          `INSERT INTO user_quest_progress (user_quest_id, objective_id, current_value, is_completed)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [userQuest.id, objective.id, 0, false]
        );
        progress.push(this.mapProgressRow(progressResult.rows[0]));
      }

      await client.query('COMMIT');

      await this.invalidateUserQuestCache(userId);

      logger.info(`User ${userId} accepted quest ${questId}`);
      return this.mapUserQuestRow(userQuest, progress);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserQuests(
    userId: string,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<UserQuest>> {
    const offset = (pagination.page - 1) * pagination.limit;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM user_quests WHERE user_id = $1`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const userQuestsResult = await pool.query<{
      id: string;
      user_id: string;
      quest_id: string;
      status: UserQuestStatus;
      accepted_at: Date;
      completed_at: Date | null;
      claimed_at: Date | null;
      expires_at: Date;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM user_quests WHERE user_id = $1 ORDER BY accepted_at DESC LIMIT $2 OFFSET $3`,
      [userId, pagination.limit, offset]
    );

    const userQuests: UserQuest[] = [];
    for (const row of userQuestsResult.rows) {
      const progress = await this.getQuestProgress(row.id);
      userQuests.push(this.mapUserQuestRow(row, progress));
    }

    return {
      data: userQuests,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit)
    };
  }

  async getUserQuestByQuestId(userId: string, questId: string): Promise<UserQuest> {
    const result = await pool.query<{
      id: string;
      user_id: string;
      quest_id: string;
      status: UserQuestStatus;
      accepted_at: Date;
      completed_at: Date | null;
      claimed_at: Date | null;
      expires_at: Date;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM user_quests WHERE user_id = $1 AND quest_id = $2`,
      [userId, questId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('UserQuest');
    }

    const progress = await this.getQuestProgress(result.rows[0].id);
    return this.mapUserQuestRow(result.rows[0], progress);
  }

  async updateProgress(
    userId: string,
    questId: string,
    input: UpdateProgressInput
  ): Promise<UserQuest> {
    const userQuest = await this.getUserQuestByQuestId(userId, questId);

    if (
      userQuest.status === UserQuestStatus.COMPLETED ||
      userQuest.status === UserQuestStatus.CLAIMED ||
      userQuest.status === UserQuestStatus.EXPIRED
    ) {
      throw new QuestNotAvailableError(questId, `Quest is already ${userQuest.status}`);
    }

    const quest = await questService.getQuestById(questId);
    const objective = quest.objectives.find((o) => o.id === input.objectiveId);
    if (!objective) {
      throw new NotFoundError('Objective', input.objectiveId);
    }

    const progressResult = await pool.query<{
      id: string;
      user_quest_id: string;
      objective_id: string;
      current_value: number;
      is_completed: boolean;
      updated_at: Date;
    }>(
      `SELECT * FROM user_quest_progress WHERE user_quest_id = $1 AND objective_id = $2`,
      [userQuest.id, input.objectiveId]
    );

    if (progressResult.rows.length === 0) {
      throw new NotFoundError('Progress');
    }

    const currentProgress = progressResult.rows[0];
    let newValue: number;

    if (input.setValue !== undefined) {
      newValue = input.setValue;
    } else if (input.incrementBy !== undefined) {
      newValue = currentProgress.current_value + input.incrementBy;
    } else {
      newValue = currentProgress.current_value;
    }

    const isCompleted = newValue >= objective.targetValue;

    await pool.query(
      `UPDATE user_quest_progress 
       SET current_value = $1, is_completed = $2, updated_at = NOW() 
       WHERE id = $3`,
      [newValue, isCompleted, currentProgress.id]
    );

    const allProgress = await this.getQuestProgress(userQuest.id);
    const requiredObjectives = quest.objectives.filter((o) => !o.isOptional);
    const allRequiredCompleted = requiredObjectives.every((obj) => {
      const prog = allProgress.find((p) => p.objectiveId === obj.id);
      return prog?.isCompleted;
    });

    let newStatus = UserQuestStatus.IN_PROGRESS;
    if (allRequiredCompleted) {
      newStatus = UserQuestStatus.COMPLETED;
      await pool.query(
        `UPDATE user_quests SET status = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [newStatus, userQuest.id]
      );
      logger.info(`User ${userId} completed quest ${questId}`);
    } else {
      await pool.query(
        `UPDATE user_quests SET status = $1, updated_at = NOW() WHERE id = $2`,
        [newStatus, userQuest.id]
      );
    }

    await this.invalidateUserQuestCache(userId);

    return this.getUserQuestByQuestId(userId, questId);
  }

  async getActiveUserQuests(userId: string): Promise<UserQuest[]> {
    const cacheKey = CACHE_KEYS.USER_QUESTS(userId);
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as UserQuest[];
    }

    const result = await pool.query<{
      id: string;
      user_id: string;
      quest_id: string;
      status: UserQuestStatus;
      accepted_at: Date;
      completed_at: Date | null;
      claimed_at: Date | null;
      expires_at: Date;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM user_quests 
       WHERE user_id = $1 
       AND status IN ($2, $3, $4)
       ORDER BY accepted_at DESC`,
      [userId, UserQuestStatus.ACCEPTED, UserQuestStatus.IN_PROGRESS, UserQuestStatus.COMPLETED]
    );

    const userQuests: UserQuest[] = [];
    for (const row of result.rows) {
      const progress = await this.getQuestProgress(row.id);
      userQuests.push(this.mapUserQuestRow(row, progress));
    }

    await redis.setex(cacheKey, config.quest.cacheTtl, JSON.stringify(userQuests));
    return userQuests;
  }

  async expireUserQuests(): Promise<number> {
    const result = await pool.query<{ id: string; user_id: string }>(
      `UPDATE user_quests 
       SET status = $1, updated_at = NOW() 
       WHERE status IN ($2, $3, $4) 
       AND expires_at < NOW()
       RETURNING id, user_id`,
      [
        UserQuestStatus.EXPIRED,
        UserQuestStatus.ACCEPTED,
        UserQuestStatus.IN_PROGRESS,
        UserQuestStatus.COMPLETED
      ]
    );

    const userIds = [...new Set(result.rows.map((r) => r.user_id))];
    for (const oderId of userIds) {
      await this.invalidateUserQuestCache(oderId);
    }

    logger.info(`Expired ${result.rowCount} user quests`);
    return result.rowCount || 0;
  }

  async resetDailyQuests(): Promise<void> {
    await pool.query(
      `UPDATE user_quests uq
       SET status = $1, updated_at = NOW()
       FROM quests q
       WHERE uq.quest_id = q.id
       AND q.type = $2
       AND uq.status IN ($3, $4)`,
      [UserQuestStatus.EXPIRED, QuestType.DAILY, UserQuestStatus.ACCEPTED, UserQuestStatus.IN_PROGRESS]
    );

    await redis.set(CACHE_KEYS.DAILY_RESET, new Date().toISOString());
    logger.info('Daily quests reset completed');
  }

  async resetWeeklyQuests(): Promise<void> {
    await pool.query(
      `UPDATE user_quests uq
       SET status = $1, updated_at = NOW()
       FROM quests q
       WHERE uq.quest_id = q.id
       AND q.type = $2
       AND uq.status IN ($3, $4)`,
      [UserQuestStatus.EXPIRED, QuestType.WEEKLY, UserQuestStatus.ACCEPTED, UserQuestStatus.IN_PROGRESS]
    );

    await redis.set(CACHE_KEYS.WEEKLY_RESET, new Date().toISOString());
    logger.info('Weekly quests reset completed');
  }

  private async getQuestProgress(userQuestId: string): Promise<UserQuestProgress[]> {
    const result = await pool.query<{
      id: string;
      user_quest_id: string;
      objective_id: string;
      current_value: number;
      is_completed: boolean;
      updated_at: Date;
    }>(
      `SELECT * FROM user_quest_progress WHERE user_quest_id = $1`,
      [userQuestId]
    );
    return result.rows.map((row) => this.mapProgressRow(row));
  }

  private async invalidateUserQuestCache(userId: string): Promise<void> {
    await redis.del(CACHE_KEYS.USER_QUESTS(userId));
  }

  private mapUserQuestRow(
    row: {
      id: string;
      user_id: string;
      quest_id: string;
      status: UserQuestStatus;
      accepted_at: Date;
      completed_at: Date | null;
      claimed_at: Date | null;
      expires_at: Date;
      created_at: Date;
      updated_at: Date;
    },
    progress: UserQuestProgress[]
  ): UserQuest {
    return {
      id: row.id,
      oderId: row.user_id,
      questId: row.quest_id,
      status: row.status,
      acceptedAt: row.accepted_at,
      completedAt: row.completed_at || undefined,
      claimedAt: row.claimed_at || undefined,
      expiresAt: row.expires_at,
      progress
    };
  }

  private mapProgressRow(row: {
    id: string;
    user_quest_id: string;
    objective_id: string;
    current_value: number;
    is_completed: boolean;
    updated_at: Date;
  }): UserQuestProgress {
    return {
      id: row.id,
      userQuestId: row.user_quest_id,
      objectiveId: row.objective_id,
      currentValue: row.current_value,
      isCompleted: row.is_completed,
      updatedAt: row.updated_at
    };
  }
}

export const userQuestService = new UserQuestService();
