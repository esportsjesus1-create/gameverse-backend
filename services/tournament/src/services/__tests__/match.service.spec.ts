import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchService } from '../match.service';
import { TournamentMatch, MatchStatus } from '../../entities/tournament-match.entity';
import { Tournament, TournamentStatus } from '../../entities/tournament.entity';
import { TournamentStanding } from '../../entities/tournament-standing.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

describe('MatchService', () => {
  let service: MatchService;
  let matchRepository: jest.Mocked<Repository<TournamentMatch>>;
  let tournamentRepository: jest.Mocked<Repository<Tournament>>;
  let standingRepository: jest.Mocked<Repository<TournamentStanding>>;

  const mockTournament: Partial<Tournament> = {
    id: generateUUID(),
    name: 'Test Tournament',
    status: TournamentStatus.IN_PROGRESS,
  };

  const participant1Id = generateUUID();
  const participant2Id = generateUUID();

  const mockMatch: Partial<TournamentMatch> = {
    id: generateUUID(),
    tournamentId: mockTournament.id!,
    bracketId: generateUUID(),
    round: 1,
    matchNumber: 1,
    participant1Id,
    participant1Name: 'Player 1',
    participant2Id,
    participant2Name: 'Player 2',
    status: MatchStatus.SCHEDULED,
    scheduledTime: new Date(Date.now() + 3600000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMatchRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockTournamentRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockStandingRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchService,
        {
          provide: getRepositoryToken(TournamentMatch),
          useValue: mockMatchRepo,
        },
        {
          provide: getRepositoryToken(Tournament),
          useValue: mockTournamentRepo,
        },
        {
          provide: getRepositoryToken(TournamentStanding),
          useValue: mockStandingRepo,
        },
      ],
    }).compile();

    service = module.get<MatchService>(MatchService);
    matchRepository = module.get(getRepositoryToken(TournamentMatch));
    tournamentRepository = module.get(getRepositoryToken(Tournament));
    standingRepository = module.get(getRepositoryToken(TournamentStanding));

    jest.clearAllMocks();
  });

  describe('createMatch', () => {
    it('should create a match successfully', async () => {
      const dto = {
        tournamentId: mockTournament.id!,
        bracketId: generateUUID(),
        round: 1,
        matchNumber: 1,
        participant1Id,
        participant1Name: 'Player 1',
        participant2Id,
        participant2Name: 'Player 2',
        scheduledTime: new Date(Date.now() + 3600000).toISOString(),
      };

      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockMatchRepo.create.mockReturnValue({ ...mockMatch, ...dto });
      mockMatchRepo.save.mockResolvedValue({ ...mockMatch, ...dto });

      const result = await service.createMatch(dto);

      expect(result.participant1Name).toBe('Player 1');
      expect(result.participant2Name).toBe('Player 2');
      expect(result.status).toBe(MatchStatus.SCHEDULED);
    });

    it('should create a BYE match when participant2 is missing', async () => {
      const dto = {
        tournamentId: mockTournament.id!,
        bracketId: generateUUID(),
        round: 1,
        matchNumber: 1,
        participant1Id,
        participant1Name: 'Player 1',
        scheduledTime: new Date(Date.now() + 3600000).toISOString(),
      };

      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockMatchRepo.create.mockReturnValue({
        ...dto,
        status: MatchStatus.BYE,
        winnerId: participant1Id,
        winnerName: 'Player 1',
      });
      mockMatchRepo.save.mockResolvedValue({
        ...dto,
        status: MatchStatus.BYE,
        winnerId: participant1Id,
        winnerName: 'Player 1',
      });

      const result = await service.createMatch(dto);

      expect(result.status).toBe(MatchStatus.BYE);
      expect(result.winnerId).toBe(participant1Id);
    });
  });

  describe('getMatch', () => {
    it('should return match when found', async () => {
      mockMatchRepo.findOne.mockResolvedValue(mockMatch);

      const result = await service.getMatch(mockMatch.id!);

      expect(result).toEqual(mockMatch);
    });

    it('should throw NotFoundException when match not found', async () => {
      mockMatchRepo.findOne.mockResolvedValue(null);

      await expect(service.getMatch('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('startMatch', () => {
    it('should start match successfully', async () => {
      mockMatchRepo.findOne.mockResolvedValue(mockMatch);
      mockMatchRepo.save.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.IN_PROGRESS,
        actualStartTime: new Date(),
      });

      const result = await service.startMatch(mockMatch.id!);

      expect(result.status).toBe(MatchStatus.IN_PROGRESS);
      expect(result.actualStartTime).toBeDefined();
    });

    it('should throw BadRequestException when match is not scheduled', async () => {
      mockMatchRepo.findOne.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.COMPLETED,
      });

      await expect(service.startMatch(mockMatch.id!)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when participants are missing', async () => {
      mockMatchRepo.findOne.mockResolvedValue({
        ...mockMatch,
        participant2Id: null,
      });

      await expect(service.startMatch(mockMatch.id!)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('submitResult', () => {
    it('should submit result successfully', async () => {
      const dto = {
        winnerId: participant1Id,
        participant1Score: 3,
        participant2Score: 1,
      };

      mockMatchRepo.findOne.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.IN_PROGRESS,
      });
      mockMatchRepo.save.mockResolvedValue({
        ...mockMatch,
        ...dto,
        status: MatchStatus.AWAITING_CONFIRMATION,
        winnerName: 'Player 1',
        loserId: participant2Id,
        loserName: 'Player 2',
      });

      const result = await service.submitResult(mockMatch.id!, dto);

      expect(result.winnerId).toBe(participant1Id);
      expect(result.status).toBe(MatchStatus.AWAITING_CONFIRMATION);
    });

    it('should throw BadRequestException when winner is not a participant', async () => {
      const dto = {
        winnerId: generateUUID(),
        participant1Score: 3,
        participant2Score: 1,
      };

      mockMatchRepo.findOne.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.IN_PROGRESS,
      });

      await expect(service.submitResult(mockMatch.id!, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when match is not in progress', async () => {
      const dto = {
        winnerId: participant1Id,
        participant1Score: 3,
        participant2Score: 1,
      };

      mockMatchRepo.findOne.mockResolvedValue(mockMatch);

      await expect(service.submitResult(mockMatch.id!, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('confirmResult', () => {
    it('should confirm result successfully', async () => {
      mockMatchRepo.findOne.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.AWAITING_CONFIRMATION,
        winnerId: participant1Id,
      });
      mockMatchRepo.save.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.COMPLETED,
        winnerId: participant1Id,
        completedAt: new Date(),
      });
      mockStandingRepo.findOne.mockResolvedValue({
        participantId: participant1Id,
        wins: 0,
        losses: 0,
      });
      mockStandingRepo.save.mockResolvedValue({});

      const result = await service.confirmResult(mockMatch.id!, participant2Id);

      expect(result.status).toBe(MatchStatus.COMPLETED);
    });

    it('should throw BadRequestException when confirmer is the winner', async () => {
      mockMatchRepo.findOne.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.AWAITING_CONFIRMATION,
        winnerId: participant1Id,
      });

      await expect(
        service.confirmResult(mockMatch.id!, participant1Id),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('disputeResult', () => {
    it('should dispute result successfully', async () => {
      const dto = {
        disputedBy: participant2Id,
        reason: 'Score was incorrect',
        evidence: 'screenshot.png',
      };

      mockMatchRepo.findOne.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.AWAITING_CONFIRMATION,
      });
      mockMatchRepo.save.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.DISPUTED,
        disputedBy: dto.disputedBy,
        disputeReason: dto.reason,
        disputeEvidence: dto.evidence,
      });

      const result = await service.disputeResult(mockMatch.id!, dto);

      expect(result.status).toBe(MatchStatus.DISPUTED);
      expect(result.disputeReason).toBe('Score was incorrect');
    });

    it('should throw BadRequestException when match is not awaiting confirmation', async () => {
      const dto = {
        disputedBy: participant2Id,
        reason: 'Score was incorrect',
      };

      mockMatchRepo.findOne.mockResolvedValue(mockMatch);

      await expect(service.disputeResult(mockMatch.id!, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('resolveDispute', () => {
    it('should resolve dispute successfully', async () => {
      const dto = {
        resolvedBy: generateUUID(),
        resolution: 'Player 1 wins based on evidence',
        winnerId: participant1Id,
        participant1Score: 3,
        participant2Score: 1,
      };

      mockMatchRepo.findOne.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.DISPUTED,
      });
      mockMatchRepo.save.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.COMPLETED,
        winnerId: participant1Id,
        disputeResolvedBy: dto.resolvedBy,
        disputeResolution: dto.resolution,
      });
      mockStandingRepo.findOne.mockResolvedValue({
        participantId: participant1Id,
        wins: 0,
        losses: 0,
      });
      mockStandingRepo.save.mockResolvedValue({});

      const result = await service.resolveDispute(mockMatch.id!, dto);

      expect(result.status).toBe(MatchStatus.COMPLETED);
      expect(result.disputeResolution).toBe('Player 1 wins based on evidence');
    });
  });

  describe('adminOverride', () => {
    it('should override match result successfully', async () => {
      const dto = {
        adminId: generateUUID(),
        winnerId: participant2Id,
        participant1Score: 1,
        participant2Score: 3,
        reason: 'Correcting scoring error',
      };

      mockMatchRepo.findOne.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.COMPLETED,
        winnerId: participant1Id,
      });
      mockMatchRepo.save.mockResolvedValue({
        ...mockMatch,
        winnerId: participant2Id,
        adminOverrideBy: dto.adminId,
        adminOverrideReason: dto.reason,
      });
      mockStandingRepo.findOne.mockResolvedValue({
        participantId: participant1Id,
        wins: 1,
        losses: 0,
      });
      mockStandingRepo.save.mockResolvedValue({});

      const result = await service.adminOverride(mockMatch.id!, dto);

      expect(result.winnerId).toBe(participant2Id);
      expect(result.adminOverrideReason).toBe('Correcting scoring error');
    });
  });

  describe('forfeit', () => {
    it('should forfeit match successfully', async () => {
      mockMatchRepo.findOne.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.IN_PROGRESS,
      });
      mockMatchRepo.save.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.FORFEIT,
        winnerId: participant2Id,
        forfeitedBy: participant1Id,
      });
      mockStandingRepo.findOne.mockResolvedValue({
        participantId: participant1Id,
        wins: 0,
        losses: 0,
        forfeits: 0,
      });
      mockStandingRepo.save.mockResolvedValue({});

      const result = await service.forfeit(mockMatch.id!, participant1Id, 'Cannot continue');

      expect(result.status).toBe(MatchStatus.FORFEIT);
      expect(result.forfeitedBy).toBe(participant1Id);
      expect(result.winnerId).toBe(participant2Id);
    });

    it('should throw BadRequestException when forfeiter is not a participant', async () => {
      mockMatchRepo.findOne.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.IN_PROGRESS,
      });

      await expect(
        service.forfeit(mockMatch.id!, generateUUID(), 'Test'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reschedule', () => {
    it('should reschedule match successfully', async () => {
      const newTime = new Date(Date.now() + 7200000);

      mockMatchRepo.findOne.mockResolvedValue(mockMatch);
      mockMatchRepo.save.mockResolvedValue({
        ...mockMatch,
        scheduledTime: newTime,
        rescheduledFrom: mockMatch.scheduledTime,
      });

      const result = await service.reschedule(mockMatch.id!, newTime.toISOString());

      expect(result.scheduledTime).toEqual(newTime);
    });

    it('should throw BadRequestException when match is completed', async () => {
      mockMatchRepo.findOne.mockResolvedValue({
        ...mockMatch,
        status: MatchStatus.COMPLETED,
      });

      await expect(
        service.reschedule(mockMatch.id!, new Date().toISOString()),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMatchesByTournament', () => {
    it('should return all matches for a tournament', async () => {
      const matches = [mockMatch, { ...mockMatch, id: generateUUID(), matchNumber: 2 }];
      mockMatchRepo.find.mockResolvedValue(matches);

      const result = await service.getMatchesByTournament(mockTournament.id!);

      expect(result).toHaveLength(2);
    });
  });

  describe('getMatchesByRound', () => {
    it('should return matches for a specific round', async () => {
      mockMatchRepo.find.mockResolvedValue([mockMatch]);

      const result = await service.getMatchesByRound(mockTournament.id!, 1);

      expect(result).toHaveLength(1);
      expect(result[0].round).toBe(1);
    });
  });

  describe('getUpcomingMatches', () => {
    it('should return upcoming matches for a participant', async () => {
      mockMatchRepo.find.mockResolvedValue([mockMatch]);

      const result = await service.getUpcomingMatches(participant1Id);

      expect(result).toHaveLength(1);
    });
  });

  describe('setLobbyCode', () => {
    it('should set lobby code successfully', async () => {
      mockMatchRepo.findOne.mockResolvedValue(mockMatch);
      mockMatchRepo.save.mockResolvedValue({
        ...mockMatch,
        lobbyCode: 'ABC123',
      });

      const result = await service.setLobbyCode(mockMatch.id!, 'ABC123');

      expect(result.lobbyCode).toBe('ABC123');
    });
  });

  describe('setStreamUrl', () => {
    it('should set stream URL successfully', async () => {
      mockMatchRepo.findOne.mockResolvedValue(mockMatch);
      mockMatchRepo.save.mockResolvedValue({
        ...mockMatch,
        streamUrl: 'https://twitch.tv/test',
      });

      const result = await service.setStreamUrl(mockMatch.id!, 'https://twitch.tv/test');

      expect(result.streamUrl).toBe('https://twitch.tv/test');
    });
  });
});
