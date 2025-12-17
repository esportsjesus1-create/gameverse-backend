import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { QuestService } from '../../src/services/quest.service';
import { pool } from '../../src/config/database';
import { redis } from '../../src/config/redis';
import { QuestType, QuestStatus } from '../../src/types';
import { NotFoundError } from '../../src/utils/errors';

describe('QuestService', () => {
  let questService: QuestService;
  const mockPool = pool as jest.Mocked<typeof pool>;
  const mockRedis = redis as jest.Mocked<typeof redis>;

  beforeEach(() => {
    questService = new QuestService();
    jest.clearAllMocks();
  });

  describe('createQuest', () => {
    it('should create a quest with objectives and rewards', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({
            rows: [{
              id: 'quest-123',
              name: 'Daily Kill Quest',
              description: 'Kill 10 enemies',
              type: QuestType.DAILY,
              status: QuestStatus.ACTIVE,
              required_level: 1,
              starts_at: new Date(),
              expires_at: new Date(),
              created_at: new Date(),
              updated_at: new Date()
            }]
          })
          .mockResolvedValueOnce({
            rows: [{
              id: 'obj-1',
              quest_id: 'quest-123',
              type: 'kill',
              description: 'Kill enemies',
              target_value: 10,
              target_id: null,
              order_index: 0,
              is_optional: false
            }]
          })
          .mockResolvedValueOnce({
            rows: [{
              id: 'reward-1',
              quest_id: 'quest-123',
              type: 'xp',
              value: 100,
              item_id: null,
              metadata: null
            }]
          })
          .mockResolvedValueOnce(undefined),
        release: jest.fn()
      };

      mockPool.connect.mockResolvedValue(mockClient as never);
      mockRedis.del.mockResolvedValue(1 as never);

      const input = {
        name: 'Daily Kill Quest',
        description: 'Kill 10 enemies',
        type: QuestType.DAILY,
        objectives: [{
          type: 'kill' as const,
          description: 'Kill enemies',
          targetValue: 10
        }],
        rewards: [{
          type: 'xp' as const,
          value: 100
        }]
      };

      const result = await questService.createQuest(input);

      expect(result.id).toBe('quest-123');
      expect(result.name).toBe('Daily Kill Quest');
      expect(result.type).toBe(QuestType.DAILY);
      expect(result.objectives).toHaveLength(1);
      expect(result.rewards).toHaveLength(1);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('Database error')),
        release: jest.fn()
      };

      mockPool.connect.mockResolvedValue(mockClient as never);

      const input = {
        name: 'Test Quest',
        description: 'Test',
        type: QuestType.DAILY,
        objectives: [{ type: 'kill' as const, description: 'Test', targetValue: 1 }],
        rewards: [{ type: 'xp' as const, value: 100 }]
      };

      await expect(questService.createQuest(input)).rejects.toThrow('Database error');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getQuestById', () => {
    it('should return cached quest if available', async () => {
      const cachedQuest = {
        id: 'quest-123',
        name: 'Cached Quest',
        type: QuestType.DAILY,
        status: QuestStatus.ACTIVE,
        objectives: [],
        rewards: []
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedQuest) as never);

      const result = await questService.getQuestById('quest-123');

      expect(result.id).toBe('quest-123');
      expect(result.name).toBe('Cached Quest');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should fetch from database if not cached', async () => {
      mockRedis.get.mockResolvedValue(null as never);
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'quest-123',
            name: 'DB Quest',
            description: 'From database',
            type: QuestType.WEEKLY,
            status: QuestStatus.ACTIVE,
            required_level: 5,
            starts_at: new Date(),
            expires_at: new Date(),
            created_at: new Date(),
            updated_at: new Date()
          }]
        } as never)
        .mockResolvedValueOnce({ rows: [] } as never)
        .mockResolvedValueOnce({ rows: [] } as never);

      mockRedis.setex.mockResolvedValue('OK' as never);

      const result = await questService.getQuestById('quest-123');

      expect(result.id).toBe('quest-123');
      expect(result.name).toBe('DB Quest');
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should throw NotFoundError if quest does not exist', async () => {
      mockRedis.get.mockResolvedValue(null as never);
      mockPool.query.mockResolvedValue({ rows: [] } as never);

      await expect(questService.getQuestById('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('getQuests', () => {
    it('should return paginated quests with filters', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] } as never)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'quest-1',
              name: 'Quest 1',
              description: 'Desc 1',
              type: QuestType.DAILY,
              status: QuestStatus.ACTIVE,
              required_level: 1,
              starts_at: new Date(),
              expires_at: new Date(),
              created_at: new Date(),
              updated_at: new Date()
            },
            {
              id: 'quest-2',
              name: 'Quest 2',
              description: 'Desc 2',
              type: QuestType.DAILY,
              status: QuestStatus.ACTIVE,
              required_level: 1,
              starts_at: new Date(),
              expires_at: new Date(),
              created_at: new Date(),
              updated_at: new Date()
            }
          ]
        } as never)
        .mockResolvedValue({ rows: [] } as never);

      const result = await questService.getQuests(
        { type: QuestType.DAILY },
        { page: 1, limit: 10 }
      );

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('updateQuestStatus', () => {
    it('should update quest status and invalidate cache', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'quest-123',
            name: 'Quest',
            description: 'Desc',
            type: QuestType.DAILY,
            status: QuestStatus.INACTIVE,
            required_level: 1,
            starts_at: new Date(),
            expires_at: new Date(),
            created_at: new Date(),
            updated_at: new Date()
          }]
        } as never)
        .mockResolvedValue({ rows: [] } as never);

      mockRedis.del.mockResolvedValue(1 as never);

      const result = await questService.updateQuestStatus('quest-123', QuestStatus.INACTIVE);

      expect(result.status).toBe(QuestStatus.INACTIVE);
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should throw NotFoundError if quest does not exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as never);

      await expect(
        questService.updateQuestStatus('nonexistent', QuestStatus.INACTIVE)
      ).rejects.toThrow('not found');
    });
  });

  describe('deleteQuest', () => {
    it('should delete quest and invalidate cache', async () => {
      mockRedis.get.mockResolvedValue(null as never);
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'quest-123',
            name: 'Quest',
            description: 'Desc',
            type: QuestType.DAILY,
            status: QuestStatus.ACTIVE,
            required_level: 1,
            starts_at: new Date(),
            expires_at: new Date(),
            created_at: new Date(),
            updated_at: new Date()
          }]
        } as never)
        .mockResolvedValueOnce({ rows: [] } as never)
        .mockResolvedValueOnce({ rows: [] } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never);

      mockRedis.setex.mockResolvedValue('OK' as never);
      mockRedis.del.mockResolvedValue(1 as never);

      await questService.deleteQuest('quest-123');

      expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM quests WHERE id = $1', ['quest-123']);
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });
});
