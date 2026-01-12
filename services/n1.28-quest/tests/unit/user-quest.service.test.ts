import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { UserQuestService } from '../../src/services/user-quest.service';
import { pool } from '../../src/config/database';
import { redis } from '../../src/config/redis';
import { QuestType, QuestStatus, UserQuestStatus } from '../../src/types';
import {
  NotFoundError,
  QuestNotAvailableError,
  QuestAlreadyAcceptedError
} from '../../src/utils/errors';

jest.mock('../../src/services/quest.service', () => ({
  questService: {
    getQuestById: jest.fn()
  }
}));

import { questService } from '../../src/services/quest.service';

describe('UserQuestService', () => {
  let userQuestService: UserQuestService;
  const mockPool = pool as jest.Mocked<typeof pool>;
  const mockRedis = redis as jest.Mocked<typeof redis>;
  const mockQuestService = questService as jest.Mocked<typeof questService>;

  const mockQuest = {
    id: 'quest-123',
    name: 'Test Quest',
    description: 'Test description',
    type: QuestType.DAILY,
    status: QuestStatus.ACTIVE,
    requiredLevel: 1,
    objectives: [
      {
        id: 'obj-1',
        questId: 'quest-123',
        type: 'kill' as const,
        description: 'Kill enemies',
        targetValue: 10,
        orderIndex: 0,
        isOptional: false
      }
    ],
    rewards: [
      {
        id: 'reward-1',
        questId: 'quest-123',
        type: 'xp' as const,
        value: 100
      }
    ],
    startsAt: new Date(Date.now() - 3600000),
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    userQuestService = new UserQuestService();
    jest.clearAllMocks();
  });

  describe('acceptQuest', () => {
    it('should accept a quest for a user', async () => {
      mockQuestService.getQuestById.mockResolvedValue(mockQuest);
      mockPool.query.mockResolvedValue({ rows: [] } as never);

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({
            rows: [{
              id: 'uq-1',
              user_id: 'user-123',
              quest_id: 'quest-123',
              status: UserQuestStatus.ACCEPTED,
              accepted_at: new Date(),
              completed_at: null,
              claimed_at: null,
              expires_at: mockQuest.expiresAt,
              created_at: new Date(),
              updated_at: new Date()
            }]
          })
          .mockResolvedValueOnce({
            rows: [{
              id: 'prog-1',
              user_quest_id: 'uq-1',
              objective_id: 'obj-1',
              current_value: 0,
              is_completed: false,
              updated_at: new Date()
            }]
          })
          .mockResolvedValueOnce(undefined),
        release: jest.fn()
      };

      mockPool.connect.mockResolvedValue(mockClient as never);
      mockRedis.del.mockResolvedValue(1 as never);

      const result = await userQuestService.acceptQuest('user-123', 'quest-123');

      expect(result.questId).toBe('quest-123');
      expect(result.status).toBe(UserQuestStatus.ACCEPTED);
      expect(result.progress).toHaveLength(1);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw QuestNotAvailableError if quest has not started', async () => {
      const futureQuest = {
        ...mockQuest,
        startsAt: new Date(Date.now() + 86400000)
      };
      mockQuestService.getQuestById.mockResolvedValue(futureQuest);

      await expect(
        userQuestService.acceptQuest('user-123', 'quest-123')
      ).rejects.toThrow('has not started yet');
    });

    it('should throw QuestNotAvailableError if quest has expired', async () => {
      const expiredQuest = {
        ...mockQuest,
        expiresAt: new Date(Date.now() - 3600000)
      };
      mockQuestService.getQuestById.mockResolvedValue(expiredQuest);

      await expect(
        userQuestService.acceptQuest('user-123', 'quest-123')
      ).rejects.toThrow('has expired');
    });

    it('should throw QuestAlreadyAcceptedError if quest already accepted', async () => {
      mockQuestService.getQuestById.mockResolvedValue(mockQuest);
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'existing-uq' }]
      } as never);

      await expect(
        userQuestService.acceptQuest('user-123', 'quest-123')
      ).rejects.toThrow('has already been accepted');
    });
  });

  describe('getUserQuests', () => {
    it('should return paginated user quests', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] } as never)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'uq-1',
              user_id: 'user-123',
              quest_id: 'quest-1',
              status: UserQuestStatus.IN_PROGRESS,
              accepted_at: new Date(),
              completed_at: null,
              claimed_at: null,
              expires_at: new Date(),
              created_at: new Date(),
              updated_at: new Date()
            },
            {
              id: 'uq-2',
              user_id: 'user-123',
              quest_id: 'quest-2',
              status: UserQuestStatus.COMPLETED,
              accepted_at: new Date(),
              completed_at: new Date(),
              claimed_at: null,
              expires_at: new Date(),
              created_at: new Date(),
              updated_at: new Date()
            }
          ]
        } as never)
        .mockResolvedValue({ rows: [] } as never);

      const result = await userQuestService.getUserQuests('user-123', { page: 1, limit: 10 });

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('updateProgress', () => {
    it('should update progress and mark quest as completed when all objectives done', async () => {
      const userQuest = {
        id: 'uq-1',
        oderId: 'user-123',
        questId: 'quest-123',
        status: UserQuestStatus.IN_PROGRESS,
        acceptedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        progress: [{
          id: 'prog-1',
          userQuestId: 'uq-1',
          objectiveId: 'obj-1',
          currentValue: 9,
          isCompleted: false,
          updatedAt: new Date()
        }]
      };

      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'uq-1',
            user_id: 'user-123',
            quest_id: 'quest-123',
            status: UserQuestStatus.IN_PROGRESS,
            accepted_at: new Date(),
            completed_at: null,
            claimed_at: null,
            expires_at: new Date(Date.now() + 86400000),
            created_at: new Date(),
            updated_at: new Date()
          }]
        } as never)
        .mockResolvedValueOnce({
          rows: [{
            id: 'prog-1',
            user_quest_id: 'uq-1',
            objective_id: 'obj-1',
            current_value: 9,
            is_completed: false,
            updated_at: new Date()
          }]
        } as never);

      mockQuestService.getQuestById.mockResolvedValue(mockQuest);

      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'prog-1',
            user_quest_id: 'uq-1',
            objective_id: 'obj-1',
            current_value: 9,
            is_completed: false,
            updated_at: new Date()
          }]
        } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never)
        .mockResolvedValueOnce({
          rows: [{
            id: 'prog-1',
            user_quest_id: 'uq-1',
            objective_id: 'obj-1',
            current_value: 10,
            is_completed: true,
            updated_at: new Date()
          }]
        } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never)
        .mockResolvedValueOnce({
          rows: [{
            id: 'uq-1',
            user_id: 'user-123',
            quest_id: 'quest-123',
            status: UserQuestStatus.COMPLETED,
            accepted_at: new Date(),
            completed_at: new Date(),
            claimed_at: null,
            expires_at: new Date(Date.now() + 86400000),
            created_at: new Date(),
            updated_at: new Date()
          }]
        } as never)
        .mockResolvedValue({
          rows: [{
            id: 'prog-1',
            user_quest_id: 'uq-1',
            objective_id: 'obj-1',
            current_value: 10,
            is_completed: true,
            updated_at: new Date()
          }]
        } as never);

      mockRedis.del.mockResolvedValue(1 as never);

      const result = await userQuestService.updateProgress('user-123', 'quest-123', {
        objectiveId: 'obj-1',
        incrementBy: 1
      });

      expect(result.status).toBe(UserQuestStatus.COMPLETED);
    });

    it('should throw NotFoundError if objective does not exist', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'uq-1',
            user_id: 'user-123',
            quest_id: 'quest-123',
            status: UserQuestStatus.IN_PROGRESS,
            accepted_at: new Date(),
            completed_at: null,
            claimed_at: null,
            expires_at: new Date(Date.now() + 86400000),
            created_at: new Date(),
            updated_at: new Date()
          }]
        } as never)
        .mockResolvedValue({ rows: [] } as never);

      mockQuestService.getQuestById.mockResolvedValue(mockQuest);

      await expect(
        userQuestService.updateProgress('user-123', 'quest-123', {
          objectiveId: 'nonexistent',
          incrementBy: 1
        })
      ).rejects.toThrow('not found');
    });
  });

  describe('expireUserQuests', () => {
    it('should expire quests past their expiration date', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'uq-1', user_id: 'user-1' },
          { id: 'uq-2', user_id: 'user-2' }
        ],
        rowCount: 2
      } as never);

      mockRedis.del.mockResolvedValue(1 as never);

      const result = await userQuestService.expireUserQuests();

      expect(result).toBe(2);
    });
  });

  describe('resetDailyQuests', () => {
    it('should reset daily quests', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 5 } as never);
      mockRedis.set.mockResolvedValue('OK' as never);

      await userQuestService.resetDailyQuests();

      expect(mockPool.query).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });

  describe('resetWeeklyQuests', () => {
    it('should reset weekly quests', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 3 } as never);
      mockRedis.set.mockResolvedValue('OK' as never);

      await userQuestService.resetWeeklyQuests();

      expect(mockPool.query).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });
});
