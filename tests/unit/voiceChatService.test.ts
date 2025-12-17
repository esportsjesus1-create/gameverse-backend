import { VoiceChatService } from '../../src/services/voiceChatService';
import { pool } from '../../src/config/database';
import { cacheGet, cacheSet, cacheDelete } from '../../src/config/redis';
import { PartyRole, PartyStatus } from '../../src/types';

jest.mock('../../src/services/partyService', () => ({
  partyService: {
    getParty: jest.fn(),
    getPartyMember: jest.fn(),
  },
}));

import { partyService } from '../../src/services/partyService';

describe('VoiceChatService', () => {
  let voiceChatService: VoiceChatService;
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockPartyId = '123e4567-e89b-12d3-a456-426614174001';
  const mockChannelId = '123e4567-e89b-12d3-a456-426614174002';

  beforeEach(() => {
    voiceChatService = new VoiceChatService();
    jest.clearAllMocks();
  });

  describe('createVoiceChannel', () => {
    it('should create a voice channel successfully', async () => {
      const mockParty = {
        id: mockPartyId,
        name: 'Test Party',
        leaderId: mockUserId,
        maxSize: 4,
        status: PartyStatus.ACTIVE,
      };

      const mockChannel = {
        id: mockChannelId,
        party_id: mockPartyId,
        name: 'Test Party Voice',
        max_participants: 4,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [mockChannel] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] }),
        release: jest.fn(),
      };

      (partyService.getParty as jest.Mock).mockResolvedValue(mockParty);
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      (pool.connect as jest.Mock).mockResolvedValue(mockClient);

      const result = await voiceChatService.createVoiceChannel(mockPartyId, mockUserId);

      expect(result).toBeDefined();
      expect(result.partyId).toBe(mockPartyId);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if party not found', async () => {
      (partyService.getParty as jest.Mock).mockResolvedValue(null);

      await expect(
        voiceChatService.createVoiceChannel(mockPartyId, mockUserId)
      ).rejects.toThrow('Party not found');
    });

    it('should throw error if user is not the leader', async () => {
      const mockParty = {
        id: mockPartyId,
        name: 'Test Party',
        leaderId: '123e4567-e89b-12d3-a456-426614174003',
        maxSize: 4,
      };

      (partyService.getParty as jest.Mock).mockResolvedValue(mockParty);

      await expect(
        voiceChatService.createVoiceChannel(mockPartyId, mockUserId)
      ).rejects.toThrow('Only the party leader can create voice channels');
    });

    it('should throw error if party already has a voice channel', async () => {
      const mockParty = {
        id: mockPartyId,
        name: 'Test Party',
        leaderId: mockUserId,
        maxSize: 4,
      };

      const existingChannel = {
        id: mockChannelId,
        party_id: mockPartyId,
        name: 'Existing Channel',
        max_participants: 4,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      (partyService.getParty as jest.Mock).mockResolvedValue(mockParty);
      (pool.query as jest.Mock).mockResolvedValue({ rows: [existingChannel] });

      await expect(
        voiceChatService.createVoiceChannel(mockPartyId, mockUserId)
      ).rejects.toThrow('Party already has a voice channel');
    });
  });

  describe('getVoiceChannel', () => {
    it('should return channel from cache if available', async () => {
      const cachedChannel = {
        id: mockChannelId,
        partyId: mockPartyId,
        name: 'Cached Channel',
        maxParticipants: 4,
        isActive: true,
        createdAt: new Date(),
      };

      (cacheGet as jest.Mock).mockResolvedValue(cachedChannel);

      const result = await voiceChatService.getVoiceChannel(mockChannelId);

      expect(result).toEqual(cachedChannel);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should fetch channel from database if not cached', async () => {
      const dbChannel = {
        id: mockChannelId,
        party_id: mockPartyId,
        name: 'DB Channel',
        max_participants: 4,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      (cacheGet as jest.Mock).mockResolvedValue(null);
      (pool.query as jest.Mock).mockResolvedValue({ rows: [dbChannel] });

      const result = await voiceChatService.getVoiceChannel(mockChannelId);

      expect(result).toBeDefined();
      expect(result?.name).toBe('DB Channel');
      expect(cacheSet).toHaveBeenCalled();
    });
  });

  describe('joinVoiceChannel', () => {
    it('should allow user to join voice channel', async () => {
      const mockChannel = {
        id: mockChannelId,
        partyId: mockPartyId,
        name: 'Test Channel',
        maxParticipants: 4,
        isActive: true,
        createdAt: new Date(),
      };

      const mockMember = {
        id: '1',
        partyId: mockPartyId,
        userId: mockUserId,
        role: PartyRole.MEMBER,
      };

      const mockParticipant = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        channel_id: mockChannelId,
        user_id: mockUserId,
        is_muted: false,
        is_deafened: false,
        is_speaking: false,
        joined_at: new Date().toISOString(),
      };

      (cacheGet as jest.Mock).mockResolvedValue(mockChannel);
      (partyService.getPartyMember as jest.Mock).mockResolvedValue(mockMember);
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockParticipant] });

      const result = await voiceChatService.joinVoiceChannel(mockChannelId, mockUserId);

      expect(result).toBeDefined();
      expect(result.userId).toBe(mockUserId);
      expect(result.isMuted).toBe(false);
    });

    it('should throw error if channel not found', async () => {
      (cacheGet as jest.Mock).mockResolvedValue(null);
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(
        voiceChatService.joinVoiceChannel(mockChannelId, mockUserId)
      ).rejects.toThrow('Voice channel not found');
    });

    it('should throw error if user is not a party member', async () => {
      const mockChannel = {
        id: mockChannelId,
        partyId: mockPartyId,
        name: 'Test Channel',
        maxParticipants: 4,
        isActive: true,
        createdAt: new Date(),
      };

      (cacheGet as jest.Mock).mockResolvedValue(mockChannel);
      (partyService.getPartyMember as jest.Mock).mockResolvedValue(null);

      await expect(
        voiceChatService.joinVoiceChannel(mockChannelId, mockUserId)
      ).rejects.toThrow('You must be a member of the party to join the voice channel');
    });

    it('should throw error if channel is full', async () => {
      const mockChannel = {
        id: mockChannelId,
        partyId: mockPartyId,
        name: 'Test Channel',
        maxParticipants: 2,
        isActive: true,
        createdAt: new Date(),
      };

      const mockMember = {
        id: '1',
        partyId: mockPartyId,
        userId: mockUserId,
        role: PartyRole.MEMBER,
      };

      (cacheGet as jest.Mock).mockResolvedValue(mockChannel);
      (partyService.getPartyMember as jest.Mock).mockResolvedValue(mockMember);
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });

      await expect(
        voiceChatService.joinVoiceChannel(mockChannelId, mockUserId)
      ).rejects.toThrow('Voice channel is full');
    });
  });

  describe('leaveVoiceChannel', () => {
    it('should allow user to leave voice channel', async () => {
      const mockChannel = {
        id: mockChannelId,
        partyId: mockPartyId,
        name: 'Test Channel',
        maxParticipants: 4,
        isActive: true,
        createdAt: new Date(),
      };

      const mockParticipant = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        channel_id: mockChannelId,
        user_id: mockUserId,
        is_muted: false,
        is_deafened: false,
        is_speaking: false,
        joined_at: new Date().toISOString(),
      };

      (cacheGet as jest.Mock).mockResolvedValue(mockChannel);
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockParticipant] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(
        voiceChatService.leaveVoiceChannel(mockChannelId, mockUserId)
      ).resolves.not.toThrow();

      expect(cacheDelete).toHaveBeenCalled();
    });

    it('should throw error if user is not in the channel', async () => {
      const mockChannel = {
        id: mockChannelId,
        partyId: mockPartyId,
        name: 'Test Channel',
        maxParticipants: 4,
        isActive: true,
        createdAt: new Date(),
      };

      (cacheGet as jest.Mock).mockResolvedValue(mockChannel);
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(
        voiceChatService.leaveVoiceChannel(mockChannelId, mockUserId)
      ).rejects.toThrow('You are not in this voice channel');
    });
  });

  describe('updateVoiceStatus', () => {
    it('should update voice status successfully', async () => {
      const mockParticipant = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        channel_id: mockChannelId,
        user_id: mockUserId,
        is_muted: false,
        is_deafened: false,
        is_speaking: false,
        joined_at: new Date().toISOString(),
      };

      const updatedParticipant = {
        ...mockParticipant,
        is_muted: true,
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockParticipant] })
        .mockResolvedValueOnce({ rows: [updatedParticipant] });
      (cacheGet as jest.Mock).mockResolvedValue({
        id: mockChannelId,
        partyId: mockPartyId,
        name: 'Test Channel',
        maxParticipants: 4,
        isActive: true,
        createdAt: new Date(),
      });

      const result = await voiceChatService.updateVoiceStatus(mockChannelId, mockUserId, { isMuted: true });

      expect(result.isMuted).toBe(true);
    });
  });

  describe('muteParticipant', () => {
    it('should allow leader to mute participant', async () => {
      const targetUserId = '123e4567-e89b-12d3-a456-426614174004';
      const mockChannel = {
        id: mockChannelId,
        partyId: mockPartyId,
        name: 'Test Channel',
        maxParticipants: 4,
        isActive: true,
        createdAt: new Date(),
      };

      const mockModerator = {
        id: '1',
        partyId: mockPartyId,
        userId: mockUserId,
        role: PartyRole.LEADER,
      };

      const mockTargetParticipant = {
        id: '2',
        channel_id: mockChannelId,
        user_id: targetUserId,
        is_muted: false,
        is_deafened: false,
        is_speaking: false,
        joined_at: new Date().toISOString(),
      };

      (cacheGet as jest.Mock).mockResolvedValue(mockChannel);
      (partyService.getPartyMember as jest.Mock).mockResolvedValue(mockModerator);
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockTargetParticipant] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(
        voiceChatService.muteParticipant(mockChannelId, mockUserId, targetUserId)
      ).resolves.not.toThrow();
    });

    it('should throw error if moderator is not leader/officer', async () => {
      const targetUserId = '123e4567-e89b-12d3-a456-426614174004';
      const mockChannel = {
        id: mockChannelId,
        partyId: mockPartyId,
        name: 'Test Channel',
        maxParticipants: 4,
        isActive: true,
        createdAt: new Date(),
      };

      const mockModerator = {
        id: '1',
        partyId: mockPartyId,
        userId: mockUserId,
        role: PartyRole.MEMBER,
      };

      (cacheGet as jest.Mock).mockResolvedValue(mockChannel);
      (partyService.getPartyMember as jest.Mock).mockResolvedValue(mockModerator);

      await expect(
        voiceChatService.muteParticipant(mockChannelId, mockUserId, targetUserId)
      ).rejects.toThrow('Only leaders and officers can mute participants');
    });
  });

  describe('getChannelParticipants', () => {
    it('should return participants from cache', async () => {
      const cachedParticipants = [
        { id: '1', channelId: mockChannelId, userId: mockUserId, isMuted: false, isDeafened: false, isSpeaking: false, joinedAt: new Date() },
      ];

      (cacheGet as jest.Mock).mockResolvedValue(cachedParticipants);

      const result = await voiceChatService.getChannelParticipants(mockChannelId);

      expect(result).toEqual(cachedParticipants);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should fetch participants from database if not cached', async () => {
      const dbParticipants = [
        { id: '1', channel_id: mockChannelId, user_id: mockUserId, is_muted: false, is_deafened: false, is_speaking: false, joined_at: new Date().toISOString() },
      ];

      (cacheGet as jest.Mock).mockResolvedValue(null);
      (pool.query as jest.Mock).mockResolvedValue({ rows: dbParticipants });

      const result = await voiceChatService.getChannelParticipants(mockChannelId);

      expect(result).toHaveLength(1);
      expect(cacheSet).toHaveBeenCalled();
    });
  });
});
