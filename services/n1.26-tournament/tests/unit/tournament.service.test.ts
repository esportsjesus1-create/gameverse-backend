// Mock prisma before importing the service
jest.mock('../../src/models/prisma', () => ({
  __esModule: true,
  default: {
    tournament: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    $on: jest.fn(),
  },
}));

import { TournamentService } from '../../src/services/tournament.service';
import { TournamentStatus, TournamentFormat } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../src/utils/errors';
import prisma from '../../src/models/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('TournamentService', () => {
  let tournamentService: TournamentService;

  beforeEach(() => {
    tournamentService = new TournamentService();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a tournament with default values', async () => {
      const mockTournament = {
        id: 'test-id',
        name: 'Test Tournament',
        description: null,
        game: 'Test Game',
        format: TournamentFormat.SINGLE_ELIMINATION,
        status: TournamentStatus.DRAFT,
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

      mockPrisma.tournament.create.mockResolvedValue(mockTournament);

      const result = await tournamentService.create({
        name: 'Test Tournament',
        game: 'Test Game',
        maxParticipants: 16,
      });

      expect(mockPrisma.tournament.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Tournament',
          game: 'Test Game',
          maxParticipants: 16,
          format: TournamentFormat.SINGLE_ELIMINATION,
          minParticipants: 2,
        }),
        include: expect.any(Object),
      });

      expect(result.name).toBe('Test Tournament');
      expect(result.game).toBe('Test Game');
    });

    it('should create a tournament with custom format', async () => {
      const mockTournament = {
        id: 'test-id',
        name: 'Double Elim Tournament',
        description: 'A double elimination tournament',
        game: 'Fighting Game',
        format: TournamentFormat.DOUBLE_ELIMINATION,
        status: TournamentStatus.DRAFT,
        maxParticipants: 32,
        minParticipants: 4,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02'),
        registrationStartDate: null,
        registrationEndDate: null,
        rules: 'Best of 3',
        prizePool: '$1000',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123',
        participants: [],
        matches: [],
      };

      mockPrisma.tournament.create.mockResolvedValue(mockTournament);

      const result = await tournamentService.create({
        name: 'Double Elim Tournament',
        description: 'A double elimination tournament',
        game: 'Fighting Game',
        format: TournamentFormat.DOUBLE_ELIMINATION,
        maxParticipants: 32,
        minParticipants: 4,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02'),
        rules: 'Best of 3',
        prizePool: '$1000',
        createdBy: 'user-123',
      });

      expect(result.format).toBe(TournamentFormat.DOUBLE_ELIMINATION);
      expect(result.prizePool).toBe('$1000');
    });
  });

  describe('getById', () => {
    it('should return tournament when found', async () => {
      const mockTournament = {
        id: 'test-id',
        name: 'Test Tournament',
        description: null,
        game: 'Test Game',
        format: TournamentFormat.SINGLE_ELIMINATION,
        status: TournamentStatus.DRAFT,
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

      const result = await tournamentService.getById('test-id');

      expect(result.id).toBe('test-id');
      expect(mockPrisma.tournament.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundError when tournament not found', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(null);

      await expect(tournamentService.getById('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('list', () => {
    it('should return paginated tournaments', async () => {
      const mockTournaments = [
        {
          id: 'test-1',
          name: 'Tournament 1',
          description: null,
          game: 'Game 1',
          format: TournamentFormat.SINGLE_ELIMINATION,
          status: TournamentStatus.DRAFT,
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

      const result = await tournamentService.list({}, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([]);
      mockPrisma.tournament.count.mockResolvedValue(0);

      await tournamentService.list({ status: TournamentStatus.IN_PROGRESS });

      expect(mockPrisma.tournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: TournamentStatus.IN_PROGRESS,
          }),
        })
      );
    });

    it('should filter by format', async () => {
      mockPrisma.tournament.findMany.mockResolvedValue([]);
      mockPrisma.tournament.count.mockResolvedValue(0);

      await tournamentService.list({ format: TournamentFormat.ROUND_ROBIN });

      expect(mockPrisma.tournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            format: TournamentFormat.ROUND_ROBIN,
          }),
        })
      );
    });
  });

  describe('update', () => {
    it('should update tournament', async () => {
      const existingTournament = {
        id: 'test-id',
        status: TournamentStatus.DRAFT,
      };

      const updatedTournament = {
        id: 'test-id',
        name: 'Updated Name',
        description: null,
        game: 'Test Game',
        format: TournamentFormat.SINGLE_ELIMINATION,
        status: TournamentStatus.DRAFT,
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

      const result = await tournamentService.update('test-id', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundError when tournament not found', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(null);

      await expect(
        tournamentService.update('non-existent', { name: 'New Name' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('should delete tournament', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue({
        id: 'test-id',
        status: TournamentStatus.DRAFT,
      });
      mockPrisma.tournament.delete.mockResolvedValue({});

      await tournamentService.delete('test-id');

      expect(mockPrisma.tournament.delete).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
    });

    it('should throw NotFoundError when tournament not found', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue(null);

      await expect(tournamentService.delete('non-existent')).rejects.toThrow(NotFoundError);
    });

    it('should throw BadRequestError when tournament is in progress', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue({
        id: 'test-id',
        status: TournamentStatus.IN_PROGRESS,
      });

      await expect(tournamentService.delete('test-id')).rejects.toThrow(BadRequestError);
    });
  });

  describe('updateStatus', () => {
    it('should update status from DRAFT to REGISTRATION_OPEN', async () => {
      const tournament = {
        id: 'test-id',
        name: 'Test',
        description: null,
        game: 'Game',
        format: TournamentFormat.SINGLE_ELIMINATION,
        status: TournamentStatus.DRAFT,
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

      mockPrisma.tournament.findUnique
        .mockResolvedValueOnce({ ...tournament, participants: [] })
        .mockResolvedValueOnce(tournament);
      mockPrisma.tournament.update.mockResolvedValue({
        ...tournament,
        status: TournamentStatus.REGISTRATION_OPEN,
      });

      const result = await tournamentService.updateStatus(
        'test-id',
        TournamentStatus.REGISTRATION_OPEN
      );

      expect(result.status).toBe(TournamentStatus.REGISTRATION_OPEN);
    });

    it('should throw BadRequestError for invalid status transition', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue({
        id: 'test-id',
        status: TournamentStatus.COMPLETED,
        participants: [],
      });

      await expect(
        tournamentService.updateStatus('test-id', TournamentStatus.DRAFT)
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when starting with insufficient participants', async () => {
      mockPrisma.tournament.findUnique.mockResolvedValue({
        id: 'test-id',
        status: TournamentStatus.REGISTRATION_CLOSED,
        minParticipants: 4,
        participants: [{ id: 'p1' }, { id: 'p2' }],
      });

      await expect(
        tournamentService.updateStatus('test-id', TournamentStatus.IN_PROGRESS)
      ).rejects.toThrow(BadRequestError);
    });
  });
});
