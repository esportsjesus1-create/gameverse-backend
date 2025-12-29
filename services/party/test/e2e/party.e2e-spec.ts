import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PartyModule } from '../../src/party.module';
import { PartyStatus, PartyVisibility } from '../../src/entities/party.entity';
import { MemberRole, MemberStatus, ReadyStatus } from '../../src/entities/party-member.entity';
import { InviteStatus, InviteType } from '../../src/entities/party-invite.entity';
import { MessageType } from '../../src/entities/party-chat-message.entity';

describe('Party Module E2E Tests', () => {
  let app: INestApplication;
  let authToken: string;
  let userId: string;
  let partyId: string;

  const mockUser = {
    id: 'test-user-001',
    username: 'testuser',
    email: 'test@example.com',
  };

  const mockUser2 = {
    id: 'test-user-002',
    username: 'testuser2',
    email: 'test2@example.com',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PartyModule],
    })
      .overrideProvider('GamerstakeService')
      .useValue({
        validateToken: jest.fn().mockResolvedValue(mockUser),
        getUser: jest.fn().mockResolvedValue(mockUser),
        getProfile: jest.fn().mockResolvedValue({ rank: 1500, level: 50 }),
        getWallet: jest.fn().mockResolvedValue({ balance: '100.00', isVerified: true }),
        verifyWalletBalance: jest.fn().mockResolvedValue(true),
        getFriends: jest.fn().mockResolvedValue([]),
        areFriends: jest.fn().mockResolvedValue(true),
        sendNotification: jest.fn().mockResolvedValue(true),
      })
      .overrideProvider('RedisCacheService')
      .useValue({
        setParty: jest.fn(),
        getParty: jest.fn().mockResolvedValue(null),
        deleteParty: jest.fn(),
        refreshPartyTTL: jest.fn(),
        setPartyMembers: jest.fn(),
        getPartyMembers: jest.fn().mockResolvedValue(null),
        addPartyMember: jest.fn(),
        removePartyMember: jest.fn(),
        updatePartyMember: jest.fn(),
        setUserParty: jest.fn(),
        getUserParty: jest.fn().mockResolvedValue(null),
        deleteUserParty: jest.fn(),
        setInvite: jest.fn(),
        getInvite: jest.fn().mockResolvedValue(null),
        deleteInvite: jest.fn(),
        setMatchmakingTicket: jest.fn(),
        getMatchmakingTicket: jest.fn().mockResolvedValue(null),
        deleteMatchmakingTicket: jest.fn(),
        setReadyCheck: jest.fn(),
        getReadyCheck: jest.fn().mockResolvedValue(null),
        deleteReadyCheck: jest.fn(),
        updateReadyCheckResponse: jest.fn(),
        publishEvent: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();

    authToken = 'test-auth-token';
    userId = mockUser.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('E2E-PARTY-001: Create Party', () => {
    it('should create a new party successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Party',
          visibility: PartyVisibility.FRIENDS_ONLY,
          maxSize: 4,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Party');
      expect(response.body.leaderId).toBe(userId);
      partyId = response.body.id;
    });
  });

  describe('E2E-PARTY-002: Create Party with Game', () => {
    it('should create a party with game settings', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Gaming Party',
          gameId: 'game-001',
          gameName: 'Test Game',
          gameMode: '5v5',
          visibility: PartyVisibility.PUBLIC,
          maxSize: 5,
        })
        .expect(201);

      expect(response.body.gameId).toBe('game-001');
      expect(response.body.gameName).toBe('Test Game');
    });
  });

  describe('E2E-PARTY-003: Create Party with Join Code', () => {
    it('should create a party with generated join code', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Code Party',
          generateJoinCode: true,
        })
        .expect(201);

      expect(response.body.joinCode).toBeDefined();
      expect(response.body.joinCode).toHaveLength(6);
    });
  });

  describe('E2E-PARTY-004: Create Party with Wallet Requirement', () => {
    it('should create a party requiring wallet verification', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Wager Party',
          requiresWallet: true,
          minimumWalletBalance: 50,
          walletCurrency: 'USD',
        })
        .expect(201);

      expect(response.body.requiresWallet).toBe(true);
    });
  });

  describe('E2E-PARTY-005: Get Current User Party', () => {
    it('should return user active party', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/parties/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('E2E-PARTY-006: Get Party by ID', () => {
    it('should return party details', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Get Test Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/parties/${createResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(createResponse.body.id);
    });
  });

  describe('E2E-PARTY-007: Update Party', () => {
    it('should update party details', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Update Test Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/parties/${createResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Party Name', description: 'New description' })
        .expect(200);

      expect(response.body.name).toBe('Updated Party Name');
    });
  });

  describe('E2E-PARTY-008: Disband Party', () => {
    it('should disband party successfully', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Disband Test Party' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/parties/${createResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });

  describe('E2E-PARTY-009: Get Public Parties', () => {
    it('should return list of public parties', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/parties/public')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('parties');
      expect(response.body).toHaveProperty('total');
    });
  });

  describe('E2E-PARTY-010: Search Parties', () => {
    it('should search parties by query', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/parties/search?q=test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('E2E-PARTY-011: Get Party History', () => {
    it('should return user party history', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/parties/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('E2E-PARTY-012: Regenerate Join Code', () => {
    it('should regenerate party join code', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Code Regen Party', generateJoinCode: true })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/join-code`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.joinCode).toBeDefined();
    });
  });

  describe('E2E-PARTY-013: Remove Join Code', () => {
    it('should remove party join code', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Code Remove Party', generateJoinCode: true })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/parties/${createResponse.body.id}/join-code`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });

  describe('E2E-PARTY-014: Set Party Game', () => {
    it('should set party game', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Game Set Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/parties/${createResponse.body.id}/game`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ gameId: 'game-002', gameName: 'New Game', gameMode: '3v3' })
        .expect(200);

      expect(response.body.gameId).toBe('game-002');
    });
  });

  describe('E2E-PARTY-015: Set Party Visibility', () => {
    it('should change party visibility', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Visibility Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/parties/${createResponse.body.id}/visibility`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ visibility: PartyVisibility.PUBLIC })
        .expect(200);

      expect(response.body.visibility).toBe(PartyVisibility.PUBLIC);
    });
  });

  describe('E2E-PARTY-016: Get Party Stats', () => {
    it('should return party statistics', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Stats Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/parties/${createResponse.body.id}/stats`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('currentSize');
      expect(response.body).toHaveProperty('maxSize');
    });
  });

  describe('E2E-PARTY-017: Get Party Members', () => {
    it('should return party members list', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Members Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/parties/${createResponse.body.id}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('E2E-PARTY-018: Add Member to Party', () => {
    it('should add a new member to party', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Add Member Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: mockUser2.id,
          username: mockUser2.username,
        })
        .expect(201);

      expect(response.body.userId).toBe(mockUser2.id);
    });
  });

  describe('E2E-PARTY-019: Leave Party', () => {
    it('should allow member to leave party', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Leave Party' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/parties/${createResponse.body.id}/members/me`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });

  describe('E2E-PARTY-020: Kick Member', () => {
    it('should kick member from party', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Kick Party' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/members/kick`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: mockUser2.id, reason: 'Test kick' })
        .expect(204);
    });
  });

  describe('E2E-PARTY-021: Update Member', () => {
    it('should update member details', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Update Member Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/parties/${createResponse.body.id}/members/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ preferredRole: 'Support' })
        .expect(200);

      expect(response.body.preferredRole).toBe('Support');
    });
  });

  describe('E2E-PARTY-022: Transfer Leadership', () => {
    it('should transfer party leadership', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Transfer Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/transfer-leadership`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ newLeaderId: mockUser2.id })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('E2E-PARTY-023: Promote to Co-Leader', () => {
    it('should promote member to co-leader', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Promote Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/members/${mockUser2.id}/promote`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.role).toBe(MemberRole.CO_LEADER);
    });
  });

  describe('E2E-PARTY-024: Demote from Co-Leader', () => {
    it('should demote co-leader to member', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Demote Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/members/${mockUser2.id}/demote`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.role).toBe(MemberRole.MEMBER);
    });
  });

  describe('E2E-PARTY-025: Set Ready Status', () => {
    it('should set member ready status', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Ready Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/parties/${createResponse.body.id}/members/me/ready`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ readyStatus: ReadyStatus.READY })
        .expect(200);

      expect(response.body.readyStatus).toBe(ReadyStatus.READY);
    });
  });

  describe('E2E-PARTY-026: Update Member Permissions', () => {
    it('should update member permissions', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Permissions Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/parties/${createResponse.body.id}/members/${mockUser2.id}/permissions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: mockUser2.id, canInvite: true, canKick: false })
        .expect(200);

      expect(response.body.canInvite).toBe(true);
    });
  });

  describe('E2E-PARTY-027: Create Invite', () => {
    it('should create party invite', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Invite Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/invites`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ inviteeId: mockUser2.id, inviteeUsername: mockUser2.username })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.inviteeId).toBe(mockUser2.id);
    });
  });

  describe('E2E-PARTY-028: Create Bulk Invites', () => {
    it('should create multiple invites at once', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Bulk Invite Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/invites/bulk`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userIds: [mockUser2.id, 'user-003'], message: 'Join us!' })
        .expect(201);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('E2E-PARTY-029: Invite Friends', () => {
    it('should invite all online friends', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Friends Invite Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/invites/friends`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('E2E-PARTY-030: Get Party Invites', () => {
    it('should return party invites list', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Get Invites Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/parties/${createResponse.body.id}/invites`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('E2E-PARTY-031: Create Invite Link', () => {
    it('should create shareable invite link', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Link Invite Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/invites/link`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ maxUses: 10, expiresInHours: 24 })
        .expect(201);

      expect(response.body).toHaveProperty('inviteLink');
      expect(response.body).toHaveProperty('token');
    });
  });

  describe('E2E-PARTY-032: Get User Pending Invites', () => {
    it('should return user pending invites', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/parties/invites/pending')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('E2E-PARTY-033: Accept Invite', () => {
    it('should accept party invite', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/parties/invites/test-invite-id/respond')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ accept: true })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('E2E-PARTY-034: Decline Invite', () => {
    it('should decline party invite', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/parties/invites/test-invite-id-2/respond')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ accept: false, message: 'Not interested' })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('E2E-PARTY-035: Cancel Invite', () => {
    it('should cancel pending invite', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/parties/invites/test-invite-id-3')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });

  describe('E2E-PARTY-036: Join by Code', () => {
    it('should join party using code', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/parties/join/code')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: 'ABC123' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });
  });

  describe('E2E-PARTY-037: Join by Token', () => {
    it('should join party using invite token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/parties/join/token')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: 'test-invite-token' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });
  });

  describe('E2E-PARTY-038: Get Messages', () => {
    it('should return party chat messages', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Chat Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/parties/${createResponse.body.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('messages');
      expect(response.body).toHaveProperty('hasMore');
    });
  });

  describe('E2E-PARTY-039: Send Message', () => {
    it('should send chat message', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Send Message Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Hello everyone!', type: MessageType.TEXT })
        .expect(201);

      expect(response.body.content).toBe('Hello everyone!');
    });
  });

  describe('E2E-PARTY-040: Edit Message', () => {
    it('should edit chat message', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Edit Message Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/parties/${createResponse.body.id}/messages/test-message-id`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Edited message' })
        .expect(200);

      expect(response.body.content).toBe('Edited message');
    });
  });

  describe('E2E-PARTY-041: Delete Message', () => {
    it('should delete chat message', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Delete Message Party' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/parties/${createResponse.body.id}/messages/test-message-id`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });

  describe('E2E-PARTY-042: Add Reaction', () => {
    it('should add reaction to message', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Reaction Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/messages/test-message-id/reactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reaction: 'thumbsup' })
        .expect(201);

      expect(response.body.reactions).toBeDefined();
    });
  });

  describe('E2E-PARTY-043: Remove Reaction', () => {
    it('should remove reaction from message', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Remove Reaction Party' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/parties/${createResponse.body.id}/messages/test-message-id/reactions/thumbsup`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });

  describe('E2E-PARTY-044: Pin Message', () => {
    it('should pin chat message', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Pin Message Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/messages/test-message-id/pin`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.isPinned).toBe(true);
    });
  });

  describe('E2E-PARTY-045: Unpin Message', () => {
    it('should unpin chat message', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Unpin Message Party' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/parties/${createResponse.body.id}/messages/test-message-id/pin`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });

  describe('E2E-PARTY-046: Get Pinned Messages', () => {
    it('should return pinned messages', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Pinned Messages Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/parties/${createResponse.body.id}/messages/pinned`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('E2E-PARTY-047: Mark Messages as Read', () => {
    it('should mark messages as read', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Read Messages Party' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/messages/read`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ messageIds: ['msg-1', 'msg-2'] })
        .expect(204);
    });
  });

  describe('E2E-PARTY-048: Get Party Settings', () => {
    it('should return party settings', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Settings Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/parties/${createResponse.body.id}/settings`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('chatEnabled');
    });
  });

  describe('E2E-PARTY-049: Update Party Settings', () => {
    it('should update party settings', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Update Settings Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/parties/${createResponse.body.id}/settings`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ chatEnabled: false, voiceChatEnabled: true })
        .expect(200);

      expect(response.body.chatEnabled).toBe(false);
    });
  });

  describe('E2E-PARTY-050: Reset Party Settings', () => {
    it('should reset party settings to defaults', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Reset Settings Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/settings/reset`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.chatEnabled).toBe(true);
    });
  });

  describe('E2E-PARTY-051: Enable Wager', () => {
    it('should enable wager for party', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Wager Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/settings/wager`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 50, currency: 'USD' })
        .expect(201);

      expect(response.body.wagerEnabled).toBe(true);
    });
  });

  describe('E2E-PARTY-052: Disable Wager', () => {
    it('should disable wager for party', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Disable Wager Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/parties/${createResponse.body.id}/settings/wager`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.wagerEnabled).toBe(false);
    });
  });

  describe('E2E-PARTY-053: Start Matchmaking', () => {
    it('should start matchmaking for party', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Matchmaking Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/matchmaking/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ gameId: 'game-001', gameMode: '5v5' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.gameId).toBe('game-001');
    });
  });

  describe('E2E-PARTY-054: Cancel Matchmaking', () => {
    it('should cancel matchmaking', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cancel Matchmaking Party' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/matchmaking/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Changed mind' })
        .expect(204);
    });
  });

  describe('E2E-PARTY-055: Get Matchmaking Status', () => {
    it('should return matchmaking status', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Matchmaking Status Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/parties/${createResponse.body.id}/matchmaking/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('isMatchmaking');
    });
  });

  describe('E2E-PARTY-056: Start Ready Check', () => {
    it('should start ready check', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Ready Check Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/ready-check/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ timeout: 30 })
        .expect(201);

      expect(response.body).toHaveProperty('responses');
    });
  });

  describe('E2E-PARTY-057: Respond to Ready Check', () => {
    it('should respond to ready check', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Ready Response Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/ready-check/respond`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ready: true })
        .expect(201);

      expect(response.body).toHaveProperty('responses');
    });
  });

  describe('E2E-PARTY-058: Get Ready Check Status', () => {
    it('should return ready check status', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Ready Status Party' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/parties/${createResponse.body.id}/ready-check/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body === null || response.body.hasOwnProperty('responses')).toBe(true);
    });
  });

  describe('E2E-PARTY-059: Cancel Ready Check', () => {
    it('should cancel ready check', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Cancel Ready Party' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/parties/${createResponse.body.id}/ready-check/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });

  describe('E2E-PARTY-060: Create Party with Rank Requirements', () => {
    it('should create party with rank restrictions', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Ranked Party',
          minRank: 1000,
          maxRank: 2000,
        })
        .expect(201);

      expect(response.body.minRank).toBe(1000);
      expect(response.body.maxRank).toBe(2000);
    });
  });

  describe('E2E-PARTY-061: Create Party with Region', () => {
    it('should create party with region setting', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Regional Party',
          region: 'NA',
          language: 'en',
        })
        .expect(201);

      expect(response.body.region).toBe('NA');
      expect(response.body.language).toBe('en');
    });
  });

  describe('E2E-PARTY-062: Filter Public Parties by Game', () => {
    it('should filter public parties by game ID', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/parties/public?gameId=game-001')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('parties');
    });
  });

  describe('E2E-PARTY-063: Filter Public Parties by Region', () => {
    it('should filter public parties by region', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/parties/public?region=NA')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('parties');
    });
  });

  describe('E2E-PARTY-064: Pagination for Public Parties', () => {
    it('should paginate public parties', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/parties/public?limit=10&offset=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('parties');
      expect(response.body).toHaveProperty('total');
    });
  });

  describe('E2E-PARTY-065: Unauthorized Access', () => {
    it('should reject requests without auth token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/parties/me')
        .expect(401);
    });
  });
});
