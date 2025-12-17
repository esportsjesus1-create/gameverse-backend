import request from 'supertest';
import { app } from '../../src/index';

describe('API Integration Tests', () => {
  describe('Health Endpoints', () => {
    it('GET /health should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('gameverse-season');
      expect(response.body.version).toBe('1.0.0');
    });

    it('GET /ready should return ready status', async () => {
      const response = await request(app).get('/ready');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ready');
    });
  });

  describe('Season Endpoints', () => {
    it.skip('GET /api/v1/seasons/active should return null when no active season (requires DB)', async () => {
      const response = await request(app).get('/api/v1/seasons/active');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('POST /api/v1/seasons should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/seasons')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('POST /api/v1/seasons should validate season number', async () => {
      const response = await request(app)
        .post('/api/v1/seasons')
        .send({
          name: 'Test Season',
          number: -1,
          startDate: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('GET /api/v1/seasons/:seasonId should validate UUID format', async () => {
      const response = await request(app).get('/api/v1/seasons/invalid-uuid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Player Endpoints', () => {
    it('POST /api/v1/players/mmr should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/players/mmr')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('POST /api/v1/players/mmr should validate UUID format for playerId', async () => {
      const response = await request(app)
        .post('/api/v1/players/mmr')
        .send({
          playerId: 'invalid',
          opponentId: '123e4567-e89b-12d3-a456-426614174000',
          isWin: true,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('POST /api/v1/players/mmr should validate isWin is boolean', async () => {
      const response = await request(app)
        .post('/api/v1/players/mmr')
        .send({
          playerId: '123e4567-e89b-12d3-a456-426614174000',
          opponentId: '123e4567-e89b-12d3-a456-426614174001',
          isWin: 'yes',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('GET /api/v1/players/:playerId/season/:seasonId/rank should validate UUIDs', async () => {
      const response = await request(app).get(
        '/api/v1/players/invalid/season/invalid/rank'
      );

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('GET /api/v1/players/:playerId/season/:seasonId/history should validate pagination', async () => {
      const playerId = '123e4567-e89b-12d3-a456-426614174000';
      const seasonId = '123e4567-e89b-12d3-a456-426614174001';

      const response = await request(app).get(
        `/api/v1/players/${playerId}/season/${seasonId}/history?page=-1`
      );

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Leaderboard Endpoints', () => {
    it('GET /api/v1/leaderboard/:seasonId should validate UUID format', async () => {
      const response = await request(app).get('/api/v1/leaderboard/invalid-uuid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('GET /api/v1/leaderboard/:seasonId should validate pagination params', async () => {
      const seasonId = '123e4567-e89b-12d3-a456-426614174000';

      const response = await request(app).get(
        `/api/v1/leaderboard/${seasonId}?limit=500`
      );

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/v1/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Resource not found');
    });
  });
});
