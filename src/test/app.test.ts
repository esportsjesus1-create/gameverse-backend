import request from 'supertest';
import { createApp } from '../app';
import { Application } from 'express';

describe('App', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  describe('Health endpoints', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should return ready status', async () => {
      const response = await request(app).get('/api/ready');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ready');
    });

    it('should return live status', async () => {
      const response = await request(app).get('/api/live');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('alive');
    });
  });

  describe('Error handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/unknown-route');
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Security headers', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/api/health');
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('Request ID', () => {
    it('should accept custom request ID', async () => {
      const customId = 'test-request-id-123';
      const response = await request(app)
        .get('/api/health')
        .set('X-Request-ID', customId);
      expect(response.status).toBe(200);
    });
  });
});
