import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegistrationService } from '../registration.service';
import {
  TournamentRegistration,
  RegistrationStatus,
} from '../../entities/tournament-registration.entity';
import { Tournament, TournamentStatus } from '../../entities/tournament.entity';
import { TournamentStanding } from '../../entities/tournament-standing.entity';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

describe('RegistrationService', () => {
  let service: RegistrationService;
  let registrationRepository: jest.Mocked<Repository<TournamentRegistration>>;
  let tournamentRepository: jest.Mocked<Repository<Tournament>>;
  let standingRepository: jest.Mocked<Repository<TournamentStanding>>;

  const mockTournament: Partial<Tournament> = {
    id: generateUUID(),
    name: 'Test Tournament',
    status: TournamentStatus.REGISTRATION_OPEN,
    teamSize: 1,
    maxParticipants: 16,
    minParticipants: 2,
    minMmr: 1000,
    maxMmr: 3000,
    requiresIdentityVerification: false,
    allowedRegions: ['NA', 'EU'],
    entryFee: 0,
  };

  const mockRegistration: Partial<TournamentRegistration> = {
    id: generateUUID(),
    tournamentId: mockTournament.id!,
    participantId: generateUUID(),
    participantName: 'Test Player',
    status: RegistrationStatus.CONFIRMED,
    mmr: 1500,
    identityVerified: true,
    region: 'NA',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRegistrationRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
  };

  const mockTournamentRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockStandingRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationService,
        {
          provide: getRepositoryToken(TournamentRegistration),
          useValue: mockRegistrationRepo,
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

    service = module.get<RegistrationService>(RegistrationService);
    registrationRepository = module.get(getRepositoryToken(TournamentRegistration));
    tournamentRepository = module.get(getRepositoryToken(Tournament));
    standingRepository = module.get(getRepositoryToken(TournamentStanding));

    jest.clearAllMocks();
  });

  describe('registerIndividual', () => {
    it('should register individual player successfully', async () => {
      const dto = {
        tournamentId: mockTournament.id!,
        participantId: generateUUID(),
        participantName: 'New Player',
        mmr: 1500,
        identityVerified: true,
        region: 'NA',
      };

      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockRegistrationRepo.findOne.mockResolvedValue(null);
      mockRegistrationRepo.count.mockResolvedValue(5);
      mockRegistrationRepo.create.mockReturnValue({ ...mockRegistration, ...dto });
      mockRegistrationRepo.save.mockResolvedValue({ ...mockRegistration, ...dto });
      mockStandingRepo.create.mockReturnValue({});
      mockStandingRepo.save.mockResolvedValue({});

      const result = await service.registerIndividual(dto);

      expect(result.participantName).toBe('New Player');
      expect(result.status).toBe(RegistrationStatus.CONFIRMED);
    });

    it('should throw ConflictException for duplicate registration', async () => {
      const dto = {
        tournamentId: mockTournament.id!,
        participantId: mockRegistration.participantId!,
        participantName: 'Test Player',
      };

      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockRegistrationRepo.findOne.mockResolvedValue(mockRegistration);

      await expect(service.registerIndividual(dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should add to waitlist when tournament is full', async () => {
      const dto = {
        tournamentId: mockTournament.id!,
        participantId: generateUUID(),
        participantName: 'Waitlist Player',
      };

      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockRegistrationRepo.findOne.mockResolvedValueOnce(null);
      mockRegistrationRepo.count.mockResolvedValue(16);
      mockRegistrationRepo.findOne.mockResolvedValueOnce({ waitlistPosition: 2 });
      mockRegistrationRepo.create.mockReturnValue({
        ...dto,
        status: RegistrationStatus.WAITLISTED,
        waitlistPosition: 3,
      });
      mockRegistrationRepo.save.mockResolvedValue({
        ...dto,
        status: RegistrationStatus.WAITLISTED,
        waitlistPosition: 3,
      });

      const result = await service.registerIndividual(dto);

      expect(result.status).toBe(RegistrationStatus.WAITLISTED);
      expect(result.waitlistPosition).toBe(3);
    });

    it('should throw BadRequestException when registration is closed', async () => {
      const dto = {
        tournamentId: mockTournament.id!,
        participantId: generateUUID(),
        participantName: 'Test Player',
      };

      mockTournamentRepo.findOne.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.REGISTRATION_CLOSED,
      });

      await expect(service.registerIndividual(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('registerTeam', () => {
    it('should register team successfully', async () => {
      const teamTournament = {
        ...mockTournament,
        teamSize: 5,
      };

      const dto = {
        tournamentId: teamTournament.id!,
        participantId: generateUUID(),
        participantName: 'Team Captain',
        teamId: generateUUID(),
        teamName: 'Test Team',
        teamMemberIds: [
          generateUUID(),
          generateUUID(),
          generateUUID(),
          generateUUID(),
          generateUUID(),
        ],
      };

      mockTournamentRepo.findOne.mockResolvedValue(teamTournament);
      mockRegistrationRepo.findOne.mockResolvedValue(null);
      mockRegistrationRepo.count.mockResolvedValue(2);
      mockRegistrationRepo.create.mockReturnValue({ ...dto, status: RegistrationStatus.CONFIRMED });
      mockRegistrationRepo.save.mockResolvedValue({ ...dto, status: RegistrationStatus.CONFIRMED });
      mockStandingRepo.create.mockReturnValue({});
      mockStandingRepo.save.mockResolvedValue({});

      const result = await service.registerTeam(dto);

      expect(result.teamName).toBe('Test Team');
    });

    it('should throw BadRequestException for individual tournament', async () => {
      const dto = {
        tournamentId: mockTournament.id!,
        participantId: generateUUID(),
        participantName: 'Team Captain',
        teamId: generateUUID(),
        teamName: 'Test Team',
        teamMemberIds: [generateUUID()],
      };

      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);

      await expect(service.registerTeam(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for incorrect team size', async () => {
      const teamTournament = {
        ...mockTournament,
        teamSize: 5,
      };

      const dto = {
        tournamentId: teamTournament.id!,
        participantId: generateUUID(),
        participantName: 'Team Captain',
        teamId: generateUUID(),
        teamName: 'Test Team',
        teamMemberIds: [generateUUID(), generateUUID()],
      };

      mockTournamentRepo.findOne.mockResolvedValue(teamTournament);

      await expect(service.registerTeam(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateEntryRequirements', () => {
    it('should return valid for meeting all requirements', async () => {
      const dto = {
        tournamentId: mockTournament.id!,
        participantId: generateUUID(),
        participantName: 'Test Player',
        mmr: 1500,
        identityVerified: true,
        region: 'NA',
      };

      const result = await service.validateEntryRequirements(
        mockTournament as Tournament,
        dto,
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for low MMR', async () => {
      const dto = {
        tournamentId: mockTournament.id!,
        participantId: generateUUID(),
        participantName: 'Test Player',
        mmr: 500,
        identityVerified: true,
        region: 'NA',
      };

      const result = await service.validateEntryRequirements(
        mockTournament as Tournament,
        dto,
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'MMR 500 is below minimum requirement of 1000',
      );
    });

    it('should return invalid for high MMR', async () => {
      const dto = {
        tournamentId: mockTournament.id!,
        participantId: generateUUID(),
        participantName: 'Test Player',
        mmr: 5000,
        identityVerified: true,
        region: 'NA',
      };

      const result = await service.validateEntryRequirements(
        mockTournament as Tournament,
        dto,
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'MMR 5000 is above maximum requirement of 3000',
      );
    });

    it('should return invalid for disallowed region', async () => {
      const dto = {
        tournamentId: mockTournament.id!,
        participantId: generateUUID(),
        participantName: 'Test Player',
        mmr: 1500,
        identityVerified: true,
        region: 'APAC',
      };

      const result = await service.validateEntryRequirements(
        mockTournament as Tournament,
        dto,
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Region APAC is not allowed for this tournament',
      );
    });
  });

  describe('cancelRegistration', () => {
    it('should cancel registration successfully', async () => {
      mockRegistrationRepo.findOne.mockResolvedValue(mockRegistration);
      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockRegistrationRepo.save.mockResolvedValue({
        ...mockRegistration,
        status: RegistrationStatus.CANCELLED,
        cancelledAt: new Date(),
      });

      const result = await service.cancelRegistration(
        mockRegistration.id!,
        'Cannot attend',
      );

      expect(result.status).toBe(RegistrationStatus.CANCELLED);
    });

    it('should throw BadRequestException for already cancelled registration', async () => {
      mockRegistrationRepo.findOne.mockResolvedValue({
        ...mockRegistration,
        status: RegistrationStatus.CANCELLED,
      });
      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);

      await expect(
        service.cancelRegistration(mockRegistration.id!, 'Test'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when tournament is in progress', async () => {
      mockRegistrationRepo.findOne.mockResolvedValue(mockRegistration);
      mockTournamentRepo.findOne.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.IN_PROGRESS,
      });

      await expect(
        service.cancelRegistration(mockRegistration.id!, 'Test'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkIn', () => {
    it('should check in successfully during check-in period', async () => {
      const checkInTournament = {
        ...mockTournament,
        status: TournamentStatus.CHECK_IN,
        checkInStartDate: new Date(Date.now() - 3600000),
        checkInEndDate: new Date(Date.now() + 3600000),
      };

      mockRegistrationRepo.findOne.mockResolvedValue(mockRegistration);
      mockTournamentRepo.findOne.mockResolvedValue(checkInTournament);
      mockRegistrationRepo.save.mockResolvedValue({
        ...mockRegistration,
        status: RegistrationStatus.CHECKED_IN,
        checkedInAt: new Date(),
      });

      const result = await service.checkIn(mockRegistration.id!);

      expect(result.status).toBe(RegistrationStatus.CHECKED_IN);
    });

    it('should throw BadRequestException when check-in is not open', async () => {
      mockRegistrationRepo.findOne.mockResolvedValue(mockRegistration);
      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);

      await expect(service.checkIn(mockRegistration.id!)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('seedByMmr', () => {
    it('should seed players by MMR in descending order', async () => {
      const registrations = [
        { ...mockRegistration, id: generateUUID(), mmr: 1500 },
        { ...mockRegistration, id: generateUUID(), mmr: 2500 },
        { ...mockRegistration, id: generateUUID(), mmr: 2000 },
      ];

      mockRegistrationRepo.find.mockResolvedValue(registrations);
      mockRegistrationRepo.save.mockImplementation((regs) => Promise.resolve(regs));

      const result = await service.seedByMmr(mockTournament.id!);

      expect(result[0].mmr).toBe(2500);
      expect(result[0].seed).toBe(1);
      expect(result[1].mmr).toBe(2000);
      expect(result[1].seed).toBe(2);
      expect(result[2].mmr).toBe(1500);
      expect(result[2].seed).toBe(3);
    });
  });

  describe('substituteParticipant', () => {
    it('should substitute participant successfully', async () => {
      const dto = {
        registrationId: mockRegistration.id!,
        newParticipantId: generateUUID(),
        newParticipantName: 'Substitute Player',
      };

      mockRegistrationRepo.findOne.mockResolvedValueOnce(mockRegistration);
      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockRegistrationRepo.findOne.mockResolvedValueOnce(null);
      mockRegistrationRepo.save.mockResolvedValue({
        ...mockRegistration,
        substitutedById: dto.newParticipantId,
        substitutedByName: dto.newParticipantName,
      });
      mockStandingRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.substituteParticipant(dto);

      expect(result.substitutedById).toBe(dto.newParticipantId);
    });

    it('should throw ConflictException if new participant is already registered', async () => {
      const dto = {
        registrationId: mockRegistration.id!,
        newParticipantId: generateUUID(),
        newParticipantName: 'Existing Player',
      };

      mockRegistrationRepo.findOne.mockResolvedValueOnce(mockRegistration);
      mockTournamentRepo.findOne.mockResolvedValue(mockTournament);
      mockRegistrationRepo.findOne.mockResolvedValueOnce({
        ...mockRegistration,
        participantId: dto.newParticipantId,
      });

      await expect(service.substituteParticipant(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getRegistration', () => {
    it('should return registration when found', async () => {
      mockRegistrationRepo.findOne.mockResolvedValue(mockRegistration);

      const result = await service.getRegistration(mockRegistration.id!);

      expect(result).toEqual(mockRegistration);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRegistrationRepo.findOne.mockResolvedValue(null);

      await expect(service.getRegistration('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getWaitlist', () => {
    it('should return waitlisted registrations in order', async () => {
      const waitlist = [
        { ...mockRegistration, status: RegistrationStatus.WAITLISTED, waitlistPosition: 1 },
        { ...mockRegistration, status: RegistrationStatus.WAITLISTED, waitlistPosition: 2 },
      ];

      mockRegistrationRepo.find.mockResolvedValue(waitlist);

      const result = await service.getWaitlist(mockTournament.id!);

      expect(result).toHaveLength(2);
      expect(result[0].waitlistPosition).toBe(1);
    });
  });

  describe('issueRefund', () => {
    it('should issue refund successfully', async () => {
      mockRegistrationRepo.findOne.mockResolvedValue(mockRegistration);
      mockRegistrationRepo.save.mockResolvedValue({
        ...mockRegistration,
        refundIssued: true,
        refundAmount: 50,
        refundTransactionId: 'tx-123',
      });

      const result = await service.issueRefund(mockRegistration.id!, 50, 'tx-123');

      expect(result.refundIssued).toBe(true);
      expect(result.refundAmount).toBe(50);
    });

    it('should throw BadRequestException if refund already issued', async () => {
      mockRegistrationRepo.findOne.mockResolvedValue({
        ...mockRegistration,
        refundIssued: true,
      });

      await expect(
        service.issueRefund(mockRegistration.id!, 50, 'tx-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
