import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PartyMemberService } from './party-member.service';
import { PartyService } from './party.service';
import { Party, PartyStatus } from '../entities/party.entity';
import { PartyMember, MemberRole, MemberStatus, ReadyStatus } from '../entities/party-member.entity';
import { RedisCacheService } from './redis-cache.service';
import { GamerstakeService } from './gamerstake.service';
import { GamerstakeUser, GamerstakeProfile, GamerstakeWallet } from '../interfaces/gamerstake.interface';

describe('PartyMemberService', () => {
  let service: PartyMemberService;
  let partyRepository: jest.Mocked<Repository<Party>>;
  let memberRepository: jest.Mocked<Repository<PartyMember>>;
  let partyService: jest.Mocked<PartyService>;
  let cacheService: jest.Mocked<RedisCacheService>;
  let gamerstakeService: jest.Mocked<GamerstakeService>;

  const mockUser: GamerstakeUser = {
    id: 'user-002',
    username: 'testuser2',
    email: 'test2@example.com',
    avatarUrl: 'https://example.com/avatar2.png',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProfile: GamerstakeProfile = {
    userId: 'user-002',
    displayName: 'Test User 2',
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
    userId: 'user-002',
    address: '0x456',
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
    maxSize: 4,
    currentSize: 1,
    isMatchmaking: false,
    requiresWallet: false,
  };

  const mockLeader: Partial<PartyMember> = {
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

  const mockMember: Partial<PartyMember> = {
    id: 'member-002',
    partyId: 'party-001',
    userId: 'user-002',
    username: 'testuser2',
    role: MemberRole.MEMBER,
    status: MemberStatus.ACTIVE,
    readyStatus: ReadyStatus.NOT_READY,
    canInvite: true,
    canKick: false,
    canChangeSettings: false,
    canStartMatchmaking: false,
  };

  beforeEach(async () => {
    const mockPartyRepository = {
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const mockMemberRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    };

    const mockPartyService = {
      findById: jest.fn(),
      updateCurrentSize: jest.fn(),
      verifyPermission: jest.fn(),
      getUserActiveParty: jest.fn(),
    };

    const mockCacheService = {
      setParty: jest.fn(),
      setUserParty: jest.fn(),
      getUserParty: jest.fn(),
      deleteUserParty: jest.fn(),
      addPartyMember: jest.fn(),
      removePartyMember: jest.fn(),
      updatePartyMember: jest.fn(),
      getPartyMembers: jest.fn(),
      setPartyMembers: jest.fn(),
    };

    const mockGamerstakeService = {
      getUser: jest.fn(),
      getProfile: jest.fn(),
      getWallet: jest.fn(),
      verifyWalletBalance: jest.fn(),
      sendNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartyMemberService,
        {
          provide: getRepositoryToken(Party),
          useValue: mockPartyRepository,
        },
        {
          provide: getRepositoryToken(PartyMember),
          useValue: mockMemberRepository,
        },
        {
          provide: PartyService,
          useValue: mockPartyService,
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

    service = module.get<PartyMemberService>(PartyMemberService);
    partyRepository = module.get(getRepositoryToken(Party));
    memberRepository = module.get(getRepositoryToken(PartyMember));
    partyService = module.get(PartyService);
    cacheService = module.get(RedisCacheService);
    gamerstakeService = module.get(GamerstakeService);
  });

  describe('addMember', () => {
    const addMemberDto = {
      userId: 'user-002',
      username: 'testuser2',
    };

    it('should add a member to party successfully', async () => {
      partyService.findById.mockResolvedValue(mockParty as Party);
      memberRepository.findOne.mockResolvedValue(null);
      gamerstakeService.getUser.mockResolvedValue(mockUser);
      gamerstakeService.getProfile.mockResolvedValue(mockProfile);
      memberRepository.create.mockReturnValue(mockMember as PartyMember);
      memberRepository.save.mockResolvedValue(mockMember as PartyMember);

      const result = await service.addMember('party-001', addMemberDto);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-002');
      expect(partyService.updateCurrentSize).toHaveBeenCalledWith('party-001');
      expect(cacheService.setUserParty).toHaveBeenCalledWith('user-002', 'party-001');
    });

    it('should throw ConflictException if user is already in a party', async () => {
      partyService.findById.mockResolvedValue(mockParty as Party);
      memberRepository.findOne.mockResolvedValue(mockMember as PartyMember);

      await expect(service.addMember('party-001', addMemberDto)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if party is full', async () => {
      const fullParty = { ...mockParty, currentSize: 4, maxSize: 4 };
      partyService.findById.mockResolvedValue(fullParty as Party);
      memberRepository.findOne.mockResolvedValue(null);

      await expect(service.addMember('party-001', addMemberDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if party is not active', async () => {
      const disbandedParty = { ...mockParty, status: PartyStatus.DISBANDED };
      partyService.findById.mockResolvedValue(disbandedParty as Party);
      memberRepository.findOne.mockResolvedValue(null);

      await expect(service.addMember('party-001', addMemberDto)).rejects.toThrow(BadRequestException);
    });

    it('should verify wallet balance if party requires wallet', async () => {
      const walletParty = { ...mockParty, requiresWallet: true, minimumWalletBalance: '50', walletCurrency: 'USD' };
      partyService.findById.mockResolvedValue(walletParty as Party);
      memberRepository.findOne.mockResolvedValue(null);
      gamerstakeService.getUser.mockResolvedValue(mockUser);
      gamerstakeService.verifyWalletBalance.mockResolvedValue(true);
      gamerstakeService.getProfile.mockResolvedValue(mockProfile);
      gamerstakeService.getWallet.mockResolvedValue(mockWallet);
      memberRepository.create.mockReturnValue(mockMember as PartyMember);
      memberRepository.save.mockResolvedValue(mockMember as PartyMember);

      const result = await service.addMember('party-001', addMemberDto);

      expect(result).toBeDefined();
      expect(gamerstakeService.verifyWalletBalance).toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('should remove member from party', async () => {
      partyService.findById.mockResolvedValue(mockParty as Party);
      memberRepository.findOne.mockResolvedValue(mockMember as PartyMember);
      memberRepository.save.mockResolvedValue({ ...mockMember, leftAt: new Date() } as PartyMember);

      await service.removeMember('party-001', 'user-002');

      expect(memberRepository.save).toHaveBeenCalled();
      expect(partyService.updateCurrentSize).toHaveBeenCalledWith('party-001');
      expect(cacheService.deleteUserParty).toHaveBeenCalledWith('user-002');
    });

    it('should throw NotFoundException if member not found', async () => {
      partyService.findById.mockResolvedValue(mockParty as Party);
      memberRepository.findOne.mockResolvedValue(null);

      await expect(service.removeMember('party-001', 'user-002')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if leader tries to leave', async () => {
      partyService.findById.mockResolvedValue(mockParty as Party);
      memberRepository.findOne.mockResolvedValue(mockLeader as PartyMember);

      await expect(service.removeMember('party-001', 'user-001')).rejects.toThrow(BadRequestException);
    });
  });

  describe('kickMember', () => {
    const kickDto = {
      userId: 'user-002',
      reason: 'Test kick',
    };

    it('should kick member from party', async () => {
      partyService.findById.mockResolvedValue(mockParty as Party);
      partyService.verifyPermission.mockResolvedValue(undefined);
      // First call for targetMember in kickMember, second for kickerMember in kickMember,
      // third for member in removeMember
      memberRepository.findOne
        .mockResolvedValueOnce(mockMember as PartyMember)
        .mockResolvedValueOnce(mockLeader as PartyMember)
        .mockResolvedValueOnce(mockMember as PartyMember);
      memberRepository.save.mockResolvedValue({ ...mockMember, leftAt: new Date() } as PartyMember);
      partyService.updateCurrentSize.mockResolvedValue(undefined);
      cacheService.deleteUserParty.mockResolvedValue(undefined);
      cacheService.removePartyMember.mockResolvedValue(undefined);
      gamerstakeService.sendNotification.mockResolvedValue(true);

      await service.kickMember('party-001', 'user-001', kickDto);

      expect(gamerstakeService.sendNotification).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if trying to kick leader', async () => {
      partyService.findById.mockResolvedValue(mockParty as Party);

      await expect(service.kickMember('party-001', 'user-002', { userId: 'user-001' })).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if trying to kick self', async () => {
      partyService.findById.mockResolvedValue(mockParty as Party);

      await expect(service.kickMember('party-001', 'user-002', { userId: 'user-002' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateMember', () => {
    const updateDto = {
      preferredRole: 'Support',
    };

    it('should update member details', async () => {
      memberRepository.findOne.mockResolvedValue(mockMember as PartyMember);
      memberRepository.save.mockResolvedValue({ ...mockMember, ...updateDto } as PartyMember);

      const result = await service.updateMember('party-001', 'user-002', updateDto);

      expect(result.preferredRole).toBe('Support');
    });

    it('should throw NotFoundException if member not found', async () => {
      memberRepository.findOne.mockResolvedValue(null);

      await expect(service.updateMember('party-001', 'user-002', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('transferLeadership', () => {
    it('should transfer leadership successfully', async () => {
      partyService.findById.mockResolvedValue({ ...mockParty, leaderId: 'user-001' } as Party);
      memberRepository.findOne
        .mockResolvedValueOnce(mockMember as PartyMember)
        .mockResolvedValueOnce(mockLeader as PartyMember);
      memberRepository.save.mockResolvedValue(mockMember as PartyMember);
      partyRepository.save.mockResolvedValue(mockParty as Party);
      cacheService.setParty.mockResolvedValue(undefined);

      await service.transferLeadership('party-001', 'user-001', { newLeaderId: 'user-002' });

      expect(memberRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should throw ForbiddenException if not leader', async () => {
      partyService.findById.mockResolvedValue({ ...mockParty, leaderId: 'user-001' } as Party);

      await expect(service.transferLeadership('party-001', 'user-002', { newLeaderId: 'user-003' })).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if new leader not found', async () => {
      partyService.findById.mockResolvedValue({ ...mockParty, leaderId: 'user-001' } as Party);
      memberRepository.findOne.mockResolvedValue(null);

      await expect(service.transferLeadership('party-001', 'user-001', { newLeaderId: 'user-003' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('promoteToCoLeader', () => {
    it('should promote member to co-leader', async () => {
      // mockMember has role: MEMBER, not LEADER, so it can be promoted
      partyService.findById.mockResolvedValue({ ...mockParty, leaderId: 'user-001' } as Party);
      memberRepository.findOne.mockResolvedValue({ ...mockMember, role: MemberRole.MEMBER } as PartyMember);
      memberRepository.save.mockResolvedValue({ ...mockMember, role: MemberRole.CO_LEADER } as PartyMember);
      cacheService.updatePartyMember.mockResolvedValue(undefined);

      const result = await service.promoteToCoLeader('party-001', 'user-001', 'user-002');

      expect(result.role).toBe(MemberRole.CO_LEADER);
    });

    it('should throw ForbiddenException if not leader', async () => {
      partyService.findById.mockResolvedValue({ ...mockParty, leaderId: 'user-001' } as Party);
      memberRepository.findOne.mockResolvedValue(mockMember as PartyMember);

      await expect(service.promoteToCoLeader('party-001', 'user-002', 'user-003')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('demoteFromCoLeader', () => {
    it('should demote co-leader to member', async () => {
      const coLeader = { ...mockMember, role: MemberRole.CO_LEADER };
      partyService.findById.mockResolvedValue({ ...mockParty, leaderId: 'user-001' } as Party);
      memberRepository.findOne.mockResolvedValue(coLeader as PartyMember);
      memberRepository.save.mockResolvedValue({ ...coLeader, role: MemberRole.MEMBER } as PartyMember);
      cacheService.updatePartyMember.mockResolvedValue(undefined);

      const result = await service.demoteFromCoLeader('party-001', 'user-001', 'user-002');

      expect(result.role).toBe(MemberRole.MEMBER);
    });
  });

  describe('setReadyStatus', () => {
    it('should set member ready status', async () => {
      memberRepository.findOne.mockResolvedValue(mockMember as PartyMember);
      memberRepository.save.mockResolvedValue({ ...mockMember, readyStatus: ReadyStatus.READY } as PartyMember);

      const result = await service.setReadyStatus('party-001', 'user-002', { readyStatus: ReadyStatus.READY });

      expect(result.readyStatus).toBe(ReadyStatus.READY);
    });

    it('should throw NotFoundException if member not found', async () => {
      memberRepository.findOne.mockResolvedValue(null);

      await expect(service.setReadyStatus('party-001', 'user-002', { readyStatus: ReadyStatus.READY })).rejects.toThrow(NotFoundException);
    });
  });

  describe('setMemberStatus', () => {
    it('should set member status', async () => {
      memberRepository.findOne.mockResolvedValue(mockMember as PartyMember);
      memberRepository.save.mockResolvedValue({ ...mockMember, status: MemberStatus.AWAY } as PartyMember);

      const result = await service.setMemberStatus('party-001', 'user-002', MemberStatus.AWAY);

      expect(result.status).toBe(MemberStatus.AWAY);
    });
  });

  describe('getMembers', () => {
    it('should return party members', async () => {
      cacheService.getPartyMembers.mockResolvedValue(null);
      memberRepository.find.mockResolvedValue([mockLeader as PartyMember, mockMember as PartyMember]);
      cacheService.setPartyMembers.mockResolvedValue(undefined);

      const result = await service.getMembers('party-001');

      expect(result).toHaveLength(2);
    });
  });

  describe('getMember', () => {
    it('should return member if found', async () => {
      memberRepository.findOne.mockResolvedValue(mockMember as PartyMember);

      const result = await service.getMember('party-001', 'user-002');

      expect(result).toEqual(mockMember);
    });
  });

  describe('isAllReady', () => {
    it('should return true if all members are ready', async () => {
      cacheService.getPartyMembers.mockResolvedValue(null);
      memberRepository.find.mockResolvedValue([
        { ...mockLeader, readyStatus: ReadyStatus.READY } as PartyMember,
        { ...mockMember, readyStatus: ReadyStatus.READY } as PartyMember,
      ]);
      cacheService.setPartyMembers.mockResolvedValue(undefined);

      const result = await service.isAllReady('party-001');

      expect(result).toBe(true);
    });

    it('should return false if not all members are ready', async () => {
      cacheService.getPartyMembers.mockResolvedValue(null);
      memberRepository.find.mockResolvedValue([
        { ...mockLeader, readyStatus: ReadyStatus.READY } as PartyMember,
        { ...mockMember, readyStatus: ReadyStatus.NOT_READY } as PartyMember,
      ]);
      cacheService.setPartyMembers.mockResolvedValue(undefined);

      const result = await service.isAllReady('party-001');

      expect(result).toBe(false);
    });
  });

  describe('resetAllReadyStatus', () => {
    it('should reset all members ready status', async () => {
      memberRepository.update.mockResolvedValue({ affected: 2 } as never);
      cacheService.getPartyMembers.mockResolvedValue(null);
      memberRepository.find.mockResolvedValue([mockLeader as PartyMember, mockMember as PartyMember]);
      cacheService.setPartyMembers.mockResolvedValue(undefined);

      await service.resetAllReadyStatus('party-001');

      expect(memberRepository.update).toHaveBeenCalled();
    });
  });

  describe('setMuted', () => {
    it('should set member muted status', async () => {
      memberRepository.findOne.mockResolvedValue(mockMember as PartyMember);
      memberRepository.save.mockResolvedValue({ ...mockMember, isMuted: true } as PartyMember);

      const result = await service.setMuted('party-001', 'user-002', true);

      expect(result.isMuted).toBe(true);
    });
  });

  describe('setDeafened', () => {
    it('should set member deafened status', async () => {
      memberRepository.findOne.mockResolvedValue(mockMember as PartyMember);
      memberRepository.save.mockResolvedValue({ ...mockMember, isDeafened: true } as PartyMember);

      const result = await service.setDeafened('party-001', 'user-002', true);

      expect(result.isDeafened).toBe(true);
    });
  });

  describe('getMemberCount', () => {
    it('should return member count', async () => {
      memberRepository.count.mockResolvedValue(2);

      const result = await service.getMemberCount('party-001');

      expect(result).toBe(2);
    });
  });

  describe('getReadyCount', () => {
    it('should return ready member count', async () => {
      memberRepository.count.mockResolvedValue(1);

      const result = await service.getReadyCount('party-001');

      expect(result).toBe(1);
    });
  });
});
