import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { LeaderboardService } from '../leaderboard.service';
import { TournamentStanding } from '../../entities/tournament-standing.entity';
import { Tournament, TournamentStatus } from '../../entities/tournament.entity';
import { TournamentMatch, MatchStatus } from '../../entities/tournament-match.entity';
import { NotFoundException } from '@nestjs/common';

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let standingRepository: jest.Mocked<Repository<TournamentStanding>>;
  let tournamentRepository: jest.Mocked<Repository<Tournament>>;
  let matchRepository: jest.Mocked<Repository<TournamentMatch>>;
  let cacheManager: jest.Mocked<Cache>;

  const mockTournament: Partial<Tournament> = {
    id: generateUUID(),
    name: 'Test Tournament',
    status: TournamentStatus.IN_PROGRESS,
  };

  const mockStanding: Partial<TournamentStanding> = {
    id: generateUUID(),
    tournamentId: mockTournament.id!,
    participantId: generateUUID(),
    participantName: 'Test Player',
    placement: 1,
    wins: 5,
    losses: 1,
    draws: 0,
    matchesPlayed: 6,
    pointsScored: 15,
    pointsConceded: 8,
    pointsDifferential: 7,
    buchholzScore: 12.5,
    tiebreaker1: 15,
    tiebreaker2: 7,
    isEliminated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStandingRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTournamentRepo = {
    findOne: jest.fn(),
  };

  const mockMatchRepo = {
    find: jest.fn(),
    count: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        {
          provide: getRepositoryToken(TournamentStanding),
          useValue: mockStandingRepo,
        },
        {
          provide: getRepositoryToken(Tournament),
          useValue: mockTournamentRepo,
        },
        {
          provide: getRepositoryToken(TournamentMatch),
          useValue: mockMatchRepo,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
    standingRepository = module.get(getRepositoryToken(TournamentStanding));
    tournamentRepository = module.get(getRepositoryToken(Tournament));
    matchRepository = module.get(getRepositoryToken(TournamentMatch));
    cacheManager = module.get(CACHE_MANAGER);

    jest.clearAllMocks();
  });

  describe('getLeaderboard', () => {
    it('should return cached leaderboard if available', async () => {
      const cachedLeaderboard = [mockStanding];
      mockCacheManager.get.mockResolvedValue(cachedLeaderboard);

      const result = await service.getLeaderboard(mockTournament.id!);

      expect(result).toEqual(cachedLeaderboard);
      expect(mockCacheManager.get).toHaveBeenCalledWith(
        `leaderboard:${mockTournament.id}`,
      );
    });

    it('should fetch and cache leaderboard if not cached', async () => {
      const standings = [mockStanding, { ...mockStanding, id: generateUUID(), placement: 2 }];
      mockCacheManager.get.mockResolvedValue(null);
      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockStandingRepo.find.mockResolvedValue(standings);

      const result = await service.getLeaderboard(mockTournament.id!);

      expect(result).toEqual(standings);
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should throw NotFoundException when tournament not found', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockTournamentRepo.findOne.mockResolvedValue(null);

      await expect(service.getLeaderboard('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getParticipantStanding', () => {
    it('should return participant standing', async () => {
      mockStandingRepo.findOne.mockResolvedValue(mockStanding);

      const result = await service.getParticipantStanding(
        mockTournament.id!,
        mockStanding.participantId!,
      );

      expect(result).toEqual(mockStanding);
    });

    it('should throw NotFoundException when standing not found', async () => {
      mockStandingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getParticipantStanding(mockTournament.id!, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStandings', () => {
    it('should update standings after match completion', async () => {
      const match = {
        id: generateUUID(),
        tournamentId: mockTournament.id,
        participant1Id: mockStanding.participantId,
        participant2Id: generateUUID(),
        winnerId: mockStanding.participantId,
        participant1Score: 3,
        participant2Score: 1,
        status: MatchStatus.COMPLETED,
      };

      const winnerStanding = { ...mockStanding };
      const loserStanding = {
        ...mockStanding,
        id: generateUUID(),
        participantId: match.participant2Id,
      };

      mockStandingRepo.findOne
        .mockResolvedValueOnce(winnerStanding)
        .mockResolvedValueOnce(loserStanding);
      mockStandingRepo.save.mockImplementation((standing) => Promise.resolve(standing));

      await service.updateStandings(match as any);

      expect(mockStandingRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should handle draw correctly', async () => {
      const match = {
        id: generateUUID(),
        tournamentId: mockTournament.id,
        participant1Id: mockStanding.participantId,
        participant2Id: generateUUID(),
        winnerId: null,
        participant1Score: 2,
        participant2Score: 2,
        status: MatchStatus.COMPLETED,
        isDraw: true,
      };

      const standing1 = { ...mockStanding };
      const standing2 = {
        ...mockStanding,
        id: generateUUID(),
        participantId: match.participant2Id,
      };

      mockStandingRepo.findOne
        .mockResolvedValueOnce(standing1)
        .mockResolvedValueOnce(standing2);
      mockStandingRepo.save.mockImplementation((standing) => Promise.resolve(standing));

      await service.updateStandings(match as any);

      expect(mockStandingRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('calculatePlacements', () => {
    it('should calculate placements based on wins and tiebreakers', async () => {
      const standings = [
        { ...mockStanding, wins: 5, pointsDifferential: 10 },
        { ...mockStanding, id: generateUUID(), wins: 5, pointsDifferential: 5 },
        { ...mockStanding, id: generateUUID(), wins: 3, pointsDifferential: 2 },
      ];

      mockStandingRepo.find.mockResolvedValue(standings);
      mockStandingRepo.save.mockImplementation((s) => Promise.resolve(s));
      mockCacheManager.del.mockResolvedValue(undefined);

      await service.calculatePlacements(mockTournament.id!);

      expect(mockStandingRepo.save).toHaveBeenCalled();
      expect(mockCacheManager.del).toHaveBeenCalledWith(
        `leaderboard:${mockTournament.id}`,
      );
    });
  });

  describe('calculateBuchholzScore', () => {
    it('should calculate Buchholz score correctly', async () => {
      const participantId = generateUUID();
      const opponentIds = [generateUUID(), generateUUID()];

      const matches = [
        {
          participant1Id: participantId,
          participant2Id: opponentIds[0],
          winnerId: participantId,
        },
        {
          participant1Id: opponentIds[1],
          participant2Id: participantId,
          winnerId: opponentIds[1],
        },
      ];

      const opponentStandings = [
        { participantId: opponentIds[0], wins: 4 },
        { participantId: opponentIds[1], wins: 6 },
      ];

      mockMatchRepo.find.mockResolvedValue(matches);
      mockStandingRepo.find.mockResolvedValue(opponentStandings);

      const score = await service.calculateBuchholzScore(
        mockTournament.id!,
        participantId,
      );

      expect(score).toBe(10);
    });
  });

  describe('getTopParticipants', () => {
    it('should return top N participants', async () => {
      const standings = [
        { ...mockStanding, placement: 1 },
        { ...mockStanding, id: generateUUID(), placement: 2 },
        { ...mockStanding, id: generateUUID(), placement: 3 },
      ];

      mockStandingRepo.find.mockResolvedValue(standings.slice(0, 2));

      const result = await service.getTopParticipants(mockTournament.id!, 2);

      expect(result).toHaveLength(2);
      expect(result[0].placement).toBe(1);
    });
  });

  describe('getEliminatedParticipants', () => {
    it('should return eliminated participants', async () => {
      const eliminated = [
        { ...mockStanding, isEliminated: true },
        { ...mockStanding, id: generateUUID(), isEliminated: true },
      ];

      mockStandingRepo.find.mockResolvedValue(eliminated);

      const result = await service.getEliminatedParticipants(mockTournament.id!);

      expect(result).toHaveLength(2);
      expect(result[0].isEliminated).toBe(true);
    });
  });

  describe('eliminateParticipant', () => {
    it('should mark participant as eliminated', async () => {
      mockStandingRepo.findOne.mockResolvedValue(mockStanding);
      mockStandingRepo.save.mockResolvedValue({
        ...mockStanding,
        isEliminated: true,
        eliminatedAt: new Date(),
        eliminatedInRound: 3,
      });
      mockCacheManager.del.mockResolvedValue(undefined);

      const result = await service.eliminateParticipant(
        mockTournament.id!,
        mockStanding.participantId!,
        3,
      );

      expect(result.isEliminated).toBe(true);
      expect(result.eliminatedInRound).toBe(3);
    });
  });

  describe('getHeadToHead', () => {
    it('should return head to head record between two participants', async () => {
      const participant1Id = generateUUID();
      const participant2Id = generateUUID();

      const matches = [
        {
          participant1Id,
          participant2Id,
          winnerId: participant1Id,
          participant1Score: 3,
          participant2Score: 1,
        },
        {
          participant1Id: participant2Id,
          participant2Id: participant1Id,
          winnerId: participant1Id,
          participant1Score: 1,
          participant2Score: 3,
        },
      ];

      mockMatchRepo.find.mockResolvedValue(matches);

      const result = await service.getHeadToHead(
        mockTournament.id!,
        participant1Id,
        participant2Id,
      );

      expect(result.participant1Wins).toBe(2);
      expect(result.participant2Wins).toBe(0);
    });
  });

  describe('getParticipantStats', () => {
    it('should return comprehensive participant statistics', async () => {
      const participantId = generateUUID();

      mockStandingRepo.findOne.mockResolvedValue({
        ...mockStanding,
        participantId,
      });
      mockMatchRepo.find.mockResolvedValue([
        { winnerId: participantId, participant1Score: 3, participant2Score: 1 },
        { winnerId: participantId, participant1Score: 3, participant2Score: 2 },
      ]);

      const result = await service.getParticipantStats(
        mockTournament.id!,
        participantId,
      );

      expect(result.standing).toBeDefined();
      expect(result.matchHistory).toHaveLength(2);
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate leaderboard cache', async () => {
      mockCacheManager.del.mockResolvedValue(undefined);

      await service.invalidateCache(mockTournament.id!);

      expect(mockCacheManager.del).toHaveBeenCalledWith(
        `leaderboard:${mockTournament.id}`,
      );
    });
  });

  describe('getLeaderboardWithPagination', () => {
    it('should return paginated leaderboard', async () => {
      const standings = Array.from({ length: 20 }, (_, i) => ({
        ...mockStanding,
        id: generateUUID(),
        placement: i + 1,
      }));

      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockStandingRepo.find.mockResolvedValue(standings.slice(0, 10));

      const result = await service.getLeaderboardWithPagination(
        mockTournament.id!,
        { page: 1, limit: 10 },
      );

      expect(result.data).toHaveLength(10);
      expect(result.page).toBe(1);
    });
  });

  describe('tiebreaker calculations', () => {
    it('should apply tiebreakers in correct order', async () => {
      const standings = [
        { ...mockStanding, wins: 5, pointsDifferential: 10, buchholzScore: 15 },
        { ...mockStanding, id: generateUUID(), wins: 5, pointsDifferential: 10, buchholzScore: 12 },
        { ...mockStanding, id: generateUUID(), wins: 5, pointsDifferential: 8, buchholzScore: 20 },
      ];

      mockStandingRepo.find.mockResolvedValue(standings);
      mockStandingRepo.save.mockImplementation((s) => Promise.resolve(s));
      mockCacheManager.del.mockResolvedValue(undefined);

      await service.calculatePlacements(mockTournament.id!);

      expect(mockStandingRepo.save).toHaveBeenCalled();
    });
  });
});
