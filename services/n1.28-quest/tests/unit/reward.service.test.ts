import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { RewardService } from '../../src/services/reward.service';
import { pool } from '../../src/config/database';
import { redis } from '../../src/config/redis';
import { QuestType, QuestStatus, UserQuestStatus, RewardType } from '../../src/types';
import {
  QuestNotCompletedError,
  RewardAlreadyClaimedError
} from '../../src/utils/errors';

jest.mock('../../src/services/quest.service', () => ({
  questService: {
    getQuestById: jest.fn()
  }
}));

jest.mock('../../src/services/user-quest.service', () => ({
  userQuestService: {
    getUserQuestByQuestId: jest.fn()
  }
}));

import { questService } from '../../src/services/quest.service';
import { userQuestService } from '../../src/services/user-quest.service';

describe('RewardService', () => {
  let rewardService: RewardService;
  const mockPool = pool as jest.Mocked<typeof pool>;
  const mockRedis = redis as jest.Mocked<typeof redis>;
  const mockQuestService = questService as jest.Mocked<typeof questService>;
  const mockUserQuestService = userQuestService as jest.Mocked<typeof userQuestService>;

  const mockQuest = {
    id: 'quest-123',
    name: 'Test Quest',
    description: 'Test description',
    type: QuestType.DAILY,
    status: QuestStatus.ACTIVE,
    requiredLevel: 1,
    objectives: [],
    rewards: [
      {
        id: 'reward-1',
        questId: 'quest-123',
        type: RewardType.XP,
        value: 100
      },
      {
        id: 'reward-2',
        questId: 'quest-123',
        type: RewardType.CURRENCY,
        value: 50
      }
    ],
    startsAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockUserQuest = {
    id: 'uq-1',
    oderId: 'user-123',
    questId: 'quest-123',
    status: UserQuestStatus.COMPLETED,
    acceptedAt: new Date(),
    completedAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
    progress: []
  };

  beforeEach(() => {
    rewardService = new RewardService();
    jest.clearAllMocks();
  });

  describe('claimRewards', () => {
    it('should claim rewards for a completed quest', async () => {
      mockUserQuestService.getUserQuestByQuestId.mockResolvedValue(mockUserQuest);
      mockQuestService.getQuestById.mockResolvedValue(mockQuest);

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({
            rows: [{
              id: 'ur-1',
              user_id: 'user-123',
              quest_id: 'quest-123',
              reward_id: 'reward-1',
              type: RewardType.XP,
              value: 100,
              item_id: null,
              metadata: null,
              claimed_at: new Date()
            }]
          })
          .mockResolvedValueOnce({
            rows: [{
              id: 'ur-2',
              user_id: 'user-123',
              quest_id: 'quest-123',
              reward_id: 'reward-2',
              type: RewardType.CURRENCY,
              value: 50,
              item_id: null,
              metadata: null,
              claimed_at: new Date()
            }]
          })
          .mockResolvedValueOnce({ rowCount: 1 })
          .mockResolvedValueOnce(undefined),
        release: jest.fn()
      };

      mockPool.connect.mockResolvedValue(mockClient as never);
      mockRedis.del.mockResolvedValue(1 as never);

      const result = await rewardService.claimRewards('user-123', 'quest-123');

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe(RewardType.XP);
      expect(result[0].value).toBe(100);
      expect(result[1].type).toBe(RewardType.CURRENCY);
      expect(result[1].value).toBe(50);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw RewardAlreadyClaimedError if rewards already claimed', async () => {
      const claimedUserQuest = {
        ...mockUserQuest,
        status: UserQuestStatus.CLAIMED,
        claimedAt: new Date()
      };
      mockUserQuestService.getUserQuestByQuestId.mockResolvedValue(claimedUserQuest);

      await expect(
        rewardService.claimRewards('user-123', 'quest-123')
      ).rejects.toThrow('have already been claimed');
    });

    it('should throw QuestNotCompletedError if quest not completed', async () => {
      const inProgressUserQuest = {
        ...mockUserQuest,
        status: UserQuestStatus.IN_PROGRESS,
        completedAt: undefined
      };
      mockUserQuestService.getUserQuestByQuestId.mockResolvedValue(inProgressUserQuest);

      await expect(
        rewardService.claimRewards('user-123', 'quest-123')
      ).rejects.toThrow('is not completed yet');
    });

    it('should rollback on error', async () => {
      mockUserQuestService.getUserQuestByQuestId.mockResolvedValue(mockUserQuest);
      mockQuestService.getQuestById.mockResolvedValue(mockQuest);

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('Database error')),
        release: jest.fn()
      };

      mockPool.connect.mockResolvedValue(mockClient as never);

      await expect(
        rewardService.claimRewards('user-123', 'quest-123')
      ).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getUserRewards', () => {
    it('should return paginated user rewards', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] } as never)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'ur-1',
              user_id: 'user-123',
              quest_id: 'quest-1',
              reward_id: 'reward-1',
              type: RewardType.XP,
              value: 100,
              item_id: null,
              metadata: null,
              claimed_at: new Date()
            },
            {
              id: 'ur-2',
              user_id: 'user-123',
              quest_id: 'quest-2',
              reward_id: 'reward-2',
              type: RewardType.CURRENCY,
              value: 50,
              item_id: null,
              metadata: null,
              claimed_at: new Date()
            }
          ]
        } as never);

      const result = await rewardService.getUserRewards('user-123', { page: 1, limit: 10 });

      expect(result.total).toBe(5);
      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(1);
    });
  });

  describe('getRecentRewards', () => {
    it('should return cached rewards if available', async () => {
      const cachedRewards = [
        {
          id: 'ur-1',
          oderId: 'user-123',
          questId: 'quest-1',
          rewardId: 'reward-1',
          type: RewardType.XP,
          value: 100,
          claimedAt: new Date()
        }
      ];

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedRewards) as never);

      const result = await rewardService.getRecentRewards('user-123', 5);

      expect(result).toHaveLength(1);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should fetch from database if not cached', async () => {
      mockRedis.get.mockResolvedValue(null as never);
      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: 'ur-1',
            user_id: 'user-123',
            quest_id: 'quest-1',
            reward_id: 'reward-1',
            type: RewardType.XP,
            value: 100,
            item_id: null,
            metadata: null,
            claimed_at: new Date()
          }
        ]
      } as never);
      mockRedis.setex.mockResolvedValue('OK' as never);

      const result = await rewardService.getRecentRewards('user-123', 5);

      expect(result).toHaveLength(1);
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe('getRewardsByQuestId', () => {
    it('should return rewards for a specific quest', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: 'ur-1',
            user_id: 'user-123',
            quest_id: 'quest-123',
            reward_id: 'reward-1',
            type: RewardType.XP,
            value: 100,
            item_id: null,
            metadata: null,
            claimed_at: new Date()
          }
        ]
      } as never);

      const result = await rewardService.getRewardsByQuestId('user-123', 'quest-123');

      expect(result).toHaveLength(1);
      expect(result[0].questId).toBe('quest-123');
    });
  });

  describe('getTotalRewardsByType', () => {
    it('should return total rewards by type', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          type: RewardType.XP,
          total_value: '500',
          count: '5'
        }]
      } as never);

      const result = await rewardService.getTotalRewardsByType('user-123', RewardType.XP);

      expect(result.type).toBe(RewardType.XP);
      expect(result.totalValue).toBe(500);
      expect(result.count).toBe(5);
    });

    it('should return zero values if no rewards found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as never);

      const result = await rewardService.getTotalRewardsByType('user-123', RewardType.ITEM);

      expect(result.totalValue).toBe(0);
      expect(result.count).toBe(0);
    });
  });

  describe('getRewardSummary', () => {
    it('should return reward summary grouped by type', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { type: RewardType.XP, total_value: '500', count: '5' },
          { type: RewardType.CURRENCY, total_value: '200', count: '3' }
        ]
      } as never);

      const result = await rewardService.getRewardSummary('user-123');

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe(RewardType.XP);
      expect(result[0].totalValue).toBe(500);
      expect(result[1].type).toBe(RewardType.CURRENCY);
      expect(result[1].totalValue).toBe(200);
    });
  });
});
