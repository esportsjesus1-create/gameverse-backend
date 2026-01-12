// Mock prisma before importing the app
jest.mock('../../src/models/prisma', () => {
  const createMockPrisma = (): Record<string, unknown> => ({
    tournament: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    participant: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    bracket: {
      create: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    match: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((callback: (client: Record<string, unknown>) => unknown) => {
      const client = createMockPrisma();
      return callback(client);
    }),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $on: jest.fn(),
  });
  return {
    __esModule: true,
    default: createMockPrisma(),
  };
});

import request from 'supertest';
import app from '../../src/index';
import prisma from '../../src/models/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Tournament API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('tournament-service');
    });
  });

  describe('POST /api/v1/tournaments', () => {
    it('should create a tournament', async () => {
      const tournamentData = {
        name: 'Test Tournament',
        game: 'Test Game',
        maxParticipants: 16,
      };

      const mockTournament = {
        id: 'test-id',
        ...tournamentData,
        description: null,
        format: 'SINGLE_ELIMINATION',
        status: 'DRAFT',
        minParticipants: 2,
        startDate: null,
        endDate: null,
        registrationStartDate: null,
        registrationEndDate: null,
        rules: null,
        prizePool: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        participants: [],
        matches: [],
      };

      mockPrisma.tournament.create.mockResolvedValue(mockTournament);

      const response = await request(app)
        .post('/api/v1/tournaments')
        .send(tournamentData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Tournament');
    });

    it('should return validation error for missing name', async () => {
      const response = await request(app)
        .post('/api/v1/tournaments')
        .send({
          game: 'Test Game',
          maxParticipants: 16,
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should return validation error for invalid maxParticipants', async () => {
      const response = await request(app)
        .post('/api/v1/tournaments')
        .send({
          name: 'Test Tournament',
          game: 'Test Game',
          maxParticipants: 1,
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/tournaments', () => {
    it('should return list of tournaments', async () => {
      const mockTournaments = [
        {
          id: 'test-1',
          name: 'Tournament 1',
          description: null,
          game: 'Game 1',
          format: 'SINGLE_ELIMINATION',
          status: 'DRAFT',
          maxParticipants: 16,
          minParticipants: 2,
          startDate: null,
          endDate: null,
          registrationStartDate: null,
          registrationEndDate: null,
          rules: null,
          prizePool: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          participants: [],
          matches: [],
        },
      ];

      mockPrisma.tournament.findMany.mockResolvedValue(mockTournaments);
      mockPrisma.tournament.count.mockResolvedValue(1);

      const response = await request(app).get('/api/v1/tournaments');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([]);
      mockPrisma.tournament.count.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/v1/tournaments')
        .query({ status: 'IN_PROGRESS' });

      expect(response.status).toBe(200);
      expect(mockPrisma.tournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'IN_PROGRESS',
          }),
        })
      );
    });
  });

  describe('GET /api/v1/tournaments/:id', () => {
    it('should return tournament by id', async () => {
      const mockTournament = {
        id: 'test-id',
        name: 'Test Tournament',
        description: null,
        game: 'Test Game',
        format: 'SINGLE_ELIMINATION',
        status: 'DRAFT',
        maxParticipants: 16,
        minParticipants: 2,
        startDate: null,
        endDate: null,
        registrationStartDate: null,
        registrationEndDate: null,
        rules: null,
        prizePool: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        participants: [],
        matches: [],
      };

      mockPrisma.tournament.findUnique.mockResolvedValue(mockTournament);

      const response = await request(app).get('/api/v1/tournaments/test-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('test-id');
    });

    it('should return 404 for non-existent tournament', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(null);

      const response = await request(app).get(
        '/api/v1/tournaments/550e8400-e29b-41d4-a716-446655440000'
      );

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return validation error for invalid UUID', async () => {
      const response = await request(app).get('/api/v1/tournaments/invalid-id');

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/tournaments/:id', () => {
    it('should update tournament', async () => {
      const existingTournament = {
        id: 'test-id',
        status: 'DRAFT',
      };

      const updatedTournament = {
        id: 'test-id',
        name: 'Updated Tournament',
        description: null,
        game: 'Test Game',
        format: 'SINGLE_ELIMINATION',
        status: 'DRAFT',
        maxParticipants: 16,
        minParticipants: 2,
        startDate: null,
        endDate: null,
        registrationStartDate: null,
        registrationEndDate: null,
        rules: null,
        prizePool: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        participants: [],
        matches: [],
      };

      mockPrisma.tournament.findUnique.mockResolvedValue(existingTournament);
      mockPrisma.tournament.update.mockResolvedValue(updatedTournament);

      const response = await request(app)
        .put('/api/v1/tournaments/test-id')
        .send({ name: 'Updated Tournament' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Tournament');
    });
  });

  describe('DELETE /api/v1/tournaments/:id', () => {
    it('should delete tournament', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue({
        id: 'test-id',
        status: 'DRAFT',
      });
      mockPrisma.tournament.delete.mockResolvedValue({});

      const response = await request(app).delete('/api/v1/tournaments/test-id');

      expect(response.status).toBe(204);
    });
  });

  describe('POST /api/v1/tournaments/:id/participants', () => {
    it('should add participant to tournament', async () => {
      const mockTournament = {
        id: 'test-id',
        status: 'REGISTRATION_OPEN',
        maxParticipants: 16,
        participants: [],
      };

      const mockParticipant = {
        id: 'participant-1',
        tournamentId: 'test-id',
        name: 'Player 1',
        email: 'player1@test.com',
        seed: 1,
        status: 'REGISTERED',
        checkedInAt: null,
      };

      mockPrisma.tournament.findUnique.mockResolvedValue(mockTournament);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.participant.create.mockResolvedValue(mockParticipant);

      const response = await request(app)
        .post('/api/v1/tournaments/test-id/participants')
        .send({
          name: 'Player 1',
          email: 'player1@test.com',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Player 1');
    });

    it('should return validation error for missing name', async () => {
      const response = await request(app)
        .post('/api/v1/tournaments/test-id/participants')
        .send({
          email: 'player1@test.com',
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/tournaments/:id/generate-bracket', () => {
    it('should generate bracket for tournament', async () => {
      const mockTournament = {
        id: 'test-id',
        format: 'SINGLE_ELIMINATION',
        minParticipants: 2,
        participants: [
          { id: 'p1', status: 'REGISTERED' },
          { id: 'p2', status: 'REGISTERED' },
          { id: 'p3', status: 'REGISTERED' },
          { id: 'p4', status: 'REGISTERED' },
        ],
      };

      mockPrisma.tournament.findUnique
        .mockResolvedValueOnce(mockTournament)
        .mockResolvedValueOnce({ ...mockTournament, status: 'REGISTRATION_CLOSED', participants: mockTournament.participants });
      mockPrisma.match.deleteMany.mockResolvedValue({});
      mockPrisma.bracket.deleteMany.mockResolvedValue({});
      mockPrisma.bracket.create.mockResolvedValue({ id: 'bracket-1', name: 'SINGLE_ELIMINATION Bracket', type: 'WINNERS' });
      mockPrisma.match.createMany.mockResolvedValue({ count: 3 });
      mockPrisma.match.findMany.mockResolvedValue([]);
      mockPrisma.tournament.update.mockResolvedValue({ ...mockTournament, status: 'IN_PROGRESS' });

      const response = await request(app)
        .post('/api/v1/tournaments/test-id/generate-bracket')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});

describe('Match API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/matches/:id', () => {
    it('should return match by id', async () => {
      const mockMatch = {
        id: 'match-1',
        round: 1,
        position: 0,
        player1: { id: 'p1', name: 'Player 1', email: null, seed: 1, status: 'REGISTERED', checkedInAt: null },
        player2: { id: 'p2', name: 'Player 2', email: null, seed: 2, status: 'REGISTERED', checkedInAt: null },
        winner: null,
        player1Score: null,
        player2Score: null,
        status: 'PENDING',
        scheduledAt: null,
        startedAt: null,
        completedAt: null,
      };

      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);

      const response = await request(app).get('/api/v1/matches/match-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('match-1');
    });
  });

  describe('PUT /api/v1/matches/:id', () => {
    it('should update match result', async () => {
      const mockMatch = {
        id: 'match-1',
        tournamentId: 'tournament-1',
        round: 1,
        position: 0,
        player1Id: 'p1',
        player2Id: 'p2',
        player1: { id: 'p1', name: 'Player 1' },
        player2: { id: 'p2', name: 'Player 2' },
        winner: null,
        player1Score: null,
        player2Score: null,
        status: 'IN_PROGRESS',
        scheduledAt: null,
        startedAt: new Date(),
        completedAt: null,
        nextMatchId: null,
        nextMatchSlot: null,
        tournament: { id: 'tournament-1' },
      };

      const updatedMatch = {
        ...mockMatch,
        player1Score: 3,
        player2Score: 1,
        winnerId: 'p1',
        winner: { id: 'p1', name: 'Player 1', email: null, seed: 1, status: 'WINNER', checkedInAt: null },
        status: 'COMPLETED',
        completedAt: new Date(),
      };

      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);
      mockPrisma.match.update.mockResolvedValue(updatedMatch);
      mockPrisma.participant.update.mockResolvedValue({});
      mockPrisma.tournament.findUnique.mockResolvedValue({
        id: 'tournament-1',
        status: 'IN_PROGRESS',
        matches: [updatedMatch],
      });

      const response = await request(app)
        .put('/api/v1/matches/match-1')
        .send({
          player1Score: 3,
          player2Score: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.player1Score).toBe(3);
    });
  });
});
