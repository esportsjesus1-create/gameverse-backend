import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TournamentService } from '../tournament.service';
import {
  Tournament,
  TournamentFormat,
  TournamentStatus,
  TournamentVisibility,
} from '../../entities/tournament.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

describe('TournamentService', () => {
  let service: TournamentService;
  let repository: jest.Mocked<Repository<Tournament>>;

  const mockTournament: Partial<Tournament> = {
    id: generateUUID(),
    name: 'Test Tournament',
    description: 'A test tournament',
    gameId: 'game-123',
    gameName: 'Test Game',
    format: TournamentFormat.SINGLE_ELIMINATION,
    status: TournamentStatus.DRAFT,
    visibility: TournamentVisibility.PUBLIC,
    organizerId: generateUUID(),
    organizerName: 'Test Organizer',
    teamSize: 1,
    maxParticipants: 16,
    minParticipants: 2,
    prizePool: 1000,
    prizeCurrency: 'USD',
    startDate: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentService,
        {
          provide: getRepositoryToken(Tournament),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TournamentService>(TournamentService);
    repository = module.get(getRepositoryToken(Tournament));

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a tournament successfully', async () => {
      const createDto = {
        name: 'New Tournament',
        gameId: 'game-123',
        format: TournamentFormat.SINGLE_ELIMINATION,
        organizerId: generateUUID(),
        startDate: new Date(Date.now() + 86400000).toISOString(),
      };

      mockRepository.create.mockReturnValue({ ...mockTournament, ...createDto });
      mockRepository.save.mockResolvedValue({ ...mockTournament, ...createDto });

      const result = await service.create(createDto);

      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.name).toBe(createDto.name);
    });

    it('should create tournament with prize distribution', async () => {
      const createDto = {
        name: 'Prize Tournament',
        gameId: 'game-123',
        format: TournamentFormat.SINGLE_ELIMINATION,
        organizerId: generateUUID(),
        startDate: new Date(Date.now() + 86400000).toISOString(),
        prizeDistribution: [
          { placement: 1, percentage: 50 },
          { placement: 2, percentage: 30 },
          { placement: 3, percentage: 20 },
        ],
      };

      mockRepository.create.mockReturnValue({
        ...mockTournament,
        ...createDto,
        prizeDistribution: { 1: 50, 2: 30, 3: 20 },
      });
      mockRepository.save.mockResolvedValue({
        ...mockTournament,
        ...createDto,
        prizeDistribution: { 1: 50, 2: 30, 3: 20 },
      });

      const result = await service.create(createDto);

      expect(result.prizeDistribution).toEqual({ 1: 50, 2: 30, 3: 20 });
    });
  });

  describe('findById', () => {
    it('should return a tournament when found', async () => {
      mockRepository.findOne.mockResolvedValue(mockTournament);

      const result = await service.findById(mockTournament.id!);

      expect(result).toEqual(mockTournament);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockTournament.id },
        relations: ['registrations', 'matches', 'brackets', 'standings', 'prizes'],
      });
    });

    it('should throw NotFoundException when tournament not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated tournaments', async () => {
      const tournaments = [mockTournament, { ...mockTournament, id: generateUUID() }];
      mockRepository.findAndCount.mockResolvedValue([tournaments, 2]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by gameId', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockTournament], 1]);

      await service.findAll({ gameId: 'game-123' });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ gameId: 'game-123' }),
        }),
      );
    });

    it('should filter by status', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockTournament], 1]);

      await service.findAll({ status: TournamentStatus.DRAFT });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: TournamentStatus.DRAFT }),
        }),
      );
    });

    it('should filter by multiple statuses', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockTournament], 1]);

      await service.findAll({
        status: [TournamentStatus.DRAFT, TournamentStatus.REGISTRATION_OPEN],
      });

      expect(mockRepository.findAndCount).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update tournament successfully', async () => {
      const updateDto = { name: 'Updated Tournament' };
      mockRepository.findOne.mockResolvedValue(mockTournament);
      mockRepository.save.mockResolvedValue({ ...mockTournament, ...updateDto });

      const result = await service.update(mockTournament.id!, updateDto);

      expect(result.name).toBe('Updated Tournament');
    });

    it('should throw BadRequestException when updating completed tournament', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.COMPLETED,
      });

      await expect(
        service.update(mockTournament.id!, { name: 'Updated' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when updating cancelled tournament', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.CANCELLED,
      });

      await expect(
        service.update(mockTournament.id!, { name: 'Updated' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should delete tournament successfully', async () => {
      mockRepository.findOne.mockResolvedValue(mockTournament);
      mockRepository.remove.mockResolvedValue(mockTournament);

      await service.delete(mockTournament.id!);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockTournament);
    });

    it('should throw BadRequestException when deleting in-progress tournament', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.IN_PROGRESS,
      });

      await expect(service.delete(mockTournament.id!)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('setFormat', () => {
    it('should set format when tournament is in draft status', async () => {
      mockRepository.findOne.mockResolvedValue(mockTournament);
      mockRepository.save.mockResolvedValue({
        ...mockTournament,
        format: TournamentFormat.DOUBLE_ELIMINATION,
      });

      const result = await service.setFormat(
        mockTournament.id!,
        TournamentFormat.DOUBLE_ELIMINATION,
      );

      expect(result.format).toBe(TournamentFormat.DOUBLE_ELIMINATION);
    });

    it('should throw BadRequestException when tournament is not in draft status', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.REGISTRATION_OPEN,
      });

      await expect(
        service.setFormat(mockTournament.id!, TournamentFormat.DOUBLE_ELIMINATION),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    it('should transition from DRAFT to REGISTRATION_OPEN', async () => {
      mockRepository.findOne.mockResolvedValue(mockTournament);
      mockRepository.save.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.REGISTRATION_OPEN,
      });

      const result = await service.updateStatus(
        mockTournament.id!,
        TournamentStatus.REGISTRATION_OPEN,
      );

      expect(result.status).toBe(TournamentStatus.REGISTRATION_OPEN);
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      mockRepository.findOne.mockResolvedValue(mockTournament);

      await expect(
        service.updateStatus(mockTournament.id!, TournamentStatus.COMPLETED),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow cancellation from any non-terminal state', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.IN_PROGRESS,
      });
      mockRepository.save.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.CANCELLED,
      });

      const result = await service.updateStatus(
        mockTournament.id!,
        TournamentStatus.CANCELLED,
      );

      expect(result.status).toBe(TournamentStatus.CANCELLED);
    });

    it('should not allow transition from COMPLETED', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.COMPLETED,
      });

      await expect(
        service.updateStatus(mockTournament.id!, TournamentStatus.CANCELLED),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('configureRegistration', () => {
    it('should configure registration settings in draft status', async () => {
      mockRepository.findOne.mockResolvedValue(mockTournament);
      mockRepository.save.mockResolvedValue({
        ...mockTournament,
        maxParticipants: 32,
        teamSize: 5,
      });

      const result = await service.configureRegistration(mockTournament.id!, {
        maxParticipants: 32,
        teamSize: 5,
      });

      expect(result.maxParticipants).toBe(32);
      expect(result.teamSize).toBe(5);
    });

    it('should throw BadRequestException when tournament is in progress', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.IN_PROGRESS,
      });

      await expect(
        service.configureRegistration(mockTournament.id!, { maxParticipants: 32 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('configurePrizePool', () => {
    it('should configure prize pool successfully', async () => {
      mockRepository.findOne.mockResolvedValue(mockTournament);
      mockRepository.save.mockResolvedValue({
        ...mockTournament,
        prizePool: 5000,
        prizeCurrency: 'EUR',
      });

      const result = await service.configurePrizePool(mockTournament.id!, {
        prizePool: 5000,
        prizeCurrency: 'EUR',
      });

      expect(result.prizePool).toBe(5000);
      expect(result.prizeCurrency).toBe('EUR');
    });

    it('should throw BadRequestException when prize distribution exceeds 100%', async () => {
      mockRepository.findOne.mockResolvedValue(mockTournament);

      await expect(
        service.configurePrizePool(mockTournament.id!, {
          prizePool: 5000,
          prizeDistribution: [
            { placement: 1, percentage: 60 },
            { placement: 2, percentage: 50 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cloneAsTemplate', () => {
    it('should clone tournament as template', async () => {
      const newOrganizerId = generateUUID();
      mockRepository.findOne.mockResolvedValue(mockTournament);
      mockRepository.create.mockReturnValue({
        ...mockTournament,
        id: generateUUID(),
        name: 'Cloned Tournament',
        organizerId: newOrganizerId,
        status: TournamentStatus.DRAFT,
        templateId: mockTournament.id,
      });
      mockRepository.save.mockResolvedValue({
        ...mockTournament,
        id: generateUUID(),
        name: 'Cloned Tournament',
        organizerId: newOrganizerId,
        status: TournamentStatus.DRAFT,
        templateId: mockTournament.id,
      });

      const result = await service.cloneAsTemplate(
        mockTournament.id!,
        'Cloned Tournament',
        newOrganizerId,
      );

      expect(result.name).toBe('Cloned Tournament');
      expect(result.status).toBe(TournamentStatus.DRAFT);
      expect(result.templateId).toBe(mockTournament.id);
    });
  });

  describe('getPublicTournaments', () => {
    it('should return only public tournaments with open/in-progress status', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockTournament], 1]);

      await service.getPublicTournaments({});

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            visibility: TournamentVisibility.PUBLIC,
          }),
        }),
      );
    });
  });

  describe('getUpcomingTournaments', () => {
    it('should return upcoming tournaments', async () => {
      mockRepository.find.mockResolvedValue([mockTournament]);

      const result = await service.getUpcomingTournaments('game-123', 10);

      expect(result).toHaveLength(1);
      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { startDate: 'ASC' },
          take: 10,
        }),
      );
    });
  });

  describe('lifecycle methods', () => {
    it('openRegistration should update status to REGISTRATION_OPEN', async () => {
      mockRepository.findOne.mockResolvedValue(mockTournament);
      mockRepository.save.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.REGISTRATION_OPEN,
      });

      const result = await service.openRegistration(mockTournament.id!);

      expect(result.status).toBe(TournamentStatus.REGISTRATION_OPEN);
    });

    it('closeRegistration should update status to REGISTRATION_CLOSED', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.REGISTRATION_OPEN,
      });
      mockRepository.save.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.REGISTRATION_CLOSED,
      });

      const result = await service.closeRegistration(mockTournament.id!);

      expect(result.status).toBe(TournamentStatus.REGISTRATION_CLOSED);
    });

    it('startTournament should update status to IN_PROGRESS', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.CHECK_IN,
      });
      mockRepository.save.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.IN_PROGRESS,
      });

      const result = await service.startTournament(mockTournament.id!);

      expect(result.status).toBe(TournamentStatus.IN_PROGRESS);
    });

    it('completeTournament should update status to COMPLETED', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.IN_PROGRESS,
      });
      mockRepository.save.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.COMPLETED,
      });

      const result = await service.completeTournament(mockTournament.id!);

      expect(result.status).toBe(TournamentStatus.COMPLETED);
    });

    it('cancelTournament should update status to CANCELLED', async () => {
      mockRepository.findOne.mockResolvedValue(mockTournament);
      mockRepository.save.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.CANCELLED,
      });

      const result = await service.cancelTournament(mockTournament.id!);

      expect(result.status).toBe(TournamentStatus.CANCELLED);
    });
  });
});
