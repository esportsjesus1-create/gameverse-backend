import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/index';
import { QuestType, ObjectiveType, RewardType } from '../../src/types';

describe('Quest API Integration Tests', () => {
  describe('Health Endpoints', () => {
    it('GET /api/v1/health/live should return live status', async () => {
      const response = await request(app).get('/api/v1/health/live');
      expect(response.status).toBe(200);
      expect(response.body.live).toBe(true);
    });
  });

  describe('Quest Endpoints', () => {
    const testQuest = {
      name: 'Integration Test Quest',
      description: 'A quest for integration testing',
      type: QuestType.DAILY,
      requiredLevel: 1,
      objectives: [
        {
          type: ObjectiveType.KILL,
          description: 'Kill 5 enemies',
          targetValue: 5
        }
      ],
      rewards: [
        {
          type: RewardType.XP,
          value: 100
        }
      ]
    };

    it('POST /api/v1/quests should create a quest', async () => {
      const response = await request(app)
        .post('/api/v1/quests')
        .send(testQuest)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(testQuest.name);
      expect(response.body.data.type).toBe(QuestType.DAILY);
      expect(response.body.data.objectives).toHaveLength(1);
      expect(response.body.data.rewards).toHaveLength(1);
    });

    it('POST /api/v1/quests should validate required fields', async () => {
      const invalidQuest = {
        name: 'Invalid Quest'
      };

      const response = await request(app)
        .post('/api/v1/quests')
        .send(invalidQuest)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET /api/v1/quests should return paginated quests', async () => {
      const response = await request(app)
        .get('/api/v1/quests')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
    });

    it('GET /api/v1/quests should filter by type', async () => {
      const response = await request(app)
        .get('/api/v1/quests')
        .query({ type: QuestType.DAILY });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('GET /api/v1/quests/active should return active quests', async () => {
      const response = await request(app).get('/api/v1/quests/active');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('GET /api/v1/quests/:id should return 404 for non-existent quest', async () => {
      const response = await request(app)
        .get('/api/v1/quests/00000000-0000-0000-0000-000000000000');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('GET /api/v1/quests/:id should validate UUID format', async () => {
      const response = await request(app).get('/api/v1/quests/invalid-uuid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('User Quest Endpoints', () => {
    const userId = 'test-user-123';

    it('GET /api/v1/users/:userId/quests should return user quests', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${userId}/quests`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
    });

    it('GET /api/v1/users/:userId/quests/active should return active user quests', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${userId}/quests/active`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('POST /api/v1/users/:userId/quests/:questId/accept should return 404 for non-existent quest', async () => {
      const response = await request(app)
        .post(`/api/v1/users/${userId}/quests/00000000-0000-0000-0000-000000000000/accept`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('POST /api/v1/users/:userId/quests/:questId/progress should validate input', async () => {
      const response = await request(app)
        .post(`/api/v1/users/${userId}/quests/00000000-0000-0000-0000-000000000000/progress`)
        .send({})
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('POST /api/v1/users/:userId/quests/:questId/progress should validate objectiveId format', async () => {
      const response = await request(app)
        .post(`/api/v1/users/${userId}/quests/00000000-0000-0000-0000-000000000000/progress`)
        .send({
          objectiveId: 'invalid-uuid',
          incrementBy: 1
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Reward Endpoints', () => {
    const userId = 'test-user-123';

    it('GET /api/v1/users/:userId/rewards should return user rewards', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${userId}/rewards`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
    });

    it('GET /api/v1/users/:userId/rewards/recent should return recent rewards', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${userId}/rewards/recent`)
        .query({ limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('GET /api/v1/users/:userId/rewards/summary should return reward summary', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${userId}/rewards/summary`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('POST /api/v1/users/:userId/quests/:questId/claim should return 404 for non-existent quest', async () => {
      const response = await request(app)
        .post(`/api/v1/users/${userId}/quests/00000000-0000-0000-0000-000000000000/claim`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/v1/unknown');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/v1/quests')
        .send('invalid json')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });
  });
});
