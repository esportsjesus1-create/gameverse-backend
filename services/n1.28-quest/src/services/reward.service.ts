import { pool } from '../config/database';
import { redis, CACHE_KEYS } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  UserReward,
  UserQuestStatus,
  PaginationOptions,
  PaginatedResult
} from '../types';
import {
  QuestNotCompletedError,
  RewardAlreadyClaimedError
} from '../utils/errors';
import { questService } from './quest.service';
import { userQuestService } from './user-quest.service';

export class RewardService {
  async claimRewards(userId: string, questId: string): Promise<UserReward[]> {
    const userQuest = await userQuestService.getUserQuestByQuestId(userId, questId);

    if (userQuest.status !== UserQuestStatus.COMPLETED) {
      if (userQuest.status === UserQuestStatus.CLAIMED) {
        throw new RewardAlreadyClaimedError(questId);
      }
      throw new QuestNotCompletedError(questId);
    }

    const quest = await questService.getQuestById(questId);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const claimedRewards: UserReward[] = [];

      for (const reward of quest.rewards) {
        const rewardResult = await client.query<{
          id: string;
          user_id: string;
          quest_id: string;
          reward_id: string;
          type: string;
          value: number;
          item_id: string | null;
          metadata: Record<string, unknown> | null;
          claimed_at: Date;
        }>(
          `INSERT INTO user_rewards (user_id, quest_id, reward_id, type, value, item_id, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            userId,
            questId,
            reward.id,
            reward.type,
            reward.value,
            reward.itemId || null,
            reward.metadata ? JSON.stringify(reward.metadata) : null
          ]
        );

        claimedRewards.push(this.mapRewardRow(rewardResult.rows[0]));
      }

      await client.query(
        `UPDATE user_quests SET status = $1, claimed_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [UserQuestStatus.CLAIMED, userQuest.id]
      );

      await client.query('COMMIT');

      await this.invalidateUserRewardCache(userId);
      await redis.del(CACHE_KEYS.USER_QUESTS(userId));

      logger.info(`User ${userId} claimed rewards for quest ${questId}`);
      return claimedRewards;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserRewards(
    userId: string,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<UserReward>> {
    const offset = (pagination.page - 1) * pagination.limit;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM user_rewards WHERE user_id = $1`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const rewardsResult = await pool.query<{
      id: string;
      user_id: string;
      quest_id: string;
      reward_id: string;
      type: string;
      value: number;
      item_id: string | null;
      metadata: Record<string, unknown> | null;
      claimed_at: Date;
    }>(
      `SELECT * FROM user_rewards WHERE user_id = $1 ORDER BY claimed_at DESC LIMIT $2 OFFSET $3`,
      [userId, pagination.limit, offset]
    );

    const rewards = rewardsResult.rows.map((row) => this.mapRewardRow(row));

    return {
      data: rewards,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit)
    };
  }

  async getRecentRewards(userId: string, limit = 10): Promise<UserReward[]> {
    const cacheKey = CACHE_KEYS.USER_REWARDS(userId);
    const cached = await redis.get(cacheKey);
    if (cached) {
      const rewards = JSON.parse(cached) as UserReward[];
      return rewards.slice(0, limit);
    }

    const result = await pool.query<{
      id: string;
      user_id: string;
      quest_id: string;
      reward_id: string;
      type: string;
      value: number;
      item_id: string | null;
      metadata: Record<string, unknown> | null;
      claimed_at: Date;
    }>(
      `SELECT * FROM user_rewards WHERE user_id = $1 ORDER BY claimed_at DESC LIMIT $2`,
      [userId, limit]
    );

    const rewards = result.rows.map((row) => this.mapRewardRow(row));
    await redis.setex(cacheKey, config.quest.cacheTtl, JSON.stringify(rewards));

    return rewards;
  }

  async getRewardsByQuestId(userId: string, questId: string): Promise<UserReward[]> {
    const result = await pool.query<{
      id: string;
      user_id: string;
      quest_id: string;
      reward_id: string;
      type: string;
      value: number;
      item_id: string | null;
      metadata: Record<string, unknown> | null;
      claimed_at: Date;
    }>(
      `SELECT * FROM user_rewards WHERE user_id = $1 AND quest_id = $2`,
      [userId, questId]
    );

    return result.rows.map((row) => this.mapRewardRow(row));
  }

  async getTotalRewardsByType(
    userId: string,
    type: string
  ): Promise<{ type: string; totalValue: number; count: number }> {
    const result = await pool.query<{
      type: string;
      total_value: string;
      count: string;
    }>(
      `SELECT type, SUM(value) as total_value, COUNT(*) as count 
       FROM user_rewards 
       WHERE user_id = $1 AND type = $2
       GROUP BY type`,
      [userId, type]
    );

    if (result.rows.length === 0) {
      return { type, totalValue: 0, count: 0 };
    }

    return {
      type: result.rows[0].type,
      totalValue: parseInt(result.rows[0].total_value, 10),
      count: parseInt(result.rows[0].count, 10)
    };
  }

  async getRewardSummary(
    userId: string
  ): Promise<Array<{ type: string; totalValue: number; count: number }>> {
    const result = await pool.query<{
      type: string;
      total_value: string;
      count: string;
    }>(
      `SELECT type, SUM(value) as total_value, COUNT(*) as count 
       FROM user_rewards 
       WHERE user_id = $1
       GROUP BY type`,
      [userId]
    );

    return result.rows.map((row) => ({
      type: row.type,
      totalValue: parseInt(row.total_value, 10),
      count: parseInt(row.count, 10)
    }));
  }

  private async invalidateUserRewardCache(userId: string): Promise<void> {
    await redis.del(CACHE_KEYS.USER_REWARDS(userId));
  }

  private mapRewardRow(row: {
    id: string;
    user_id: string;
    quest_id: string;
    reward_id: string;
    type: string;
    value: number;
    item_id: string | null;
    metadata: Record<string, unknown> | null;
    claimed_at: Date;
  }): UserReward {
    return {
      id: row.id,
      oderId: row.user_id,
      questId: row.quest_id,
      rewardId: row.reward_id,
      type: row.type as UserReward['type'],
      value: row.value,
      itemId: row.item_id || undefined,
      claimedAt: row.claimed_at,
      metadata: row.metadata || undefined
    };
  }
}

export const rewardService = new RewardService();
