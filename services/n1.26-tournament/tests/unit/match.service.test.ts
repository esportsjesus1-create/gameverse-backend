// Mock prisma before importing the service
jest.mock('../../src/models/prisma', () => ({
  __esModule: true,
  default: {
    match: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    participant: {
      update: jest.fn(),
    },
    tournament: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $on: jest.fn(),
  },
}));

import { MatchService } from '../../src/services/match.service';
import { MatchStatus, ParticipantStatus, TournamentStatus } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../src/utils/errors';
import prisma from '../../src/models/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('MatchService', () => {
  let matchService: MatchService;

  beforeEach(() => {
    matchService = new MatchService();
    jest.clearAllMocks();
  });

  describe('getById', () => {
    it('should return match when found', async () => {
      const mockMatch = {
        id: 'match-1',
        round: 1,
        position: 0,
        player1: { id: 'p1', name: 'Player 1', email: null, seed: 1, status: 'REGISTERED', checkedInAt: null },
        player2: { id: 'p2', name: 'Player 2', email: null, seed: 2, status: 'REGISTERED', checkedInAt: null },
        winner: null,
        player1Score: null,
        player2Score: null,
        status: MatchStatus.PENDING,
        scheduledAt: null,
        startedAt: null,
        completedAt: null,
      };

      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);

      const result = await matchService.getById('match-1');

      expect(result.id).toBe('match-1');
      expect(result.player1?.name).toBe('Player 1');
      expect(result.player2?.name).toBe('Player 2');
    });

    it('should throw NotFoundError when match not found', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(null);

      await expect(matchService.getById('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getByTournament', () => {
    it('should return all matches for tournament', async () => {
      const mockMatches = [
        {
          id: 'match-1',
          round: 1,
          position: 0,
          player1: null,
          player2: null,
          winner: null,
          player1Score: null,
          player2Score: null,
          status: MatchStatus.PENDING,
          scheduledAt: null,
          startedAt: null,
          completedAt: null,
        },
        {
          id: 'match-2',
          round: 1,
          position: 1,
          player1: null,
          player2: null,
          winner: null,
          player1Score: null,
          player2Score: null,
          status: MatchStatus.PENDING,
          scheduledAt: null,
          startedAt: null,
          completedAt: null,
        },
      ];

      mockPrisma.match.findMany.mockResolvedValue(mockMatches);

      const result = await matchService.getByTournament('tournament-1');

      expect(result).toHaveLength(2);
    });
  });

  describe('updateResult', () => {
    it('should update match scores', async () => {
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
        status: MatchStatus.IN_PROGRESS,
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
        status: MatchStatus.COMPLETED,
        completedAt: new Date(),
      };

      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);
      mockPrisma.match.update.mockResolvedValue(updatedMatch);
      mockPrisma.participant.update.mockResolvedValue({});
      mockPrisma.tournament.findUnique.mockResolvedValue({
        id: 'tournament-1',
        status: TournamentStatus.IN_PROGRESS,
        matches: [updatedMatch],
      });

      const result = await matchService.updateResult('match-1', {
        player1Score: 3,
        player2Score: 1,
      });

      expect(result.player1Score).toBe(3);
      expect(result.player2Score).toBe(1);
      expect(result.status).toBe(MatchStatus.COMPLETED);
    });

    it('should throw NotFoundError when match not found', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(null);

      await expect(
        matchService.updateResult('non-existent', { player1Score: 1 })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw BadRequestError when match already completed', async () => {
      mockPrisma.match.findUnique.mockResolvedValue({
        id: 'match-1',
        status: MatchStatus.COMPLETED,
      });

      await expect(
        matchService.updateResult('match-1', { player1Score: 1 })
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when match is cancelled', async () => {
      mockPrisma.match.findUnique.mockResolvedValue({
        id: 'match-1',
        status: MatchStatus.CANCELLED,
      });

      await expect(
        matchService.updateResult('match-1', { player1Score: 1 })
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when winner is not a participant', async () => {
      mockPrisma.match.findUnique.mockResolvedValue({
        id: 'match-1',
        player1Id: 'p1',
        player2Id: 'p2',
        status: MatchStatus.IN_PROGRESS,
        tournament: { id: 'tournament-1' },
      });

      await expect(
        matchService.updateResult('match-1', { winnerId: 'invalid-player' })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('startMatch', () => {
    it('should start a pending match', async () => {
      const mockMatch = {
        id: 'match-1',
        tournamentId: 'tournament-1',
        player1Id: 'p1',
        player2Id: 'p2',
        player1: { id: 'p1', name: 'Player 1', email: null, seed: 1, status: 'REGISTERED', checkedInAt: null },
        player2: { id: 'p2', name: 'Player 2', email: null, seed: 2, status: 'REGISTERED', checkedInAt: null },
        winner: null,
        player1Score: null,
        player2Score: null,
        status: MatchStatus.PENDING,
        scheduledAt: null,
        startedAt: null,
        completedAt: null,
        nextMatchId: null,
        nextMatchSlot: null,
        round: 1,
        position: 0,
        tournament: { id: 'tournament-1' },
      };

      const startedMatch = {
        ...mockMatch,
        status: MatchStatus.IN_PROGRESS,
        startedAt: new Date(),
      };

      mockPrisma.match.findUnique
        .mockResolvedValueOnce(mockMatch)
        .mockResolvedValueOnce(mockMatch);
      mockPrisma.match.update.mockResolvedValue(startedMatch);
      mockPrisma.tournament.findUnique.mockResolvedValue({
        id: 'tournament-1',
        status: TournamentStatus.IN_PROGRESS,
        matches: [startedMatch],
      });

      const result = await matchService.startMatch('match-1');

      expect(result.status).toBe(MatchStatus.IN_PROGRESS);
    });

    it('should throw BadRequestError when match is already in progress', async () => {
      mockPrisma.match.findUnique.mockResolvedValue({
        id: 'match-1',
        status: MatchStatus.IN_PROGRESS,
      });

      await expect(matchService.startMatch('match-1')).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when players not assigned', async () => {
      mockPrisma.match.findUnique.mockResolvedValue({
        id: 'match-1',
        player1Id: 'p1',
        player2Id: null,
        status: MatchStatus.PENDING,
      });

      await expect(matchService.startMatch('match-1')).rejects.toThrow(BadRequestError);
    });
  });

  describe('cancelMatch', () => {
    it('should cancel a pending match', async () => {
      const mockMatch = {
        id: 'match-1',
        round: 1,
        position: 0,
        player1: null,
        player2: null,
        winner: null,
        player1Score: null,
        player2Score: null,
        status: MatchStatus.PENDING,
        scheduledAt: null,
        startedAt: null,
        completedAt: null,
      };

      const cancelledMatch = {
        ...mockMatch,
        status: MatchStatus.CANCELLED,
      };

      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);
      mockPrisma.match.update.mockResolvedValue(cancelledMatch);

      const result = await matchService.cancelMatch('match-1');

      expect(result.status).toBe(MatchStatus.CANCELLED);
    });

    it('should throw BadRequestError when match is completed', async () => {
      mockPrisma.match.findUnique.mockResolvedValue({
        id: 'match-1',
        status: MatchStatus.COMPLETED,
      });

      await expect(matchService.cancelMatch('match-1')).rejects.toThrow(BadRequestError);
    });
  });

  describe('scheduleMatch', () => {
    it('should schedule a match', async () => {
      const scheduledAt = new Date('2024-01-15T10:00:00Z');
      const mockMatch = {
        id: 'match-1',
        round: 1,
        position: 0,
        player1: null,
        player2: null,
        winner: null,
        player1Score: null,
        player2Score: null,
        status: MatchStatus.PENDING,
        scheduledAt: null,
        startedAt: null,
        completedAt: null,
      };

      const scheduledMatch = {
        ...mockMatch,
        status: MatchStatus.SCHEDULED,
        scheduledAt,
      };

      mockPrisma.match.findUnique.mockResolvedValue(mockMatch);
      mockPrisma.match.update.mockResolvedValue(scheduledMatch);

      const result = await matchService.scheduleMatch('match-1', scheduledAt);

      expect(result.status).toBe(MatchStatus.SCHEDULED);
      expect(result.scheduledAt).toEqual(scheduledAt);
    });

    it('should throw BadRequestError when match is completed', async () => {
      mockPrisma.match.findUnique.mockResolvedValue({
        id: 'match-1',
        status: MatchStatus.COMPLETED,
      });

      await expect(
        matchService.scheduleMatch('match-1', new Date())
      ).rejects.toThrow(BadRequestError);
    });
  });
});
