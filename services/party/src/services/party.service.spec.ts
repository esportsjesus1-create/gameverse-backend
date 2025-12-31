import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PartyService } from './party.service';
import { Party, PartyStatus, PartyVisibility } from '../entities/party.entity';
import { PartyMember, MemberRole, MemberStatus, ReadyStatus } from '../entities/party-member.entity';
import { PartySettings } from '../entities/party-settings.entity';
import { RedisCacheService } from './redis-cache.service';
import { GamerstakeService } from './gamerstake.service';
import { CreatePartyDto, UpdatePartyDto } from '../dto';
import { GamerstakeUser, GamerstakeProfile, GamerstakeWallet } from '../interfaces/gamerstake.interface';

describe('PartyService', () => {
  let service: PartyService;
  let partyRepository: jest.Mocked<Repository<Party>>;
  let memberRepository: jest.Mocked<Repository<PartyMember>>;
  let settingsRepository: jest.Mocked<Repository<PartySettings>>;
  let cacheService: jest.Mocked<RedisCacheService>;
  let gamerstakeService: jest.Mocked<GamerstakeService>;

  const mockUser: GamerstakeUser = {
    id: 'user-001',
    username: 'testuser',
    email: 'test@example.com',
    avatarUrl: 'https://example.com/avatar.png',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProfile: GamerstakeProfile = {
    userId: 'user-001',
    displayName: 'Test User',
    rank: 1500,
    level: 50,
    experience: 10000,
    gamesPlayed: 100,
    wins: 60,
    losses: 40,
    winRate: 0.6,
    preferredGames: ['game-001'],
    achievements: [],
    isVerified: true,
    isPremium: false,
    status: 'online',
    lastOnline: new Date(),
  };

  const mockWallet: GamerstakeWallet = {
    userId: 'user-001',
    address: '0x123',
    balance: '100.00',
    currency: 'USD',
    isVerified: true,
    chain: 'ethereum',
    balances: [{ currency: 'USD', amount: '100.00', usdValue: '100.00' }],
    transactions: [],
  };

  const mockParty: Partial<Party> = {
    id: 'party-001',
    name: 'Test Party',
    leaderId: 'user-001',
    leaderUsername: 'testuser',
    status: PartyStatus.ACTIVE,
    visibility: PartyVisibility.FRIENDS_ONLY,
    maxSize: 4,
    currentSize: 1,
    minRank: 0,
    maxRank: 10000,
    isMatchmaking: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMember: Partial<PartyMember> = {
    id: 'member-001',
    partyId: 'party-001',
    userId: 'user-001',
    username: 'testuser',
    role: MemberRole.LEADER,
    status: MemberStatus.ACTIVE,
    readyStatus: ReadyStatus.NOT_READY,
    canInvite: true,
    canKick: true,
    canChangeSettings: true,
    canStartMatchmaking: true,
  };

  beforeEach(async () => {
    const mockPartyRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    const mockMemberRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    };

    const mockSettingsRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const mockCacheService = {
      setParty: jest.fn(),
      getParty: jest.fn(),
      deleteParty: jest.fn(),
      setUserParty: jest.fn(),
      getUserParty: jest.fn(),
      deleteUserParty: jest.fn(),
      deleteMatchmakingTicket: jest.fn(),
    };

    const mockGamerstakeService = {
      getUser: jest.fn(),
      getProfile: jest.fn(),
      getWallet: jest.fn(),
      verifyWalletBalance: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartyService,
        {
          provide: getRepositoryToken(Party),
          useValue: mockPartyRepository,
        },
        {
          provide: getRepositoryToken(PartyMember),
          useValue: mockMemberRepository,
        },
        {
          provide: getRepositoryToken(PartySettings),
          useValue: mockSettingsRepository,
        },
        {
          provide: RedisCacheService,
          useValue: mockCacheService,
        },
        {
          provide: GamerstakeService,
          useValue: mockGamerstakeService,
        },
      ],
    }).compile();

    service = module.get<PartyService>(PartyService);
    partyRepository = module.get(getRepositoryToken(Party));
    memberRepository = module.get(getRepositoryToken(PartyMember));
    settingsRepository = module.get(getRepositoryToken(PartySettings));
    cacheService = module.get(RedisCacheService);
    gamerstakeService = module.get(GamerstakeService);
  });

  describe('create', () => {
    const createDto: CreatePartyDto = {
      name: 'Test Party',
      visibility: PartyVisibility.FRIENDS_ONLY,
      maxSize: 4,
    };

    it('should create a party successfully', async () => {
      memberRepository.findOne.mockResolvedValue(null);
      gamerstakeService.getUser.mockResolvedValue(mockUser);
      gamerstakeService.getProfile.mockResolvedValue(mockProfile);
      partyRepository.create.mockReturnValue(mockParty as Party);
      partyRepository.save.mockResolvedValue(mockParty as Party);
      settingsRepository.create.mockReturnValue({ id: 'settings-001', partyId: 'party-001' } as PartySettings);
      settingsRepository.save.mockResolvedValue({ id: 'settings-001', partyId: 'party-001' } as PartySettings);
      memberRepository.create.mockReturnValue(mockMember as PartyMember);
      memberRepository.save.mockResolvedValue(mockMember as PartyMember);

      const result = await service.create('user-001', createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Party');
      expect(partyRepository.create).toHaveBeenCalled();
      expect(partyRepository.save).toHaveBeenCalled();
      expect(cacheService.setUserParty).toHaveBeenCalledWith('user-001', mockParty.id);
    });

    it('should throw ConflictException if user is already in a party', async () => {
      memberRepository.findOne.mockResolvedValue(mockMember as PartyMember);
      cacheService.getUserParty.mockResolvedValue('existing-party-id');
      partyRepository.findOne.mockResolvedValue(mockParty as Party);

      await expect(service.create('user-001', createDto)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if user not found', async () => {
      memberRepository.findOne.mockResolvedValue(null);
      cacheService.getUserParty.mockResolvedValue(null);
      gamerstakeService.getUser.mockResolvedValue(null);

      await expect(service.create('user-001', createDto)).rejects.toThrow(NotFoundException);
    });

    it('should create party with wallet requirement', async () => {
      const walletDto: CreatePartyDto = {
        ...createDto,
        requiresWallet: true,
        minimumWalletBalance: 50,
        walletCurrency: 'USD',
      };

      memberRepository.findOne.mockResolvedValue(null);
      cacheService.getUserParty.mockResolvedValue(null);
      gamerstakeService.getUser.mockResolvedValue(mockUser);
      gamerstakeService.verifyWalletBalance.mockResolvedValue(true);
      gamerstakeService.getProfile.mockResolvedValue(mockProfile);
      gamerstakeService.getWallet.mockResolvedValue(mockWallet);
      partyRepository.create.mockReturnValue({ ...mockParty, requiresWallet: true } as Party);
      partyRepository.save.mockResolvedValue({ ...mockParty, requiresWallet: true } as Party);
      settingsRepository.create.mockReturnValue({ id: 'settings-001', partyId: 'party-001' } as PartySettings);
      settingsRepository.save.mockResolvedValue({ id: 'settings-001', partyId: 'party-001' } as PartySettings);
      memberRepository.create.mockReturnValue(mockMember as PartyMember);
      memberRepository.save.mockResolvedValue(mockMember as PartyMember);

      const result = await service.create('user-001', walletDto);

      expect(result.requiresWallet).toBe(true);
      expect(gamerstakeService.verifyWalletBalance).toHaveBeenCalled();
    });

    it('should throw BadRequestException if insufficient wallet balance', async () => {
      const walletDto: CreatePartyDto = {
        ...createDto,
        requiresWallet: true,
        minimumWalletBalance: 50,
        walletCurrency: 'USD',
      };

      memberRepository.findOne.mockResolvedValue(null);
      cacheService.getUserParty.mockResolvedValue(null);
      gamerstakeService.getUser.mockResolvedValue(mockUser);
      gamerstakeService.verifyWalletBalance.mockResolvedValue(false);

      await expect(service.create('user-001', walletDto)).rejects.toThrow(BadRequestException);
    });

    it('should create party with join code', async () => {
      const codeDto: CreatePartyDto = {
        ...createDto,
        generateJoinCode: true,
      };

      memberRepository.findOne.mockResolvedValue(null);
      cacheService.getUserParty.mockResolvedValue(null);
      gamerstakeService.getUser.mockResolvedValue(mockUser);
      gamerstakeService.getProfile.mockResolvedValue(mockProfile);
      partyRepository.create.mockReturnValue({ ...mockParty, joinCode: 'ABC123' } as Party);
      partyRepository.save.mockResolvedValue({ ...mockParty, joinCode: 'ABC123' } as Party);
      settingsRepository.create.mockReturnValue({ id: 'settings-001', partyId: 'party-001' } as PartySettings);
      settingsRepository.save.mockResolvedValue({ id: 'settings-001', partyId: 'party-001' } as PartySettings);
      memberRepository.create.mockReturnValue(mockMember as PartyMember);
      memberRepository.save.mockResolvedValue(mockMember as PartyMember);

      const result = await service.create('user-001', codeDto);

      expect(result.joinCode).toBeDefined();
    });
  });

  describe('findById', () => {
    it('should return party from cache if available', async () => {
      cacheService.getParty.mockResolvedValue(mockParty);

      const result = await service.findById('party-001');

      expect(result).toEqual(mockParty);
      expect(partyRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return party from database if not in cache', async () => {
      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findOne.mockResolvedValue(mockParty as Party);

      const result = await service.findById('party-001');

      expect(result).toEqual(mockParty);
      expect(partyRepository.findOne).toHaveBeenCalled();
      expect(cacheService.setParty).toHaveBeenCalled();
    });

    it('should throw NotFoundException if party not found', async () => {
      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('party-001')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByJoinCode', () => {
    it('should return party by join code', async () => {
      partyRepository.findOne.mockResolvedValue({ ...mockParty, joinCode: 'ABC123' } as Party);

      const result = await service.findByJoinCode('ABC123');

      expect(result.joinCode).toBe('ABC123');
    });

    it('should throw NotFoundException if party not found', async () => {
      partyRepository.findOne.mockResolvedValue(null);

      await expect(service.findByJoinCode('INVALID')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdatePartyDto = {
      name: 'Updated Party',
      description: 'New description',
    };

    it('should update party successfully', async () => {
      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findOne.mockResolvedValue(mockParty as Party);
      memberRepository.findOne.mockResolvedValue(mockMember as PartyMember);
      partyRepository.save.mockResolvedValue({ ...mockParty, ...updateDto } as Party);

      const result = await service.update('party-001', 'user-001', updateDto);

      expect(result.name).toBe('Updated Party');
      expect(partyRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if reducing max size below current size', async () => {
      const sizeDto: UpdatePartyDto = { maxSize: 1 };
      const partyWithMembers = { ...mockParty, currentSize: 3 };

      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findOne.mockResolvedValue(partyWithMembers as Party);
      memberRepository.findOne.mockResolvedValue(mockMember as PartyMember);

      await expect(service.update('party-001', 'user-001', sizeDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('disband', () => {
    it('should disband party successfully', async () => {
      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findOne.mockResolvedValue(mockParty as Party);
      memberRepository.find.mockResolvedValue([mockMember as PartyMember]);
      partyRepository.save.mockResolvedValue({ ...mockParty, status: PartyStatus.DISBANDED } as Party);
      memberRepository.save.mockResolvedValue({ ...mockMember, leftAt: new Date() } as PartyMember);

      await service.disband('party-001', 'user-001');

      expect(partyRepository.save).toHaveBeenCalled();
      expect(cacheService.deleteParty).toHaveBeenCalledWith('party-001');
    });

    it('should throw ForbiddenException if not leader', async () => {
      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findOne.mockResolvedValue(mockParty as Party);

      await expect(service.disband('party-001', 'user-002')).rejects.toThrow(ForbiddenException);
    });

    it('should cancel matchmaking if party is matchmaking', async () => {
      const matchmakingParty = { ...mockParty, isMatchmaking: true };
      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findOne.mockResolvedValue(matchmakingParty as Party);
      memberRepository.find.mockResolvedValue([mockMember as PartyMember]);
      partyRepository.save.mockResolvedValue({ ...matchmakingParty, status: PartyStatus.DISBANDED } as Party);
      memberRepository.save.mockResolvedValue({ ...mockMember, leftAt: new Date() } as PartyMember);

      await service.disband('party-001', 'user-001');

      expect(cacheService.deleteMatchmakingTicket).toHaveBeenCalledWith('party-001');
    });
  });

  describe('getUserActiveParty', () => {
    it('should return party from cache', async () => {
      cacheService.getUserParty.mockResolvedValue('party-001');
      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findOne.mockResolvedValue(mockParty as Party);

      const result = await service.getUserActiveParty('user-001');

      expect(result).toBeDefined();
    });

    it('should return null if no active party', async () => {
      cacheService.getUserParty.mockResolvedValue(null);
      memberRepository.findOne.mockResolvedValue(null);

      const result = await service.getUserActiveParty('user-001');

      expect(result).toBeNull();
    });

    it('should clear cache if party not found', async () => {
      cacheService.getUserParty.mockResolvedValue('party-001');
      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findOne.mockResolvedValue(null);
      memberRepository.findOne.mockResolvedValue(null);

      const result = await service.getUserActiveParty('user-001');

      expect(result).toBeNull();
      expect(cacheService.deleteUserParty).toHaveBeenCalledWith('user-001');
    });
  });

  describe('getPublicParties', () => {
    it('should return public parties', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockParty], 1]),
      };
      partyRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);

      const result = await service.getPublicParties({});

      expect(result.parties).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by gameId', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      partyRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);

      await service.getPublicParties({ gameId: 'game-001' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });
  });

  describe('regenerateJoinCode', () => {
    it('should regenerate join code', async () => {
      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findOne.mockResolvedValue(mockParty as Party);
      memberRepository.findOne.mockResolvedValue(mockMember as PartyMember);
      partyRepository.save.mockResolvedValue({ ...mockParty, joinCode: 'NEW123' } as Party);

      const result = await service.regenerateJoinCode('party-001', 'user-001');

      expect(result).toBeDefined();
      expect(result).toHaveLength(6);
    });
  });

  describe('removeJoinCode', () => {
    it('should remove join code', async () => {
      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findOne.mockResolvedValue({ ...mockParty, joinCode: 'ABC123' } as Party);
      memberRepository.findOne.mockResolvedValue(mockMember as PartyMember);
      partyRepository.save.mockResolvedValue({ ...mockParty, joinCode: undefined } as unknown as Party);

      await service.removeJoinCode('party-001', 'user-001');

      expect(partyRepository.save).toHaveBeenCalled();
    });
  });

  describe('setGame', () => {
    it('should set party game', async () => {
      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findOne.mockResolvedValue(mockParty as Party);
      memberRepository.findOne.mockResolvedValue(mockMember as PartyMember);
      partyRepository.save.mockResolvedValue({ ...mockParty, gameId: 'game-002', gameName: 'New Game' } as Party);
      memberRepository.update.mockResolvedValue({ affected: 1 } as never);

      const result = await service.setGame('party-001', 'user-001', 'game-002', 'New Game', '5v5');

      expect(result.gameId).toBe('game-002');
    });

    it('should throw BadRequestException if party is matchmaking', async () => {
      const matchmakingParty = { ...mockParty, isMatchmaking: true };
      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findOne.mockResolvedValue(matchmakingParty as Party);
      memberRepository.findOne.mockResolvedValue(mockMember as PartyMember);

      await expect(service.setGame('party-001', 'user-001', 'game-002', 'New Game')).rejects.toThrow(BadRequestException);
    });
  });

  describe('setVisibility', () => {
    it('should set party visibility', async () => {
      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findOne.mockResolvedValue(mockParty as Party);
      partyRepository.save.mockResolvedValue({ ...mockParty, visibility: PartyVisibility.PUBLIC } as Party);

      const result = await service.setVisibility('party-001', 'user-001', PartyVisibility.PUBLIC);

      expect(result.visibility).toBe(PartyVisibility.PUBLIC);
    });

    it('should throw ForbiddenException if not leader', async () => {
      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findOne.mockResolvedValue(mockParty as Party);

      await expect(service.setVisibility('party-001', 'user-002', PartyVisibility.PUBLIC)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPartyStats', () => {
    it('should return party statistics', async () => {
      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findOne.mockResolvedValue(mockParty as Party);
      memberRepository.find.mockResolvedValue([
        { ...mockMember, rank: 1500, readyStatus: ReadyStatus.READY } as PartyMember,
      ]);

      const result = await service.getPartyStats('party-001');

      expect(result).toHaveProperty('partyId');
      expect(result).toHaveProperty('currentSize');
      expect(result).toHaveProperty('averageRank');
      expect(result).toHaveProperty('readyCount');
    });
  });

  describe('verifyPermission', () => {
    it('should allow leader to perform any action', async () => {
      await expect(service.verifyPermission(mockParty as Party, 'user-001', 'canKick')).resolves.not.toThrow();
    });

    it('should throw ForbiddenException if user is not a member', async () => {
      memberRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyPermission(mockParty as Party, 'user-002', 'canKick')).rejects.toThrow(ForbiddenException);
    });

    it('should allow co-leader to perform actions', async () => {
      const coLeader = { ...mockMember, userId: 'user-002', role: MemberRole.CO_LEADER };
      memberRepository.findOne.mockResolvedValue(coLeader as PartyMember);

      await expect(service.verifyPermission(mockParty as Party, 'user-002', 'canKick')).resolves.not.toThrow();
    });

    it('should throw ForbiddenException if member lacks permission', async () => {
      const member = { ...mockMember, userId: 'user-002', role: MemberRole.MEMBER, canKick: false };
      memberRepository.findOne.mockResolvedValue(member as PartyMember);

      await expect(service.verifyPermission(mockParty as Party, 'user-002', 'canKick')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('isMember', () => {
    it('should return true if user is a member', async () => {
      memberRepository.findOne.mockResolvedValue(mockMember as PartyMember);

      const result = await service.isMember('party-001', 'user-001');

      expect(result).toBe(true);
    });

    it('should return false if user is not a member', async () => {
      memberRepository.findOne.mockResolvedValue(null);

      const result = await service.isMember('party-001', 'user-002');

      expect(result).toBe(false);
    });
  });

  describe('getMember', () => {
    it('should return member if found', async () => {
      memberRepository.findOne.mockResolvedValue(mockMember as PartyMember);

      const result = await service.getMember('party-001', 'user-001');

      expect(result).toEqual(mockMember);
    });

    it('should return null if member not found', async () => {
      memberRepository.findOne.mockResolvedValue(null);

      const result = await service.getMember('party-001', 'user-002');

      expect(result).toBeNull();
    });
  });

  describe('updateCurrentSize', () => {
    it('should update party current size', async () => {
      memberRepository.count.mockResolvedValue(3);
      partyRepository.update.mockResolvedValue({ affected: 1 } as never);
      cacheService.getParty.mockResolvedValue(null);
      partyRepository.findOne.mockResolvedValue({ ...mockParty, currentSize: 3 } as Party);

      await service.updateCurrentSize('party-001');

      expect(memberRepository.count).toHaveBeenCalled();
      expect(partyRepository.update).toHaveBeenCalledWith('party-001', { currentSize: 3 });
    });
  });

  describe('findPartiesByGameId', () => {
    it('should return parties by game ID', async () => {
      partyRepository.find.mockResolvedValue([mockParty as Party]);

      const result = await service.findPartiesByGameId('game-001');

      expect(result).toHaveLength(1);
    });
  });

  describe('getPartyHistory', () => {
    it('should return user party history', async () => {
      memberRepository.find.mockResolvedValue([mockMember as PartyMember]);

      const result = await service.getPartyHistory('user-001');

      expect(result).toHaveLength(1);
    });
  });

  describe('searchParties', () => {
    it('should search parties by query', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockParty]),
      };
      partyRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);

      const result = await service.searchParties('test', {});

      expect(result).toHaveLength(1);
    });
  });
});
