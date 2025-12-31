import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BracketService } from '../bracket.service';
import { TournamentBracket, BracketFormat } from '../../entities/tournament-bracket.entity';
import { Tournament, TournamentStatus, TournamentFormat } from '../../entities/tournament.entity';
import { TournamentRegistration, RegistrationStatus } from '../../entities/tournament-registration.entity';
import { TournamentMatch, MatchStatus } from '../../entities/tournament-match.entity';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

describe('BracketService', () => {
  let service: BracketService;
  let bracketRepository: jest.Mocked<Repository<TournamentBracket>>;
  let tournamentRepository: jest.Mocked<Repository<Tournament>>;
  let registrationRepository: jest.Mocked<Repository<TournamentRegistration>>;
  let matchRepository: jest.Mocked<Repository<TournamentMatch>>;

  const mockTournament: Partial<Tournament> = {
    id: generateUUID(),
    name: 'Test Tournament',
    format: TournamentFormat.SINGLE_ELIMINATION,
    status: TournamentStatus.REGISTRATION_CLOSED,
    maxParticipants: 16,
    minParticipants: 2,
  };

  const mockBracket: Partial<TournamentBracket> = {
    id: generateUUID(),
    tournamentId: mockTournament.id!,
    format: BracketFormat.SINGLE_ELIMINATION,
    totalRounds: 4,
    currentRound: 1,
    participantCount: 16,
    structure: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBracketRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
  };

  const mockTournamentRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockRegistrationRepo = {
    find: jest.fn(),
    count: jest.fn(),
  };

  const mockMatchRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BracketService,
        {
          provide: getRepositoryToken(TournamentBracket),
          useValue: mockBracketRepo,
        },
        {
          provide: getRepositoryToken(Tournament),
          useValue: mockTournamentRepo,
        },
        {
          provide: getRepositoryToken(TournamentRegistration),
          useValue: mockRegistrationRepo,
        },
        {
          provide: getRepositoryToken(TournamentMatch),
          useValue: mockMatchRepo,
        },
      ],
    }).compile();

    service = module.get<BracketService>(BracketService);
    bracketRepository = module.get(getRepositoryToken(TournamentBracket));
    tournamentRepository = module.get(getRepositoryToken(Tournament));
    registrationRepository = module.get(getRepositoryToken(TournamentRegistration));
    matchRepository = module.get(getRepositoryToken(TournamentMatch));

    jest.clearAllMocks();
  });

  describe('generateBracket', () => {
    it('should generate single elimination bracket successfully', async () => {
      const participants = Array.from({ length: 8 }, (_, i) => ({
        id: generateUUID(),
        participantId: generateUUID(),
        participantName: `Player ${i + 1}`,
        status: RegistrationStatus.CHECKED_IN,
        seed: i + 1,
      }));

      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockBracketRepo.findOne.mockResolvedValue(null);
      mockRegistrationRepo.find.mockResolvedValue(participants);
      mockBracketRepo.create.mockReturnValue({
        ...mockBracket,
        participantCount: 8,
        totalRounds: 3,
      });
      mockBracketRepo.save.mockResolvedValue({
        ...mockBracket,
        participantCount: 8,
        totalRounds: 3,
      });
      mockMatchRepo.create.mockImplementation((dto) => dto);
      mockMatchRepo.save.mockImplementation((match) => Promise.resolve(match));

      const result = await service.generateBracket(mockTournament.id!);

      expect(result.participantCount).toBe(8);
      expect(result.totalRounds).toBe(3);
      expect(mockMatchRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException when bracket already exists', async () => {
      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockBracketRepo.findOne.mockResolvedValue(mockBracket);

      await expect(service.generateBracket(mockTournament.id!)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException when not enough participants', async () => {
      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockBracketRepo.findOne.mockResolvedValue(null);
      mockRegistrationRepo.find.mockResolvedValue([
        { id: generateUUID(), participantId: generateUUID(), status: RegistrationStatus.CHECKED_IN },
      ]);

      await expect(service.generateBracket(mockTournament.id!)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when tournament is not in correct status', async () => {
      mockTournamentRepo.findOne.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.DRAFT,
      });

      await expect(service.generateBracket(mockTournament.id!)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('generateDoubleEliminationBracket', () => {
    it('should generate double elimination bracket with winners and losers brackets', async () => {
      const participants = Array.from({ length: 8 }, (_, i) => ({
        id: generateUUID(),
        participantId: generateUUID(),
        participantName: `Player ${i + 1}`,
        status: RegistrationStatus.CHECKED_IN,
        seed: i + 1,
      }));

      mockTournamentRepo.findOne.mockResolvedValue({
        ...mockTournament,
        format: TournamentFormat.DOUBLE_ELIMINATION,
      });
      mockBracketRepo.findOne.mockResolvedValue(null);
      mockRegistrationRepo.find.mockResolvedValue(participants);
      mockBracketRepo.create.mockReturnValue({
        ...mockBracket,
        format: BracketFormat.DOUBLE_ELIMINATION,
        participantCount: 8,
      });
      mockBracketRepo.save.mockResolvedValue({
        ...mockBracket,
        format: BracketFormat.DOUBLE_ELIMINATION,
        participantCount: 8,
      });
      mockMatchRepo.create.mockImplementation((dto) => dto);
      mockMatchRepo.save.mockImplementation((match) => Promise.resolve(match));

      const result = await service.generateBracket(mockTournament.id!);

      expect(result.format).toBe(BracketFormat.DOUBLE_ELIMINATION);
    });
  });

  describe('generateSwissBracket', () => {
    it('should generate Swiss bracket with correct number of rounds', async () => {
      const participants = Array.from({ length: 16 }, (_, i) => ({
        id: generateUUID(),
        participantId: generateUUID(),
        participantName: `Player ${i + 1}`,
        status: RegistrationStatus.CHECKED_IN,
        seed: i + 1,
      }));

      mockTournamentRepo.findOne.mockResolvedValue({
        ...mockTournament,
        format: TournamentFormat.SWISS,
        swissRounds: 5,
      });
      mockBracketRepo.findOne.mockResolvedValue(null);
      mockRegistrationRepo.find.mockResolvedValue(participants);
      mockBracketRepo.create.mockReturnValue({
        ...mockBracket,
        format: BracketFormat.SWISS,
        totalRounds: 5,
        participantCount: 16,
      });
      mockBracketRepo.save.mockResolvedValue({
        ...mockBracket,
        format: BracketFormat.SWISS,
        totalRounds: 5,
        participantCount: 16,
      });
      mockMatchRepo.create.mockImplementation((dto) => dto);
      mockMatchRepo.save.mockImplementation((match) => Promise.resolve(match));

      const result = await service.generateBracket(mockTournament.id!);

      expect(result.format).toBe(BracketFormat.SWISS);
      expect(result.totalRounds).toBe(5);
    });
  });

  describe('generateRoundRobinBracket', () => {
    it('should generate round robin bracket with all matchups', async () => {
      const participants = Array.from({ length: 4 }, (_, i) => ({
        id: generateUUID(),
        participantId: generateUUID(),
        participantName: `Player ${i + 1}`,
        status: RegistrationStatus.CHECKED_IN,
        seed: i + 1,
      }));

      mockTournamentRepo.findOne.mockResolvedValue({
        ...mockTournament,
        format: TournamentFormat.ROUND_ROBIN,
      });
      mockBracketRepo.findOne.mockResolvedValue(null);
      mockRegistrationRepo.find.mockResolvedValue(participants);
      mockBracketRepo.create.mockReturnValue({
        ...mockBracket,
        format: BracketFormat.ROUND_ROBIN,
        participantCount: 4,
        totalRounds: 3,
      });
      mockBracketRepo.save.mockResolvedValue({
        ...mockBracket,
        format: BracketFormat.ROUND_ROBIN,
        participantCount: 4,
        totalRounds: 3,
      });
      mockMatchRepo.create.mockImplementation((dto) => dto);
      mockMatchRepo.save.mockImplementation((match) => Promise.resolve(match));

      const result = await service.generateBracket(mockTournament.id!);

      expect(result.format).toBe(BracketFormat.ROUND_ROBIN);
    });
  });

  describe('getBracket', () => {
    it('should return bracket when found', async () => {
      mockBracketRepo.findOne.mockResolvedValue(mockBracket);

      const result = await service.getBracket(mockBracket.id!);

      expect(result).toEqual(mockBracket);
    });

    it('should throw NotFoundException when bracket not found', async () => {
      mockBracketRepo.findOne.mockResolvedValue(null);

      await expect(service.getBracket('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getBracketByTournament', () => {
    it('should return bracket for tournament', async () => {
      mockBracketRepo.findOne.mockResolvedValue(mockBracket);

      const result = await service.getBracketByTournament(mockTournament.id!);

      expect(result).toEqual(mockBracket);
    });
  });

  describe('advanceRound', () => {
    it('should advance to next round when all matches are complete', async () => {
      const completedMatches = [
        { id: generateUUID(), round: 1, status: MatchStatus.COMPLETED },
        { id: generateUUID(), round: 1, status: MatchStatus.COMPLETED },
      ];

      mockBracketRepo.findOne.mockResolvedValue(mockBracket);
      mockMatchRepo.find.mockResolvedValue(completedMatches);
      mockBracketRepo.save.mockResolvedValue({
        ...mockBracket,
        currentRound: 2,
      });

      const result = await service.advanceRound(mockBracket.id!);

      expect(result.currentRound).toBe(2);
    });

    it('should throw BadRequestException when matches are not complete', async () => {
      const incompleteMatches = [
        { id: generateUUID(), round: 1, status: MatchStatus.COMPLETED },
        { id: generateUUID(), round: 1, status: MatchStatus.IN_PROGRESS },
      ];

      mockBracketRepo.findOne.mockResolvedValue(mockBracket);
      mockMatchRepo.find.mockResolvedValue(incompleteMatches);

      await expect(service.advanceRound(mockBracket.id!)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('reseedBracket', () => {
    it('should reseed bracket with new seeds', async () => {
      const newSeeds = [
        { participantId: generateUUID(), seed: 1 },
        { participantId: generateUUID(), seed: 2 },
      ];

      mockBracketRepo.findOne.mockResolvedValue({
        ...mockBracket,
        currentRound: 1,
      });
      mockMatchRepo.find.mockResolvedValue([
        { id: generateUUID(), round: 1, status: MatchStatus.SCHEDULED },
      ]);
      mockBracketRepo.save.mockResolvedValue(mockBracket);
      mockMatchRepo.remove.mockResolvedValue([]);
      mockMatchRepo.create.mockImplementation((dto) => dto);
      mockMatchRepo.save.mockImplementation((match) => Promise.resolve(match));

      const result = await service.reseedBracket(mockBracket.id!, newSeeds);

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when matches have started', async () => {
      mockBracketRepo.findOne.mockResolvedValue(mockBracket);
      mockMatchRepo.find.mockResolvedValue([
        { id: generateUUID(), round: 1, status: MatchStatus.IN_PROGRESS },
      ]);

      await expect(
        service.reseedBracket(mockBracket.id!, []),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteBracket', () => {
    it('should delete bracket and associated matches', async () => {
      mockBracketRepo.findOne.mockResolvedValue(mockBracket);
      mockMatchRepo.find.mockResolvedValue([
        { id: generateUUID(), status: MatchStatus.SCHEDULED },
      ]);
      mockMatchRepo.remove.mockResolvedValue([]);
      mockBracketRepo.remove.mockResolvedValue(mockBracket);

      await service.deleteBracket(mockBracket.id!);

      expect(mockBracketRepo.remove).toHaveBeenCalled();
      expect(mockMatchRepo.remove).toHaveBeenCalled();
    });

    it('should throw BadRequestException when matches are in progress', async () => {
      mockBracketRepo.findOne.mockResolvedValue(mockBracket);
      mockMatchRepo.find.mockResolvedValue([
        { id: generateUUID(), status: MatchStatus.IN_PROGRESS },
      ]);

      await expect(service.deleteBracket(mockBracket.id!)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getNextRoundMatches', () => {
    it('should return matches for next round', async () => {
      const nextRoundMatches = [
        { id: generateUUID(), round: 2, status: MatchStatus.SCHEDULED },
      ];

      mockBracketRepo.findOne.mockResolvedValue(mockBracket);
      mockMatchRepo.find.mockResolvedValue(nextRoundMatches);

      const result = await service.getNextRoundMatches(mockBracket.id!);

      expect(result).toHaveLength(1);
    });
  });

  describe('calculateTotalRounds', () => {
    it('should calculate correct rounds for power of 2', () => {
      expect(service.calculateTotalRounds(8, BracketFormat.SINGLE_ELIMINATION)).toBe(3);
      expect(service.calculateTotalRounds(16, BracketFormat.SINGLE_ELIMINATION)).toBe(4);
      expect(service.calculateTotalRounds(32, BracketFormat.SINGLE_ELIMINATION)).toBe(5);
    });

    it('should calculate correct rounds for non-power of 2', () => {
      expect(service.calculateTotalRounds(6, BracketFormat.SINGLE_ELIMINATION)).toBe(3);
      expect(service.calculateTotalRounds(12, BracketFormat.SINGLE_ELIMINATION)).toBe(4);
    });

    it('should calculate correct rounds for round robin', () => {
      expect(service.calculateTotalRounds(4, BracketFormat.ROUND_ROBIN)).toBe(3);
      expect(service.calculateTotalRounds(5, BracketFormat.ROUND_ROBIN)).toBe(5);
    });
  });

  describe('seedParticipants', () => {
    it('should seed participants for optimal bracket placement', () => {
      const participants = [
        { participantId: '1', seed: 1 },
        { participantId: '2', seed: 2 },
        { participantId: '3', seed: 3 },
        { participantId: '4', seed: 4 },
        { participantId: '5', seed: 5 },
        { participantId: '6', seed: 6 },
        { participantId: '7', seed: 7 },
        { participantId: '8', seed: 8 },
      ];

      const seeded = service.seedParticipants(participants as any);

      expect(seeded[0].seed).toBe(1);
      expect(seeded[seeded.length - 1].seed).toBe(2);
    });
  });

  describe('handleBye', () => {
    it('should handle bye correctly for odd number of participants', async () => {
      const participants = Array.from({ length: 7 }, (_, i) => ({
        id: generateUUID(),
        participantId: generateUUID(),
        participantName: `Player ${i + 1}`,
        status: RegistrationStatus.CHECKED_IN,
        seed: i + 1,
      }));

      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockBracketRepo.findOne.mockResolvedValue(null);
      mockRegistrationRepo.find.mockResolvedValue(participants);
      mockBracketRepo.create.mockReturnValue({
        ...mockBracket,
        participantCount: 7,
      });
      mockBracketRepo.save.mockResolvedValue({
        ...mockBracket,
        participantCount: 7,
      });
      mockMatchRepo.create.mockImplementation((dto) => dto);
      mockMatchRepo.save.mockImplementation((match) => Promise.resolve(match));

      const result = await service.generateBracket(mockTournament.id!);

      expect(result.participantCount).toBe(7);
    });
  });
});
