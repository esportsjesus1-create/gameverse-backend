import request from 'supertest';
import app from '../../src/app';

describe('API Integration Tests', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockPartyId = '123e4567-e89b-12d3-a456-426614174001';

  describe('Health Check', () => {
    it('GET /health should return 200', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('GameVerse Party Module');
      expect(response.body.version).toBe('1.23.0');
    });
  });

  describe('Party Routes', () => {
    describe('GET /api/v1/parties/public', () => {
      it('should return public parties without auth', async () => {
        const response = await request(app).get('/api/v1/parties/public');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get('/api/v1/parties/public')
          .query({ page: 1, limit: 10 });

        expect(response.status).toBe(200);
        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.limit).toBe(10);
      });
    });

    describe('POST /api/v1/parties', () => {
      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/v1/parties')
          .send({ name: 'Test Party' });

        expect(response.status).toBe(401);
        expect(response.body.error).toContain('User ID is required');
      });

      it('should require party name', async () => {
        const response = await request(app)
          .post('/api/v1/parties')
          .set('x-user-id', mockUserId)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Party name is required');
      });

      it('should validate max size', async () => {
        const response = await request(app)
          .post('/api/v1/parties')
          .set('x-user-id', mockUserId)
          .send({ name: 'Test Party', maxSize: 1 });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Max size must be between 2 and 100');
      });
    });

    describe('GET /api/v1/parties/me', () => {
      it('should require authentication', async () => {
        const response = await request(app).get('/api/v1/parties/me');

        expect(response.status).toBe(401);
      });

      it('should return user party with valid auth', async () => {
        const response = await request(app)
          .get('/api/v1/parties/me')
          .set('x-user-id', mockUserId);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/v1/parties/:partyId', () => {
      it('should require authentication', async () => {
        const response = await request(app).get(`/api/v1/parties/${mockPartyId}`);

        expect(response.status).toBe(401);
      });
    });

    describe('POST /api/v1/parties/:partyId/ready', () => {
      it('should require isReady boolean', async () => {
        const response = await request(app)
          .post(`/api/v1/parties/${mockPartyId}/ready`)
          .set('x-user-id', mockUserId)
          .send({ isReady: 'yes' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('isReady must be a boolean');
      });
    });
  });

  describe('Invite Routes', () => {
    describe('GET /api/v1/invites/received', () => {
      it('should require authentication', async () => {
        const response = await request(app).get('/api/v1/invites/received');

        expect(response.status).toBe(401);
      });

      it('should return user invites with valid auth', async () => {
        const response = await request(app)
          .get('/api/v1/invites/received')
          .set('x-user-id', mockUserId);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('POST /api/v1/invites/party/:partyId', () => {
      it('should require recipient ID', async () => {
        const response = await request(app)
          .post(`/api/v1/invites/party/${mockPartyId}`)
          .set('x-user-id', mockUserId)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Recipient ID is required');
      });

      it('should not allow self-invite', async () => {
        const response = await request(app)
          .post(`/api/v1/invites/party/${mockPartyId}`)
          .set('x-user-id', mockUserId)
          .send({ recipientId: mockUserId });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Cannot invite yourself');
      });
    });

    describe('POST /api/v1/invites/party/:partyId/bulk', () => {
      it('should require recipient IDs array', async () => {
        const response = await request(app)
          .post(`/api/v1/invites/party/${mockPartyId}/bulk`)
          .set('x-user-id', mockUserId)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Recipient IDs array is required');
      });

      it('should limit bulk invites to 50', async () => {
        const recipientIds = Array.from({ length: 51 }, (_, i) => `user-${i}`);
        const response = await request(app)
          .post(`/api/v1/invites/party/${mockPartyId}/bulk`)
          .set('x-user-id', mockUserId)
          .send({ recipientIds });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Cannot send more than 50 invites');
      });
    });
  });

  describe('Voice Chat Routes', () => {
    describe('GET /api/v1/voice/me', () => {
      it('should require authentication', async () => {
        const response = await request(app).get('/api/v1/voice/me');

        expect(response.status).toBe(401);
      });

      it('should return user voice status with valid auth', async () => {
        const response = await request(app)
          .get('/api/v1/voice/me')
          .set('x-user-id', mockUserId);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('POST /api/v1/voice/:channelId/speaking', () => {
      it('should require isSpeaking boolean', async () => {
        const channelId = '123e4567-e89b-12d3-a456-426614174002';
        const response = await request(app)
          .post(`/api/v1/voice/${channelId}/speaking`)
          .set('x-user-id', mockUserId)
          .send({ isSpeaking: 'yes' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('isSpeaking must be a boolean');
      });
    });
  });

  describe('Benefits Routes', () => {
    describe('GET /api/v1/benefits', () => {
      it('should return all benefits without auth', async () => {
        const response = await request(app).get('/api/v1/benefits');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/v1/benefits/applicable', () => {
      it('should require party size parameter', async () => {
        const response = await request(app).get('/api/v1/benefits/applicable');

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Valid party size is required');
      });

      it('should return applicable benefits for party size', async () => {
        const response = await request(app)
          .get('/api/v1/benefits/applicable')
          .query({ partySize: 3 });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/v1/benefits/next-tier', () => {
      it('should require current size parameter', async () => {
        const response = await request(app).get('/api/v1/benefits/next-tier');

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Valid current size is required');
      });
    });

    describe('POST /api/v1/benefits/party/:partyId/apply/xp', () => {
      it('should require authentication', async () => {
        const response = await request(app)
          .post(`/api/v1/benefits/party/${mockPartyId}/apply/xp`)
          .send({ baseXP: 1000 });

        expect(response.status).toBe(401);
      });

      it('should require valid baseXP', async () => {
        const response = await request(app)
          .post(`/api/v1/benefits/party/${mockPartyId}/apply/xp`)
          .set('x-user-id', mockUserId)
          .send({ baseXP: -100 });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Valid baseXP is required');
      });
    });

    describe('POST /api/v1/benefits/party/:partyId/apply/loot', () => {
      it('should require valid baseLootChance', async () => {
        const response = await request(app)
          .post(`/api/v1/benefits/party/${mockPartyId}/apply/loot`)
          .set('x-user-id', mockUserId)
          .send({ baseLootChance: 1.5 });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Valid baseLootChance (0-1) is required');
      });
    });
  });

  describe('User Routes', () => {
    describe('POST /api/v1/users', () => {
      it('should require username', async () => {
        const response = await request(app)
          .post('/api/v1/users')
          .send({ displayName: 'Test User' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Username is required');
      });

      it('should require display name', async () => {
        const response = await request(app)
          .post('/api/v1/users')
          .send({ username: 'testuser' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Display name is required');
      });

      it('should validate username length', async () => {
        const response = await request(app)
          .post('/api/v1/users')
          .send({ username: 'ab', displayName: 'Test User' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Username must be between 3 and 50 characters');
      });
    });

    describe('GET /api/v1/users/search', () => {
      it('should require search query', async () => {
        const response = await request(app).get('/api/v1/users/search');

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Search query is required');
      });
    });

    describe('GET /api/v1/users/me', () => {
      it('should require authentication', async () => {
        const response = await request(app).get('/api/v1/users/me');

        expect(response.status).toBe(401);
      });
    });

    describe('POST /api/v1/users/me/status', () => {
      it('should require valid status', async () => {
        const response = await request(app)
          .post('/api/v1/users/me/status')
          .set('x-user-id', mockUserId)
          .send({ status: 'invalid' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Status must be one of');
      });
    });
  });

  describe('Error Handling', () => {
    describe('404 Not Found', () => {
      it('should return 404 for unknown routes', async () => {
        const response = await request(app).get('/api/v1/unknown');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('not found');
      });
    });

    describe('Invalid User ID', () => {
      it('should reject invalid UUID format', async () => {
        const response = await request(app)
          .get('/api/v1/parties/me')
          .set('x-user-id', 'invalid-uuid');

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid user ID format');
      });
    });
  });
});
