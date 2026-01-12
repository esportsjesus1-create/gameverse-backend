import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import lobbyRoutes from '../../src/routes/lobby.routes';
import authRoutes from '../../src/routes/auth.routes';
import { lobbyService } from '../../src/services/lobby.service';
import { LobbyStatus, PlayerReadyStatus } from '../../src/types';

jest.mock('../../src/services/lobby.service');

const app = express();
app.use(express.json());
app.use('/api/lobbies', lobbyRoutes);
app.use('/api/auth', authRoutes);

const JWT_SECRET = 'test-secret-key';

function generateTestToken(playerId: string): string {
  return jwt.sign({ playerId }, JWT_SECRET, { expiresIn: '1h' });
}

describe('Lobby Routes Integration Tests', () => {
  const mockLobby = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Lobby',
    hostId: 'host-123',
    maxPlayers: 10,
    minPlayers: 2,
    status: LobbyStatus.WAITING,
    gameType: 'battle-royale',
    countdownDuration: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    players: []
  };

  const mockPlayer = {
    lobbyId: mockLobby.id,
    playerId: 'player-123',
    readyStatus: PlayerReadyStatus.NOT_READY,
    joinedAt: new Date()
  };

  let authToken: string;

  beforeAll(() => {
    authToken = generateTestToken('host-123');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/lobbies', () => {
    it('should create a lobby successfully', async () => {
      (lobbyService.createLobby as jest.Mock).mockResolvedValue({
        ...mockLobby,
        players: [{ ...mockPlayer, playerId: 'host-123' }]
      });

      const response = await request(app)
        .post('/api/lobbies')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Lobby',
          gameType: 'battle-royale',
          maxPlayers: 10
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Lobby');
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post('/api/lobbies')
        .send({
          name: 'Test Lobby',
          gameType: 'battle-royale'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid request body', async () => {
      const response = await request(app)
        .post('/api/lobbies')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          gameType: 'battle-royale'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/lobbies', () => {
    it('should list lobbies successfully', async () => {
      (lobbyService.listLobbies as jest.Mock).mockResolvedValue({
        lobbies: [mockLobby],
        total: 1,
        page: 1,
        limit: 20
      });

      const response = await request(app)
        .get('/api/lobbies');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.total).toBe(1);
    });

    it('should filter lobbies by status', async () => {
      (lobbyService.listLobbies as jest.Mock).mockResolvedValue({
        lobbies: [mockLobby],
        total: 1,
        page: 1,
        limit: 20
      });

      const response = await request(app)
        .get('/api/lobbies')
        .query({ status: 'waiting' });

      expect(response.status).toBe(200);
      expect(lobbyService.listLobbies).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'waiting' }),
        1,
        20
      );
    });

    it('should support pagination', async () => {
      (lobbyService.listLobbies as jest.Mock).mockResolvedValue({
        lobbies: [],
        total: 50,
        page: 2,
        limit: 10
      });

      const response = await request(app)
        .get('/api/lobbies')
        .query({ page: 2, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(10);
    });
  });

  describe('GET /api/lobbies/:id', () => {
    it('should get lobby by id', async () => {
      (lobbyService.getLobbyById as jest.Mock).mockResolvedValue(mockLobby);

      const response = await request(app)
        .get(`/api/lobbies/${mockLobby.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockLobby.id);
    });

    it('should return 404 for non-existent lobby', async () => {
      (lobbyService.getLobbyById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/lobbies/123e4567-e89b-12d3-a456-426614174999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid lobby id format', async () => {
      const response = await request(app)
        .get('/api/lobbies/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/lobbies/:id/join', () => {
    it('should join lobby successfully', async () => {
      const playerToken = generateTestToken('player-456');
      (lobbyService.joinLobby as jest.Mock).mockResolvedValue({
        ...mockLobby,
        players: [mockPlayer, { ...mockPlayer, playerId: 'player-456' }]
      });

      const response = await request(app)
        .post(`/api/lobbies/${mockLobby.id}/join`)
        .set('Authorization', `Bearer ${playerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post(`/api/lobbies/${mockLobby.id}/join`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/lobbies/:id/leave', () => {
    it('should leave lobby successfully', async () => {
      (lobbyService.leaveLobby as jest.Mock).mockResolvedValue({
        ...mockLobby,
        players: []
      });

      const response = await request(app)
        .post(`/api/lobbies/${mockLobby.id}/leave`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/lobbies/:id/ready', () => {
    it('should set player ready status', async () => {
      (lobbyService.setPlayerReady as jest.Mock).mockResolvedValue({
        player: { ...mockPlayer, readyStatus: PlayerReadyStatus.READY },
        allReady: false
      });

      const response = await request(app)
        .post(`/api/lobbies/${mockLobby.id}/ready`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ready: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.player.readyStatus).toBe(PlayerReadyStatus.READY);
    });

    it('should return 400 for invalid ready value', async () => {
      const response = await request(app)
        .post(`/api/lobbies/${mockLobby.id}/ready`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ready: 'invalid' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/lobbies/:id', () => {
    it('should delete lobby successfully', async () => {
      (lobbyService.deleteLobby as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`/api/lobbies/${mockLobby.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .delete(`/api/lobbies/${mockLobby.id}`);

      expect(response.status).toBe(401);
    });
  });
});

describe('Auth Routes Integration Tests', () => {
  describe('POST /api/auth/token', () => {
    it('should generate token with provided playerId', async () => {
      const response = await request(app)
        .post('/api/auth/token')
        .send({ playerId: 'custom-player-id' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.playerId).toBe('custom-player-id');
      expect(response.body.data.token).toBeDefined();
    });

    it('should generate token with auto-generated playerId', async () => {
      const response = await request(app)
        .post('/api/auth/token')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.playerId).toBeDefined();
      expect(response.body.data.token).toBeDefined();
    });
  });
});
