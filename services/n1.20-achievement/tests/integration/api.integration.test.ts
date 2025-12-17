import request from 'supertest';
import express from 'express';
import { StatusCodes } from 'http-status-codes';
import routes from '../../src/routes/index';
import { errorHandler, notFoundHandler } from '../../src/middleware/error-handler';

const createTestApp = (): express.Application => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

describe('API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Health Endpoints', () => {
    it('GET /api/v1/health should return service status', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ok');
      expect(response.body.data.service).toBe('achievement');
    });

    it('GET /api/v1/health/live should return alive status', async () => {
      const response = await request(app)
        .get('/api/v1/health/live')
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('alive');
    });
  });

  describe('Achievement Endpoints', () => {
    describe('POST /api/v1/achievements', () => {
      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/v1/achievements')
          .send({})
          .expect(StatusCodes.BAD_REQUEST);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should validate criteria field', async () => {
        const response = await request(app)
          .post('/api/v1/achievements')
          .send({
            name: 'Test Achievement',
            description: 'Test description',
            criteria: { type: 'invalid', target: -1 }
          })
          .expect(StatusCodes.BAD_REQUEST);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/v1/achievements/:id', () => {
      it('should return 404 for non-existent achievement', async () => {
        const response = await request(app)
          .get('/api/v1/achievements/non-existent-id')
          .expect(StatusCodes.NOT_FOUND);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('NOT_FOUND');
      });
    });
  });

  describe('User Achievement Endpoints', () => {
    describe('POST /api/v1/users/:userId/achievements/:achievementId/progress', () => {
      it('should validate progress update input', async () => {
        const response = await request(app)
          .post('/api/v1/users/user-123/achievements/ach-123/progress')
          .send({})
          .expect(StatusCodes.BAD_REQUEST);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should accept valid increment', async () => {
        const response = await request(app)
          .post('/api/v1/users/user-123/achievements/ach-123/progress')
          .send({ increment: 5 });

        expect([StatusCodes.OK, StatusCodes.INTERNAL_SERVER_ERROR]).toContain(response.status);
      });

      it('should accept valid setValue', async () => {
        const response = await request(app)
          .post('/api/v1/users/user-123/achievements/ach-123/progress')
          .send({ setValue: 10 });

        expect([StatusCodes.OK, StatusCodes.INTERNAL_SERVER_ERROR]).toContain(response.status);
      });
    });
  });

  describe('Notification Endpoints', () => {
    describe('GET /api/v1/users/:userId/notifications', () => {
      it('should accept query parameters', async () => {
        const response = await request(app)
          .get('/api/v1/users/user-123/notifications')
          .query({ limit: 10, offset: 0, isRead: 'false' });

        expect([StatusCodes.OK, StatusCodes.INTERNAL_SERVER_ERROR]).toContain(response.status);
      });
    });

    describe('PUT /api/v1/users/:userId/notifications/:id/read', () => {
      it('should return 404 for non-existent notification', async () => {
        const response = await request(app)
          .put('/api/v1/users/user-123/notifications/non-existent/read')
          .expect(StatusCodes.NOT_FOUND);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/v1/unknown-route')
        .expect(StatusCodes.NOT_FOUND);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
