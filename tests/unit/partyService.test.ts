import { PartyService } from '../../src/services/partyService';
import { pool } from '../../src/config/database';
import { cacheGet, cacheSet, cacheDelete } from '../../src/config/redis';
import { PartyStatus, PartyRole } from '../../src/types';

describe('PartyService', () => {
  let partyService: PartyService;
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockPartyId = '123e4567-e89b-12d3-a456-426614174001';

  beforeEach(() => {
    partyService = new PartyService();
    jest.clearAllMocks();
  });

  describe('createParty', () => {
    it('should create a new party successfully', async () => {
      const mockParty = {
        id: mockPartyId,
        name: 'Test Party',
        leader_id: mockUserId,
        max_size: 4,
        is_private: false,
        status: PartyStatus.ACTIVE,
        voice_channel_id: null,
        game_mode: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [mockParty] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] }),
        release: jest.fn(),
      };

      (pool.connect as jest.Mock).mockResolvedValue(mockClient);
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      (cacheGet as jest.Mock).mockResolvedValue(null);

      const result = await partyService.createParty(mockUserId, {
        name: 'Test Party',
        maxSize: 4,
        isPrivate: false,
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Party');
      expect(result.leaderId).toBe(mockUserId);
      expect(mockClient.query).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if user is already in a party', async () => {
      const existingParty = {
        id: mockPartyId,
        name: 'Existing Party',
        leader_id: mockUserId,
        max_size: 4,
        is_private: false,
        status: PartyStatus.ACTIVE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (cacheGet as jest.Mock).mockResolvedValue(mockPartyId);
      (pool.query as jest.Mock).mockResolvedValue({ rows: [existingParty] });

      await expect(
        partyService.createParty(mockUserId, { name: 'New Party' })
      ).rejects.toThrow('User is already in a party');
    });
  });

  describe('getParty', () => {
    it('should return party from cache if available', async () => {
      const cachedParty = {
        id: mockPartyId,
        name: 'Cached Party',
        leaderId: mockUserId,
        maxSize: 4,
        isPrivate: false,
        status: PartyStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (cacheGet as jest.Mock).mockResolvedValue(cachedParty);

      const result = await partyService.getParty(mockPartyId);

      expect(result).toEqual(cachedParty);
      expect(cacheGet).toHaveBeenCalledWith(`party:${mockPartyId}`);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should fetch party from database if not in cache', async () => {
      const dbParty = {
        id: mockPartyId,
        name: 'DB Party',
        leader_id: mockUserId,
        max_size: 4,
        is_private: false,
        status: PartyStatus.ACTIVE,
        voice_channel_id: null,
        game_mode: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (cacheGet as jest.Mock).mockResolvedValue(null);
      (pool.query as jest.Mock).mockResolvedValue({ rows: [dbParty] });

      const result = await partyService.getParty(mockPartyId);

      expect(result).toBeDefined();
      expect(result?.name).toBe('DB Party');
      expect(cacheSet).toHaveBeenCalled();
    });

    it('should return null if party not found', async () => {
      (cacheGet as jest.Mock).mockResolvedValue(null);
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await partyService.getParty(mockPartyId);

      expect(result).toBeNull();
    });
  });

  describe('joinParty', () => {
    it('should allow user to join a public party', async () => {
      const mockParty = {
        id: mockPartyId,
        name: 'Public Party',
        leader_id: '123e4567-e89b-12d3-a456-426614174002',
        max_size: 4,
        is_private: false,
        status: PartyStatus.ACTIVE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockMember = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        party_id: mockPartyId,
        user_id: mockUserId,
        role: PartyRole.MEMBER,
        joined_at: new Date().toISOString(),
        is_ready: false,
        is_muted: false,
      };

      (cacheGet as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockParty);
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockMember] });

      const result = await partyService.joinParty(mockPartyId, mockUserId);

      expect(result).toBeDefined();
      expect(result.userId).toBe(mockUserId);
      expect(result.role).toBe(PartyRole.MEMBER);
    });

    it('should throw error if party is private', async () => {
      const mockParty = {
        id: mockPartyId,
        name: 'Private Party',
        leaderId: '123e4567-e89b-12d3-a456-426614174002',
        maxSize: 4,
        isPrivate: true,
        status: PartyStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (cacheGet as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockParty);
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        partyService.joinParty(mockPartyId, mockUserId)
      ).rejects.toThrow('Cannot join a private party without an invite');
    });

    it('should throw error if party is full', async () => {
      const mockParty = {
        id: mockPartyId,
        name: 'Full Party',
        leaderId: '123e4567-e89b-12d3-a456-426614174002',
        maxSize: 2,
        isPrivate: false,
        status: PartyStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (cacheGet as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockParty);
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });

      await expect(
        partyService.joinParty(mockPartyId, mockUserId)
      ).rejects.toThrow('Party is full');
    });
  });

  describe('leaveParty', () => {
    it('should allow member to leave party', async () => {
      const mockParty = {
        id: mockPartyId,
        name: 'Test Party',
        leaderId: '123e4567-e89b-12d3-a456-426614174002',
        maxSize: 4,
        isPrivate: false,
        status: PartyStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockMember = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        party_id: mockPartyId,
        user_id: mockUserId,
        role: PartyRole.MEMBER,
        joined_at: new Date().toISOString(),
        is_ready: false,
        is_muted: false,
      };

      (cacheGet as jest.Mock).mockResolvedValue(mockParty);
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockMember] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(
        partyService.leaveParty(mockPartyId, mockUserId)
      ).resolves.not.toThrow();

      expect(cacheDelete).toHaveBeenCalled();
    });
  });

  describe('disbandParty', () => {
    it('should allow leader to disband party', async () => {
      const mockParty = {
        id: mockPartyId,
        name: 'Test Party',
        leaderId: mockUserId,
        maxSize: 4,
        isPrivate: false,
        status: PartyStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockMembers = [
        { id: '1', party_id: mockPartyId, user_id: mockUserId, role: PartyRole.LEADER, joined_at: new Date().toISOString(), is_ready: false, is_muted: false },
      ];

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };

      (cacheGet as jest.Mock)
        .mockResolvedValueOnce(mockParty)
        .mockResolvedValueOnce(mockMembers);
      (pool.connect as jest.Mock).mockResolvedValue(mockClient);

      await expect(
        partyService.disbandParty(mockPartyId, mockUserId)
      ).resolves.not.toThrow();

      expect(mockClient.query).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if non-leader tries to disband', async () => {
      const mockParty = {
        id: mockPartyId,
        name: 'Test Party',
        leaderId: '123e4567-e89b-12d3-a456-426614174002',
        maxSize: 4,
        isPrivate: false,
        status: PartyStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (cacheGet as jest.Mock).mockResolvedValue(mockParty);

      await expect(
        partyService.disbandParty(mockPartyId, mockUserId)
      ).rejects.toThrow('Only the party leader can disband the party');
    });
  });

  describe('transferLeadership', () => {
    it('should transfer leadership successfully', async () => {
      const newLeaderId = '123e4567-e89b-12d3-a456-426614174002';
      const mockParty = {
        id: mockPartyId,
        name: 'Test Party',
        leaderId: mockUserId,
        maxSize: 4,
        isPrivate: false,
        status: PartyStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockNewLeaderMember = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        party_id: mockPartyId,
        user_id: newLeaderId,
        role: PartyRole.MEMBER,
        joined_at: new Date().toISOString(),
        is_ready: false,
        is_muted: false,
      };

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };

      (cacheGet as jest.Mock).mockResolvedValue(mockParty);
      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockNewLeaderMember] });
      (pool.connect as jest.Mock).mockResolvedValue(mockClient);

      await expect(
        partyService.transferLeadership(mockPartyId, mockUserId, newLeaderId)
      ).resolves.not.toThrow();

      expect(mockClient.query).toHaveBeenCalled();
      expect(cacheDelete).toHaveBeenCalled();
    });
  });

  describe('getPartyMembers', () => {
    it('should return party members from cache', async () => {
      const cachedMembers = [
        { id: '1', partyId: mockPartyId, userId: mockUserId, role: PartyRole.LEADER, joinedAt: new Date(), isReady: false, isMuted: false },
      ];

      (cacheGet as jest.Mock).mockResolvedValue(cachedMembers);

      const result = await partyService.getPartyMembers(mockPartyId);

      expect(result).toEqual(cachedMembers);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should fetch members from database if not cached', async () => {
      const dbMembers = [
        { id: '1', party_id: mockPartyId, user_id: mockUserId, role: PartyRole.LEADER, joined_at: new Date().toISOString(), is_ready: false, is_muted: false },
      ];

      (cacheGet as jest.Mock).mockResolvedValue(null);
      (pool.query as jest.Mock).mockResolvedValue({ rows: dbMembers });

      const result = await partyService.getPartyMembers(mockPartyId);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(mockUserId);
      expect(cacheSet).toHaveBeenCalled();
    });
  });

  describe('getPublicParties', () => {
    it('should return paginated public parties', async () => {
      const mockParties = [
        { id: mockPartyId, name: 'Public Party 1', leader_id: mockUserId, max_size: 4, is_private: false, status: PartyStatus.ACTIVE, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ];

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: mockParties });

      const result = await partyService.getPublicParties(20, 0);

      expect(result.parties).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
