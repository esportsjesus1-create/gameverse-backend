import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrizeService } from '../prize.service';
import { TournamentPrize, PrizeStatus, PrizeType } from '../../entities/tournament-prize.entity';
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

describe('PrizeService', () => {
  let service: PrizeService;
  let prizeRepository: jest.Mocked<Repository<TournamentPrize>>;
  let tournamentRepository: jest.Mocked<Repository<Tournament>>;
  let standingRepository: jest.Mocked<Repository<TournamentStanding>>;

  const mockTournament: Partial<Tournament> = {
    id: generateUUID(),
    name: 'Test Tournament',
    status: TournamentStatus.COMPLETED,
    prizePool: 10000,
    prizeCurrency: 'USD',
    prizeDistribution: { 1: 50, 2: 30, 3: 15, 4: 5 },
  };

  const mockPrize: Partial<TournamentPrize> = {
    id: generateUUID(),
    tournamentId: mockTournament.id!,
    participantId: generateUUID(),
    participantName: 'Winner',
    placement: 1,
    prizeType: PrizeType.CURRENCY,
    amount: 5000,
    currency: 'USD',
    status: PrizeStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStanding: Partial<TournamentStanding> = {
    id: generateUUID(),
    tournamentId: mockTournament.id!,
    participantId: mockPrize.participantId!,
    participantName: 'Winner',
    placement: 1,
  };

  const mockPrizeRepo = {
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
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrizeService,
        {
          provide: getRepositoryToken(TournamentPrize),
          useValue: mockPrizeRepo,
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

    service = module.get<PrizeService>(PrizeService);
    prizeRepository = module.get(getRepositoryToken(TournamentPrize));
    tournamentRepository = module.get(getRepositoryToken(Tournament));
    standingRepository = module.get(getRepositoryToken(TournamentStanding));

    jest.clearAllMocks();
  });

  describe('calculatePrizes', () => {
    it('should calculate prizes based on prize distribution', async () => {
      const standings = [
        { ...mockStanding, placement: 1 },
        { ...mockStanding, id: generateUUID(), participantId: generateUUID(), placement: 2 },
        { ...mockStanding, id: generateUUID(), participantId: generateUUID(), placement: 3 },
        { ...mockStanding, id: generateUUID(), participantId: generateUUID(), placement: 4 },
      ];

      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockStandingRepo.find.mockResolvedValue(standings);
      mockPrizeRepo.find.mockResolvedValue([]);
      mockPrizeRepo.create.mockImplementation((dto) => dto);
      mockPrizeRepo.save.mockImplementation((prize) => Promise.resolve(prize));

      const result = await service.calculatePrizes(mockTournament.id!);

      expect(result).toHaveLength(4);
      expect(result[0].amount).toBe(5000);
      expect(result[1].amount).toBe(3000);
      expect(result[2].amount).toBe(1500);
      expect(result[3].amount).toBe(500);
    });

    it('should throw BadRequestException when tournament is not completed', async () => {
      mockTournamentRepo.findOne.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.IN_PROGRESS,
      });

      await expect(service.calculatePrizes(mockTournament.id!)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when prizes already calculated', async () => {
      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockPrizeRepo.find.mockResolvedValue([mockPrize]);

      await expect(service.calculatePrizes(mockTournament.id!)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when no prize pool', async () => {
      mockTournamentRepo.findOne.mockResolvedValue({
        ...mockTournament,
        prizePool: 0,
      });

      await expect(service.calculatePrizes(mockTournament.id!)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getPrize', () => {
    it('should return prize when found', async () => {
      mockPrizeRepo.findOne.mockResolvedValue(mockPrize);

      const result = await service.getPrize(mockPrize.id!);

      expect(result).toEqual(mockPrize);
    });

    it('should throw NotFoundException when prize not found', async () => {
      mockPrizeRepo.findOne.mockResolvedValue(null);

      await expect(service.getPrize('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPrizesByTournament', () => {
    it('should return all prizes for a tournament', async () => {
      const prizes = [
        mockPrize,
        { ...mockPrize, id: generateUUID(), placement: 2, amount: 3000 },
      ];

      mockPrizeRepo.find.mockResolvedValue(prizes);

      const result = await service.getPrizesByTournament(mockTournament.id!);

      expect(result).toHaveLength(2);
    });
  });

  describe('getPrizesByParticipant', () => {
    it('should return all prizes for a participant', async () => {
      mockPrizeRepo.find.mockResolvedValue([mockPrize]);

      const result = await service.getPrizesByParticipant(mockPrize.participantId!);

      expect(result).toHaveLength(1);
    });
  });

  describe('distributePrize', () => {
    it('should distribute prize successfully', async () => {
      mockPrizeRepo.findOne.mockResolvedValue(mockPrize);
      mockPrizeRepo.save.mockResolvedValue({
        ...mockPrize,
        status: PrizeStatus.DISTRIBUTED,
        distributedAt: new Date(),
        transactionId: 'tx-123',
      });

      const result = await service.distributePrize(mockPrize.id!, 'tx-123');

      expect(result.status).toBe(PrizeStatus.DISTRIBUTED);
      expect(result.transactionId).toBe('tx-123');
    });

    it('should throw BadRequestException when prize already distributed', async () => {
      mockPrizeRepo.findOne.mockResolvedValue({
        ...mockPrize,
        status: PrizeStatus.DISTRIBUTED,
      });

      await expect(service.distributePrize(mockPrize.id!, 'tx-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when prize is cancelled', async () => {
      mockPrizeRepo.findOne.mockResolvedValue({
        ...mockPrize,
        status: PrizeStatus.CANCELLED,
      });

      await expect(service.distributePrize(mockPrize.id!, 'tx-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('distributeAllPrizes', () => {
    it('should distribute all pending prizes', async () => {
      const prizes = [
        { ...mockPrize, status: PrizeStatus.PENDING },
        { ...mockPrize, id: generateUUID(), status: PrizeStatus.PENDING },
      ];

      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockPrizeRepo.find.mockResolvedValue(prizes);
      mockPrizeRepo.save.mockImplementation((prize) =>
        Promise.resolve({ ...prize, status: PrizeStatus.DISTRIBUTED }),
      );

      const result = await service.distributeAllPrizes(mockTournament.id!);

      expect(result.distributed).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should handle partial failures', async () => {
      const prizes = [
        { ...mockPrize, status: PrizeStatus.PENDING },
        { ...mockPrize, id: generateUUID(), status: PrizeStatus.PENDING },
      ];

      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockPrizeRepo.find.mockResolvedValue(prizes);
      mockPrizeRepo.save
        .mockResolvedValueOnce({ ...prizes[0], status: PrizeStatus.DISTRIBUTED })
        .mockRejectedValueOnce(new Error('Distribution failed'));

      const result = await service.distributeAllPrizes(mockTournament.id!);

      expect(result.distributed).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('cancelPrize', () => {
    it('should cancel prize successfully', async () => {
      mockPrizeRepo.findOne.mockResolvedValue(mockPrize);
      mockPrizeRepo.save.mockResolvedValue({
        ...mockPrize,
        status: PrizeStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: 'Disqualified',
      });

      const result = await service.cancelPrize(mockPrize.id!, 'Disqualified');

      expect(result.status).toBe(PrizeStatus.CANCELLED);
      expect(result.cancellationReason).toBe('Disqualified');
    });

    it('should throw BadRequestException when prize already distributed', async () => {
      mockPrizeRepo.findOne.mockResolvedValue({
        ...mockPrize,
        status: PrizeStatus.DISTRIBUTED,
      });

      await expect(service.cancelPrize(mockPrize.id!, 'Test')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('recalculatePrizes', () => {
    it('should recalculate prizes after disqualification', async () => {
      const standings = [
        { ...mockStanding, placement: 1 },
        { ...mockStanding, id: generateUUID(), participantId: generateUUID(), placement: 2 },
      ];

      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockPrizeRepo.find.mockResolvedValue([
        { ...mockPrize, status: PrizeStatus.PENDING },
      ]);
      mockPrizeRepo.remove.mockResolvedValue([]);
      mockStandingRepo.find.mockResolvedValue(standings);
      mockPrizeRepo.create.mockImplementation((dto) => dto);
      mockPrizeRepo.save.mockImplementation((prize) => Promise.resolve(prize));

      const result = await service.recalculatePrizes(mockTournament.id!);

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when prizes already distributed', async () => {
      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockPrizeRepo.find.mockResolvedValue([
        { ...mockPrize, status: PrizeStatus.DISTRIBUTED },
      ]);

      await expect(service.recalculatePrizes(mockTournament.id!)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('addBonusPrize', () => {
    it('should add bonus prize successfully', async () => {
      const dto = {
        tournamentId: mockTournament.id!,
        participantId: generateUUID(),
        participantName: 'MVP',
        prizeType: PrizeType.CURRENCY,
        amount: 500,
        currency: 'USD',
        description: 'MVP Award',
      };

      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockPrizeRepo.create.mockReturnValue({
        ...dto,
        placement: 0,
        status: PrizeStatus.PENDING,
      });
      mockPrizeRepo.save.mockResolvedValue({
        ...dto,
        id: generateUUID(),
        placement: 0,
        status: PrizeStatus.PENDING,
      });

      const result = await service.addBonusPrize(dto);

      expect(result.description).toBe('MVP Award');
      expect(result.placement).toBe(0);
    });
  });

  describe('getPrizePool', () => {
    it('should return prize pool summary', async () => {
      const prizes = [
        { ...mockPrize, amount: 5000, status: PrizeStatus.DISTRIBUTED },
        { ...mockPrize, id: generateUUID(), amount: 3000, status: PrizeStatus.PENDING },
        { ...mockPrize, id: generateUUID(), amount: 1500, status: PrizeStatus.PENDING },
      ];

      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockPrizeRepo.find.mockResolvedValue(prizes);

      const result = await service.getPrizePoolSummary(mockTournament.id!);

      expect(result.totalPool).toBe(10000);
      expect(result.distributed).toBe(5000);
      expect(result.pending).toBe(4500);
    });
  });

  describe('claimPrize', () => {
    it('should mark prize as claimed', async () => {
      mockPrizeRepo.findOne.mockResolvedValue({
        ...mockPrize,
        status: PrizeStatus.DISTRIBUTED,
      });
      mockPrizeRepo.save.mockResolvedValue({
        ...mockPrize,
        status: PrizeStatus.CLAIMED,
        claimedAt: new Date(),
      });

      const result = await service.claimPrize(mockPrize.id!, mockPrize.participantId!);

      expect(result.status).toBe(PrizeStatus.CLAIMED);
    });

    it('should throw BadRequestException when not the prize owner', async () => {
      mockPrizeRepo.findOne.mockResolvedValue(mockPrize);

      await expect(
        service.claimPrize(mockPrize.id!, generateUUID()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when prize not distributed', async () => {
      mockPrizeRepo.findOne.mockResolvedValue(mockPrize);

      await expect(
        service.claimPrize(mockPrize.id!, mockPrize.participantId!),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getNFTPrizes', () => {
    it('should return NFT prizes', async () => {
      const nftPrizes = [
        { ...mockPrize, prizeType: PrizeType.NFT, nftTokenId: 'nft-123' },
      ];

      mockPrizeRepo.find.mockResolvedValue(nftPrizes);

      const result = await service.getNFTPrizes(mockTournament.id!);

      expect(result).toHaveLength(1);
      expect(result[0].prizeType).toBe(PrizeType.NFT);
    });
  });

  describe('getItemPrizes', () => {
    it('should return item prizes', async () => {
      const itemPrizes = [
        { ...mockPrize, prizeType: PrizeType.ITEM, itemId: 'item-123' },
      ];

      mockPrizeRepo.find.mockResolvedValue(itemPrizes);

      const result = await service.getItemPrizes(mockTournament.id!);

      expect(result).toHaveLength(1);
      expect(result[0].prizeType).toBe(PrizeType.ITEM);
    });
  });

  describe('validatePrizeDistribution', () => {
    it('should validate prize distribution totals 100% or less', () => {
      const validDistribution = { 1: 50, 2: 30, 3: 15, 4: 5 };
      expect(service.validatePrizeDistribution(validDistribution)).toBe(true);
    });

    it('should reject distribution exceeding 100%', () => {
      const invalidDistribution = { 1: 60, 2: 50 };
      expect(service.validatePrizeDistribution(invalidDistribution)).toBe(false);
    });
  });

  describe('getPendingDistributions', () => {
    it('should return all pending prize distributions', async () => {
      const pendingPrizes = [
        { ...mockPrize, status: PrizeStatus.PENDING },
        { ...mockPrize, id: generateUUID(), status: PrizeStatus.PENDING },
      ];

      mockPrizeRepo.find.mockResolvedValue(pendingPrizes);

      const result = await service.getPendingDistributions();

      expect(result).toHaveLength(2);
    });
  });

  describe('getDistributionHistory', () => {
    it('should return distribution history for a tournament', async () => {
      const distributedPrizes = [
        {
          ...mockPrize,
          status: PrizeStatus.DISTRIBUTED,
          distributedAt: new Date(),
          transactionId: 'tx-123',
        },
      ];

      mockPrizeRepo.find.mockResolvedValue(distributedPrizes);

      const result = await service.getDistributionHistory(mockTournament.id!);

      expect(result).toHaveLength(1);
      expect(result[0].transactionId).toBe('tx-123');
    });
  });
});
