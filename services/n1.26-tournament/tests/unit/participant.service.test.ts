// Mock prisma before importing the service
jest.mock('../../src/models/prisma', () => ({
  __esModule: true,
  default: {
    tournament: {
      findUnique: jest.fn(),
    },
    participant: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $on: jest.fn(),
  },
}));

import { ParticipantService } from '../../src/services/participant.service';
import { TournamentStatus, ParticipantStatus } from '@prisma/client';
import { BadRequestError, NotFoundError, ConflictError } from '../../src/utils/errors';
import prisma from '../../src/models/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('ParticipantService', () => {
  let participantService: ParticipantService;

  beforeEach(() => {
    participantService = new ParticipantService();
    jest.clearAllMocks();
  });

  describe('addParticipant', () => {
    it('should add participant to tournament', async () => {
      const mockTournament = {
        id: 'tournament-1',
        status: TournamentStatus.REGISTRATION_OPEN,
        maxParticipants: 16,
        participants: [],
      };

      const mockParticipant = {
        id: 'participant-1',
        tournamentId: 'tournament-1',
        name: 'Player 1',
        email: 'player1@test.com',
        seed: 1,
        status: ParticipantStatus.REGISTERED,
        checkedInAt: null,
      };

      mockPrisma.tournament.findUnique.mockResolvedValue(mockTournament);
      mockPrisma.participant.findFirst.mockResolvedValue(null);
      mockPrisma.participant.create.mockResolvedValue(mockParticipant);

      const result = await participantService.addParticipant('tournament-1', {
        name: 'Player 1',
        email: 'player1@test.com',
      });

      expect(result.name).toBe('Player 1');
      expect(result.email).toBe('player1@test.com');
      expect(result.status).toBe(ParticipantStatus.REGISTERED);
    });

    it('should throw NotFoundError when tournament not found', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(null);

      await expect(
        participantService.addParticipant('non-existent', { name: 'Player' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw BadRequestError when registration is closed', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue({
        id: 'tournament-1',
        status: TournamentStatus.IN_PROGRESS,
        maxParticipants: 16,
        participants: [],
      });

      await expect(
        participantService.addParticipant('tournament-1', { name: 'Player' })
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when tournament is full', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue({
        id: 'tournament-1',
        status: TournamentStatus.REGISTRATION_OPEN,
        maxParticipants: 2,
        participants: [{ id: 'p1' }, { id: 'p2' }],
      });

      await expect(
        participantService.addParticipant('tournament-1', { name: 'Player' })
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw ConflictError when user already registered', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue({
        id: 'tournament-1',
        status: TournamentStatus.REGISTRATION_OPEN,
        maxParticipants: 16,
        participants: [],
      });
      mockPrisma.participant.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        participantService.addParticipant('tournament-1', {
          name: 'Player',
          userId: 'user-1',
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('removeParticipant', () => {
    it('should remove participant from tournament', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue({
        id: 'tournament-1',
        status: TournamentStatus.REGISTRATION_OPEN,
      });
      mockPrisma.participant.findFirst.mockResolvedValue({
        id: 'participant-1',
        tournamentId: 'tournament-1',
      });
      mockPrisma.participant.delete.mockResolvedValue({});
      mockPrisma.participant.findMany.mockResolvedValue([]);

      await participantService.removeParticipant('tournament-1', 'participant-1');

      expect(mockPrisma.participant.delete).toHaveBeenCalledWith({
        where: { id: 'participant-1' },
      });
    });

    it('should throw NotFoundError when tournament not found', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(null);

      await expect(
        participantService.removeParticipant('non-existent', 'participant-1')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when participant not found', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue({
        id: 'tournament-1',
        status: TournamentStatus.REGISTRATION_OPEN,
      });
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        participantService.removeParticipant('tournament-1', 'non-existent')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw BadRequestError when tournament is in progress', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue({
        id: 'tournament-1',
        status: TournamentStatus.IN_PROGRESS,
      });
      mockPrisma.participant.findFirst.mockResolvedValue({
        id: 'participant-1',
        tournamentId: 'tournament-1',
      });

      await expect(
        participantService.removeParticipant('tournament-1', 'participant-1')
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('checkIn', () => {
    it('should check in participant', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue({
        id: 'tournament-1',
      });
      mockPrisma.participant.findFirst.mockResolvedValue({
        id: 'participant-1',
        tournamentId: 'tournament-1',
        status: ParticipantStatus.REGISTERED,
      });
      mockPrisma.participant.update.mockResolvedValue({
        id: 'participant-1',
        name: 'Player 1',
        email: null,
        seed: 1,
        status: ParticipantStatus.CHECKED_IN,
        checkedInAt: new Date(),
      });

      const result = await participantService.checkIn('tournament-1', 'participant-1');

      expect(result.status).toBe(ParticipantStatus.CHECKED_IN);
      expect(result.checkedInAt).toBeDefined();
    });

    it('should throw BadRequestError when already checked in', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue({
        id: 'tournament-1',
      });
      mockPrisma.participant.findFirst.mockResolvedValue({
        id: 'participant-1',
        tournamentId: 'tournament-1',
        status: ParticipantStatus.CHECKED_IN,
      });

      await expect(
        participantService.checkIn('tournament-1', 'participant-1')
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('getParticipants', () => {
    it('should return all participants for tournament', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue({
        id: 'tournament-1',
      });
      mockPrisma.participant.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Player 1',
          email: null,
          seed: 1,
          status: ParticipantStatus.REGISTERED,
          checkedInAt: null,
        },
        {
          id: 'p2',
          name: 'Player 2',
          email: null,
          seed: 2,
          status: ParticipantStatus.CHECKED_IN,
          checkedInAt: new Date(),
        },
      ]);

      const result = await participantService.getParticipants('tournament-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Player 1');
      expect(result[1].name).toBe('Player 2');
    });

    it('should throw NotFoundError when tournament not found', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(null);

      await expect(
        participantService.getParticipants('non-existent')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('withdraw', () => {
    it('should withdraw participant from tournament', async () => {
      mockPrisma.participant.findFirst.mockResolvedValue({
        id: 'participant-1',
        tournamentId: 'tournament-1',
        status: ParticipantStatus.REGISTERED,
      });
      mockPrisma.participant.update.mockResolvedValue({
        id: 'participant-1',
        name: 'Player 1',
        email: null,
        seed: 1,
        status: ParticipantStatus.WITHDRAWN,
        checkedInAt: null,
      });

      const result = await participantService.withdraw('tournament-1', 'participant-1');

      expect(result.status).toBe(ParticipantStatus.WITHDRAWN);
    });

    it('should throw NotFoundError when participant not found', async () => {
      mockPrisma.participant.findFirst.mockResolvedValue(null);

      await expect(
        participantService.withdraw('tournament-1', 'non-existent')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
