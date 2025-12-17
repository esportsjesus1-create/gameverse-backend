import { InviteService } from '../../src/services/inviteService';
import { pool } from '../../src/config/database';
import { cacheGet, cacheSet, cacheDelete } from '../../src/config/redis';
import { InviteStatus, PartyRole, PartyStatus } from '../../src/types';

jest.mock('../../src/services/partyService', () => ({
  partyService: {
    getParty: jest.fn(),
    getPartyMember: jest.fn(),
    getUserParty: jest.fn(),
    getPartyMemberCount: jest.fn(),
  },
}));

import { partyService } from '../../src/services/partyService';

describe('InviteService', () => {
  let inviteService: InviteService;
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockRecipientId = '123e4567-e89b-12d3-a456-426614174001';
  const mockPartyId = '123e4567-e89b-12d3-a456-426614174002';
  const mockInviteId = '123e4567-e89b-12d3-a456-426614174003';

  beforeEach(() => {
    inviteService = new InviteService();
    jest.clearAllMocks();
  });

  describe('sendInvite', () => {
    it('should send an invite successfully', async () => {
      const mockParty = {
        id: mockPartyId,
        name: 'Test Party',
        leaderId: mockUserId,
        maxSize: 4,
        isPrivate: false,
        status: PartyStatus.ACTIVE,
      };

      const mockMember = {
        id: '1',
        partyId: mockPartyId,
        userId: mockUserId,
        role: PartyRole.LEADER,
      };

      const mockInvite = {
        id: mockInviteId,
        party_id: mockPartyId,
        sender_id: mockUserId,
        recipient_id: mockRecipientId,
        status: InviteStatus.PENDING,
        message: 'Join my party!',
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      };

      (partyService.getParty as jest.Mock).mockResolvedValue(mockParty);
      (partyService.getPartyMember as jest.Mock).mockResolvedValue(mockMember);
      (partyService.getUserParty as jest.Mock).mockResolvedValue(null);
      (partyService.getPartyMemberCount as jest.Mock).mockResolvedValue(1);
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockInvite] });

      const result = await inviteService.sendInvite(mockPartyId, mockUserId, {
        recipientId: mockRecipientId,
        message: 'Join my party!',
      });

      expect(result).toBeDefined();
      expect(result.recipientId).toBe(mockRecipientId);
      expect(result.status).toBe(InviteStatus.PENDING);
    });

    it('should throw error if party not found', async () => {
      (partyService.getParty as jest.Mock).mockResolvedValue(null);

      await expect(
        inviteService.sendInvite(mockPartyId, mockUserId, { recipientId: mockRecipientId })
      ).rejects.toThrow('Party not found');
    });

    it('should throw error if sender is not a member', async () => {
      const mockParty = {
        id: mockPartyId,
        name: 'Test Party',
        leaderId: mockUserId,
        maxSize: 4,
      };

      (partyService.getParty as jest.Mock).mockResolvedValue(mockParty);
      (partyService.getPartyMember as jest.Mock).mockResolvedValue(null);

      await expect(
        inviteService.sendInvite(mockPartyId, mockUserId, { recipientId: mockRecipientId })
      ).rejects.toThrow('You must be a member of the party to send invites');
    });

    it('should throw error if sender is only a member (not leader/officer)', async () => {
      const mockParty = {
        id: mockPartyId,
        name: 'Test Party',
        leaderId: '123e4567-e89b-12d3-a456-426614174004',
        maxSize: 4,
      };

      const mockMember = {
        id: '1',
        partyId: mockPartyId,
        userId: mockUserId,
        role: PartyRole.MEMBER,
      };

      (partyService.getParty as jest.Mock).mockResolvedValue(mockParty);
      (partyService.getPartyMember as jest.Mock).mockResolvedValue(mockMember);

      await expect(
        inviteService.sendInvite(mockPartyId, mockUserId, { recipientId: mockRecipientId })
      ).rejects.toThrow('Only leaders and officers can send invites');
    });

    it('should throw error if recipient is already in a party', async () => {
      const mockParty = {
        id: mockPartyId,
        name: 'Test Party',
        leaderId: mockUserId,
        maxSize: 4,
      };

      const mockMember = {
        id: '1',
        partyId: mockPartyId,
        userId: mockUserId,
        role: PartyRole.LEADER,
      };

      (partyService.getParty as jest.Mock).mockResolvedValue(mockParty);
      (partyService.getPartyMember as jest.Mock).mockResolvedValue(mockMember);
      (partyService.getUserParty as jest.Mock).mockResolvedValue({ id: 'other-party' });

      await expect(
        inviteService.sendInvite(mockPartyId, mockUserId, { recipientId: mockRecipientId })
      ).rejects.toThrow('Recipient is already in a party');
    });
  });

  describe('acceptInvite', () => {
    it('should accept an invite successfully', async () => {
      const mockInvite = {
        id: mockInviteId,
        party_id: mockPartyId,
        sender_id: mockUserId,
        recipient_id: mockRecipientId,
        status: InviteStatus.PENDING,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      };

      const mockParty = {
        id: mockPartyId,
        name: 'Test Party',
        leaderId: mockUserId,
        maxSize: 4,
      };

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };

      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockInvite] });
      (partyService.getParty as jest.Mock).mockResolvedValue(mockParty);
      (partyService.getPartyMemberCount as jest.Mock).mockResolvedValue(1);
      (pool.connect as jest.Mock).mockResolvedValue(mockClient);

      await expect(
        inviteService.acceptInvite(mockInviteId, mockRecipientId)
      ).resolves.not.toThrow();

      expect(mockClient.query).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error if invite not found', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(
        inviteService.acceptInvite(mockInviteId, mockRecipientId)
      ).rejects.toThrow('Invite not found');
    });

    it('should throw error if invite is not for the user', async () => {
      const mockInvite = {
        id: mockInviteId,
        party_id: mockPartyId,
        sender_id: mockUserId,
        recipient_id: '123e4567-e89b-12d3-a456-426614174005',
        status: InviteStatus.PENDING,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      };

      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockInvite] });

      await expect(
        inviteService.acceptInvite(mockInviteId, mockRecipientId)
      ).rejects.toThrow('This invite is not for you');
    });

    it('should throw error if invite has expired', async () => {
      const mockInvite = {
        id: mockInviteId,
        party_id: mockPartyId,
        sender_id: mockUserId,
        recipient_id: mockRecipientId,
        status: InviteStatus.PENDING,
        expires_at: new Date(Date.now() - 1000).toISOString(),
        created_at: new Date().toISOString(),
      };

      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockInvite] });

      await expect(
        inviteService.acceptInvite(mockInviteId, mockRecipientId)
      ).rejects.toThrow('Invite has expired');
    });
  });

  describe('declineInvite', () => {
    it('should decline an invite successfully', async () => {
      const mockInvite = {
        id: mockInviteId,
        party_id: mockPartyId,
        sender_id: mockUserId,
        recipient_id: mockRecipientId,
        status: InviteStatus.PENDING,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockInvite] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(
        inviteService.declineInvite(mockInviteId, mockRecipientId)
      ).resolves.not.toThrow();

      expect(cacheDelete).toHaveBeenCalled();
    });
  });

  describe('cancelInvite', () => {
    it('should cancel an invite by sender', async () => {
      const mockInvite = {
        id: mockInviteId,
        party_id: mockPartyId,
        sender_id: mockUserId,
        recipient_id: mockRecipientId,
        status: InviteStatus.PENDING,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockInvite] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(
        inviteService.cancelInvite(mockInviteId, mockUserId)
      ).resolves.not.toThrow();
    });
  });

  describe('getUserInvites', () => {
    it('should return user invites from cache', async () => {
      const cachedInvites = [
        { id: mockInviteId, partyId: mockPartyId, senderId: mockUserId, recipientId: mockRecipientId, status: InviteStatus.PENDING },
      ];

      (cacheGet as jest.Mock).mockResolvedValue(cachedInvites);

      const result = await inviteService.getUserInvites(mockRecipientId);

      expect(result).toEqual(cachedInvites);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should fetch invites from database if not cached', async () => {
      const dbInvites = [
        { id: mockInviteId, party_id: mockPartyId, sender_id: mockUserId, recipient_id: mockRecipientId, status: InviteStatus.PENDING, expires_at: new Date().toISOString(), created_at: new Date().toISOString() },
      ];

      (cacheGet as jest.Mock).mockResolvedValue(null);
      (pool.query as jest.Mock).mockResolvedValue({ rows: dbInvites });

      const result = await inviteService.getUserInvites(mockRecipientId);

      expect(result).toHaveLength(1);
      expect(cacheSet).toHaveBeenCalled();
    });
  });

  describe('sendBulkInvites', () => {
    it('should send multiple invites and track failures', async () => {
      const mockParty = {
        id: mockPartyId,
        name: 'Test Party',
        leaderId: mockUserId,
        maxSize: 10,
      };

      const mockMember = {
        id: '1',
        partyId: mockPartyId,
        userId: mockUserId,
        role: PartyRole.LEADER,
      };

      const mockInvite = {
        id: mockInviteId,
        party_id: mockPartyId,
        sender_id: mockUserId,
        recipient_id: mockRecipientId,
        status: InviteStatus.PENDING,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      };

      (partyService.getParty as jest.Mock).mockResolvedValue(mockParty);
      (partyService.getPartyMember as jest.Mock).mockResolvedValue(mockMember);
      (partyService.getUserParty as jest.Mock).mockResolvedValue(null);
      (partyService.getPartyMemberCount as jest.Mock).mockResolvedValue(1);
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [mockInvite] });

      const result = await inviteService.sendBulkInvites(mockPartyId, mockUserId, {
        recipientIds: [mockRecipientId],
        message: 'Join us!',
      });

      expect(result.sent).toHaveLength(1);
      expect(result.failed).toHaveLength(0);
    });
  });
});
