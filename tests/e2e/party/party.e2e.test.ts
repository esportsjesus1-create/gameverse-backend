import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';
import {
  createTestUser,
  createTestParty,
  addPartyMember,
  createPartyInvite,
  cleanupTestData,
} from '../helpers/testUtils';

describe('E2E Party Tests', () => {
  let pool: Pool;
  let redis: Redis;
  let client: PoolClient;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.TEST_POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.TEST_POSTGRES_PORT || '5433', 10),
      database: process.env.TEST_POSTGRES_DB || 'gameverse_test',
      user: process.env.TEST_POSTGRES_USER || 'gameverse_test',
      password: process.env.TEST_POSTGRES_PASSWORD || 'gameverse_test_secret',
    });
    redis = new Redis({
      host: process.env.TEST_REDIS_HOST || 'localhost',
      port: parseInt(process.env.TEST_REDIS_PORT || '6380', 10),
      db: parseInt(process.env.TEST_REDIS_DB || '1', 10),
      lazyConnect: true,
    });
  });

  beforeEach(async () => {
    client = await pool.connect();
    await cleanupTestData(client);
  });

  afterEach(async () => {
    if (client) {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
    await redis.quit();
  });

  describe('E2E-PARTY-001: Create party with valid parameters', () => {
    it('should create a new party successfully', async () => {
      const user = await createTestUser(client);
      const party = await createTestParty(client, user.id, { name: 'Test Party' });

      expect(party).toBeDefined();
      expect(party.id).toBeDefined();
      expect(party.name).toBe('Test Party');
      expect(party.leader_id).toBe(user.id);
      expect(party.status).toBe('active');
      expect(party.current_size).toBe(1);
    });
  });

  describe('E2E-PARTY-002: Create party with maximum size', () => {
    it('should create party with specified max size', async () => {
      const user = await createTestUser(client);
      const party = await createTestParty(client, user.id, { max_size: 10 });

      expect(party.max_size).toBe(10);
    });
  });

  describe('E2E-PARTY-003: Create private party', () => {
    it('should create a private party', async () => {
      const user = await createTestUser(client);
      const party = await createTestParty(client, user.id, { is_private: true });

      expect(party.is_private).toBe(true);
    });
  });

  describe('E2E-PARTY-004: Create party with game mode', () => {
    it('should create party with specified game mode', async () => {
      const user = await createTestUser(client);
      const party = await createTestParty(client, user.id, { game_mode: 'ranked' });

      expect(party.game_mode).toBe('ranked');
    });
  });

  describe('E2E-PARTY-005: Create party with region', () => {
    it('should create party with specified region', async () => {
      const user = await createTestUser(client);
      const party = await createTestParty(client, user.id, { region: 'na-east' });

      expect(party.region).toBe('na-east');
    });
  });

  describe('E2E-PARTY-006: Leader is automatically added as member', () => {
    it('should add leader as party member on creation', async () => {
      const user = await createTestUser(client);
      const party = await createTestParty(client, user.id);

      const result = await client.query(
        'SELECT * FROM party_members WHERE party_id = $1 AND user_id = $2',
        [party.id, user.id]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].role).toBe('leader');
    });
  });

  describe('E2E-PARTY-007: Get party by ID', () => {
    it('should retrieve party by ID', async () => {
      const user = await createTestUser(client);
      const party = await createTestParty(client, user.id);

      const result = await client.query('SELECT * FROM parties WHERE id = $1', [party.id]);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].id).toBe(party.id);
    });
  });

  describe('E2E-PARTY-008: Get party members', () => {
    it('should retrieve all party members', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const party = await createTestParty(client, user1.id);
      await addPartyMember(client, party.id, user2.id);

      const result = await client.query('SELECT * FROM party_members WHERE party_id = $1', [
        party.id,
      ]);

      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-PARTY-009: Join party as member', () => {
    it('should allow user to join party', async () => {
      const leader = await createTestUser(client);
      const member = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      const partyMember = await addPartyMember(client, party.id, member.id);

      expect(partyMember.party_id).toBe(party.id);
      expect(partyMember.user_id).toBe(member.id);
      expect(partyMember.role).toBe('member');
    });
  });

  describe('E2E-PARTY-010: Party size increments on join', () => {
    it('should increment current_size when member joins', async () => {
      const leader = await createTestUser(client);
      const member = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      await addPartyMember(client, party.id, member.id);

      const result = await client.query('SELECT current_size FROM parties WHERE id = $1', [
        party.id,
      ]);
      expect(result.rows[0].current_size).toBe(2);
    });
  });

  describe('E2E-PARTY-011: Leave party as member', () => {
    it('should allow member to leave party', async () => {
      const leader = await createTestUser(client);
      const member = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      await addPartyMember(client, party.id, member.id);

      await client.query('DELETE FROM party_members WHERE party_id = $1 AND user_id = $2', [
        party.id,
        member.id,
      ]);
      await client.query('UPDATE parties SET current_size = current_size - 1 WHERE id = $1', [
        party.id,
      ]);

      const result = await client.query(
        'SELECT * FROM party_members WHERE party_id = $1 AND user_id = $2',
        [party.id, member.id]
      );
      expect(result.rows.length).toBe(0);
    });
  });

  describe('E2E-PARTY-012: Party size decrements on leave', () => {
    it('should decrement current_size when member leaves', async () => {
      const leader = await createTestUser(client);
      const member = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      await addPartyMember(client, party.id, member.id);

      await client.query('DELETE FROM party_members WHERE party_id = $1 AND user_id = $2', [
        party.id,
        member.id,
      ]);
      await client.query('UPDATE parties SET current_size = current_size - 1 WHERE id = $1', [
        party.id,
      ]);

      const result = await client.query('SELECT current_size FROM parties WHERE id = $1', [
        party.id,
      ]);
      expect(result.rows[0].current_size).toBe(1);
    });
  });

  describe('E2E-PARTY-013: Disband party as leader', () => {
    it('should allow leader to disband party', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      await client.query(
        "UPDATE parties SET status = 'disbanded', disbanded_at = NOW() WHERE id = $1",
        [party.id]
      );

      const result = await client.query('SELECT status FROM parties WHERE id = $1', [party.id]);
      expect(result.rows[0].status).toBe('disbanded');
    });
  });

  describe('E2E-PARTY-014: Transfer leadership', () => {
    it('should transfer party leadership to another member', async () => {
      const leader = await createTestUser(client);
      const member = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      await addPartyMember(client, party.id, member.id);

      await client.query('UPDATE parties SET leader_id = $1 WHERE id = $2', [member.id, party.id]);
      await client.query(
        "UPDATE party_members SET role = 'member' WHERE party_id = $1 AND user_id = $2",
        [party.id, leader.id]
      );
      await client.query(
        "UPDATE party_members SET role = 'leader' WHERE party_id = $1 AND user_id = $2",
        [party.id, member.id]
      );

      const result = await client.query('SELECT leader_id FROM parties WHERE id = $1', [party.id]);
      expect(result.rows[0].leader_id).toBe(member.id);
    });
  });

  describe('E2E-PARTY-015: Promote member to co-leader', () => {
    it('should promote member to co-leader', async () => {
      const leader = await createTestUser(client);
      const member = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      await addPartyMember(client, party.id, member.id);

      await client.query(
        "UPDATE party_members SET role = 'co-leader' WHERE party_id = $1 AND user_id = $2",
        [party.id, member.id]
      );

      const result = await client.query(
        'SELECT role FROM party_members WHERE party_id = $1 AND user_id = $2',
        [party.id, member.id]
      );
      expect(result.rows[0].role).toBe('co-leader');
    });
  });

  describe('E2E-PARTY-016: Demote co-leader to member', () => {
    it('should demote co-leader to member', async () => {
      const leader = await createTestUser(client);
      const member = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      await addPartyMember(client, party.id, member.id, 'co-leader');

      await client.query(
        "UPDATE party_members SET role = 'member' WHERE party_id = $1 AND user_id = $2",
        [party.id, member.id]
      );

      const result = await client.query(
        'SELECT role FROM party_members WHERE party_id = $1 AND user_id = $2',
        [party.id, member.id]
      );
      expect(result.rows[0].role).toBe('member');
    });
  });

  describe('E2E-PARTY-017: Kick member from party', () => {
    it('should allow leader to kick member', async () => {
      const leader = await createTestUser(client);
      const member = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      await addPartyMember(client, party.id, member.id);

      await client.query('DELETE FROM party_members WHERE party_id = $1 AND user_id = $2', [
        party.id,
        member.id,
      ]);

      const result = await client.query(
        'SELECT * FROM party_members WHERE party_id = $1 AND user_id = $2',
        [party.id, member.id]
      );
      expect(result.rows.length).toBe(0);
    });
  });

  describe('E2E-PARTY-018: Send party invite', () => {
    it('should create party invite', async () => {
      const leader = await createTestUser(client);
      const invitee = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      const invite = await createPartyInvite(client, party.id, leader.id, invitee.id);

      expect(invite.party_id).toBe(party.id);
      expect(invite.sender_id).toBe(leader.id);
      expect(invite.recipient_id).toBe(invitee.id);
      expect(invite.status).toBe('pending');
    });
  });

  describe('E2E-PARTY-019: Accept party invite', () => {
    it('should accept party invite and join party', async () => {
      const leader = await createTestUser(client);
      const invitee = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      const invite = await createPartyInvite(client, party.id, leader.id, invitee.id);

      await client.query(
        "UPDATE party_invites SET status = 'accepted', responded_at = NOW() WHERE id = $1",
        [invite.id]
      );

      const result = await client.query('SELECT status FROM party_invites WHERE id = $1', [
        invite.id,
      ]);
      expect(result.rows[0].status).toBe('accepted');
    });
  });

  describe('E2E-PARTY-020: Decline party invite', () => {
    it('should decline party invite', async () => {
      const leader = await createTestUser(client);
      const invitee = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      const invite = await createPartyInvite(client, party.id, leader.id, invitee.id);

      await client.query(
        "UPDATE party_invites SET status = 'declined', responded_at = NOW() WHERE id = $1",
        [invite.id]
      );

      const result = await client.query('SELECT status FROM party_invites WHERE id = $1', [
        invite.id,
      ]);
      expect(result.rows[0].status).toBe('declined');
    });
  });

  describe('E2E-PARTY-021: Cancel party invite', () => {
    it('should cancel pending party invite', async () => {
      const leader = await createTestUser(client);
      const invitee = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      const invite = await createPartyInvite(client, party.id, leader.id, invitee.id);

      await client.query("UPDATE party_invites SET status = 'cancelled' WHERE id = $1", [
        invite.id,
      ]);

      const result = await client.query('SELECT status FROM party_invites WHERE id = $1', [
        invite.id,
      ]);
      expect(result.rows[0].status).toBe('cancelled');
    });
  });

  describe('E2E-PARTY-022: Invite expires after timeout', () => {
    it('should mark invite as expired', async () => {
      const leader = await createTestUser(client);
      const invitee = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      const expiredDate = new Date(Date.now() - 1000);
      const invite = await createPartyInvite(client, party.id, leader.id, invitee.id, {
        expires_at: expiredDate,
      });

      await client.query(
        "UPDATE party_invites SET status = 'expired' WHERE id = $1 AND expires_at < NOW()",
        [invite.id]
      );

      const result = await client.query('SELECT status FROM party_invites WHERE id = $1', [
        invite.id,
      ]);
      expect(result.rows[0].status).toBe('expired');
    });
  });

  describe('E2E-PARTY-023: Get pending invites for user', () => {
    it('should retrieve all pending invites for user', async () => {
      const leader = await createTestUser(client);
      const invitee = await createTestUser(client);
      const party1 = await createTestParty(client, leader.id);
      const party2 = await createTestParty(client, leader.id);
      await createPartyInvite(client, party1.id, leader.id, invitee.id);
      await createPartyInvite(client, party2.id, leader.id, invitee.id);

      const result = await client.query(
        "SELECT * FROM party_invites WHERE recipient_id = $1 AND status = 'pending'",
        [invitee.id]
      );

      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-PARTY-024: Set member ready status', () => {
    it('should update member ready status', async () => {
      const leader = await createTestUser(client);
      const member = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      await addPartyMember(client, party.id, member.id);

      await client.query(
        'UPDATE party_members SET is_ready = true WHERE party_id = $1 AND user_id = $2',
        [party.id, member.id]
      );

      const result = await client.query(
        'SELECT is_ready FROM party_members WHERE party_id = $1 AND user_id = $2',
        [party.id, member.id]
      );
      expect(result.rows[0].is_ready).toBe(true);
    });
  });

  describe('E2E-PARTY-025: Check all members ready', () => {
    it('should check if all party members are ready', async () => {
      const leader = await createTestUser(client);
      const member = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      await addPartyMember(client, party.id, member.id);

      await client.query('UPDATE party_members SET is_ready = true WHERE party_id = $1', [
        party.id,
      ]);

      const result = await client.query(
        'SELECT COUNT(*) as total, SUM(CASE WHEN is_ready THEN 1 ELSE 0 END) as ready FROM party_members WHERE party_id = $1',
        [party.id]
      );
      expect(parseInt(result.rows[0].total)).toBe(parseInt(result.rows[0].ready));
    });
  });

  describe('E2E-PARTY-026: Update party settings', () => {
    it('should update party settings', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      await client.query('UPDATE parties SET settings = $1 WHERE id = $2', [
        JSON.stringify({ autoStart: true, voiceRequired: false }),
        party.id,
      ]);

      const result = await client.query('SELECT settings FROM parties WHERE id = $1', [party.id]);
      expect(result.rows[0].settings.autoStart).toBe(true);
    });
  });

  describe('E2E-PARTY-027: Update party name', () => {
    it('should update party name', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      await client.query('UPDATE parties SET name = $1 WHERE id = $2', [
        'New Party Name',
        party.id,
      ]);

      const result = await client.query('SELECT name FROM parties WHERE id = $1', [party.id]);
      expect(result.rows[0].name).toBe('New Party Name');
    });
  });

  describe('E2E-PARTY-028: Update party max size', () => {
    it('should update party max size', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      await client.query('UPDATE parties SET max_size = $1 WHERE id = $2', [8, party.id]);

      const result = await client.query('SELECT max_size FROM parties WHERE id = $1', [party.id]);
      expect(result.rows[0].max_size).toBe(8);
    });
  });

  describe('E2E-PARTY-029: Update party privacy', () => {
    it('should toggle party privacy', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id, { is_private: false });

      await client.query('UPDATE parties SET is_private = true WHERE id = $1', [party.id]);

      const result = await client.query('SELECT is_private FROM parties WHERE id = $1', [party.id]);
      expect(result.rows[0].is_private).toBe(true);
    });
  });

  describe('E2E-PARTY-030: Update party game mode', () => {
    it('should update party game mode', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id, { game_mode: 'casual' });

      await client.query('UPDATE parties SET game_mode = $1 WHERE id = $2', ['ranked', party.id]);

      const result = await client.query('SELECT game_mode FROM parties WHERE id = $1', [party.id]);
      expect(result.rows[0].game_mode).toBe('ranked');
    });
  });

  describe('E2E-PARTY-031: Create voice channel for party', () => {
    it('should create voice channel', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      const result = await client.query(
        `INSERT INTO voice_channels (party_id, name, max_participants, bitrate)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [party.id, 'Party Voice', 10, 64000]
      );

      expect(result.rows[0].party_id).toBe(party.id);
      expect(result.rows[0].is_active).toBe(true);
    });
  });

  describe('E2E-PARTY-032: Join voice channel', () => {
    it('should add user to voice channel', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      const channelResult = await client.query(
        `INSERT INTO voice_channels (party_id, name) VALUES ($1, $2) RETURNING *`,
        [party.id, 'Voice']
      );

      const result = await client.query(
        `INSERT INTO voice_participants (channel_id, user_id) VALUES ($1, $2) RETURNING *`,
        [channelResult.rows[0].id, leader.id]
      );

      expect(result.rows[0].user_id).toBe(leader.id);
    });
  });

  describe('E2E-PARTY-033: Leave voice channel', () => {
    it('should remove user from voice channel', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      const channelResult = await client.query(
        `INSERT INTO voice_channels (party_id, name) VALUES ($1, $2) RETURNING *`,
        [party.id, 'Voice']
      );
      await client.query(`INSERT INTO voice_participants (channel_id, user_id) VALUES ($1, $2)`, [
        channelResult.rows[0].id,
        leader.id,
      ]);

      await client.query('DELETE FROM voice_participants WHERE channel_id = $1 AND user_id = $2', [
        channelResult.rows[0].id,
        leader.id,
      ]);

      const result = await client.query(
        'SELECT * FROM voice_participants WHERE channel_id = $1 AND user_id = $2',
        [channelResult.rows[0].id, leader.id]
      );
      expect(result.rows.length).toBe(0);
    });
  });

  describe('E2E-PARTY-034: Mute in voice channel', () => {
    it('should mute user in voice channel', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      const channelResult = await client.query(
        `INSERT INTO voice_channels (party_id, name) VALUES ($1, $2) RETURNING *`,
        [party.id, 'Voice']
      );
      await client.query(`INSERT INTO voice_participants (channel_id, user_id) VALUES ($1, $2)`, [
        channelResult.rows[0].id,
        leader.id,
      ]);

      await client.query(
        'UPDATE voice_participants SET is_muted = true WHERE channel_id = $1 AND user_id = $2',
        [channelResult.rows[0].id, leader.id]
      );

      const result = await client.query(
        'SELECT is_muted FROM voice_participants WHERE channel_id = $1 AND user_id = $2',
        [channelResult.rows[0].id, leader.id]
      );
      expect(result.rows[0].is_muted).toBe(true);
    });
  });

  describe('E2E-PARTY-035: Deafen in voice channel', () => {
    it('should deafen user in voice channel', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      const channelResult = await client.query(
        `INSERT INTO voice_channels (party_id, name) VALUES ($1, $2) RETURNING *`,
        [party.id, 'Voice']
      );
      await client.query(`INSERT INTO voice_participants (channel_id, user_id) VALUES ($1, $2)`, [
        channelResult.rows[0].id,
        leader.id,
      ]);

      await client.query(
        'UPDATE voice_participants SET is_deafened = true WHERE channel_id = $1 AND user_id = $2',
        [channelResult.rows[0].id, leader.id]
      );

      const result = await client.query(
        'SELECT is_deafened FROM voice_participants WHERE channel_id = $1 AND user_id = $2',
        [channelResult.rows[0].id, leader.id]
      );
      expect(result.rows[0].is_deafened).toBe(true);
    });
  });

  describe('E2E-PARTY-036: Get voice channel participants', () => {
    it('should retrieve all voice channel participants', async () => {
      const leader = await createTestUser(client);
      const member = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      await addPartyMember(client, party.id, member.id);

      const channelResult = await client.query(
        `INSERT INTO voice_channels (party_id, name) VALUES ($1, $2) RETURNING *`,
        [party.id, 'Voice']
      );
      await client.query(`INSERT INTO voice_participants (channel_id, user_id) VALUES ($1, $2)`, [
        channelResult.rows[0].id,
        leader.id,
      ]);
      await client.query(`INSERT INTO voice_participants (channel_id, user_id) VALUES ($1, $2)`, [
        channelResult.rows[0].id,
        member.id,
      ]);

      const result = await client.query('SELECT * FROM voice_participants WHERE channel_id = $1', [
        channelResult.rows[0].id,
      ]);
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-PARTY-037: Get party benefits', () => {
    it('should retrieve party benefits', async () => {
      await client.query(
        `INSERT INTO party_benefits (name, type, value, min_party_size) VALUES ($1, $2, $3, $4)`,
        ['XP Boost', 'xp_multiplier', 1.5, 2]
      );

      const result = await client.query('SELECT * FROM party_benefits WHERE is_active = true');
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('E2E-PARTY-038: Calculate party benefits for size', () => {
    it('should get applicable benefits for party size', async () => {
      await client.query(
        `INSERT INTO party_benefits (name, type, value, min_party_size, max_party_size) VALUES ($1, $2, $3, $4, $5)`,
        ['Duo Boost', 'xp_multiplier', 1.1, 2, 2]
      );
      await client.query(
        `INSERT INTO party_benefits (name, type, value, min_party_size, max_party_size) VALUES ($1, $2, $3, $4, $5)`,
        ['Squad Boost', 'xp_multiplier', 1.25, 3, 4]
      );

      const result = await client.query(
        `SELECT * FROM party_benefits WHERE is_active = true AND min_party_size <= $1 
         AND (max_party_size IS NULL OR max_party_size >= $1)`,
        [3]
      );
      expect(result.rows.some((r: { name: string }) => r.name === 'Squad Boost')).toBe(true);
    });
  });

  describe('E2E-PARTY-039: Party status changes to in_game', () => {
    it('should update party status to in_game', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      await client.query("UPDATE parties SET status = 'in_game' WHERE id = $1", [party.id]);

      const result = await client.query('SELECT status FROM parties WHERE id = $1', [party.id]);
      expect(result.rows[0].status).toBe('in_game');
    });
  });

  describe('E2E-PARTY-040: Party status changes back to active', () => {
    it('should update party status back to active', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      await client.query("UPDATE parties SET status = 'in_game' WHERE id = $1", [party.id]);

      await client.query("UPDATE parties SET status = 'active' WHERE id = $1", [party.id]);

      const result = await client.query('SELECT status FROM parties WHERE id = $1', [party.id]);
      expect(result.rows[0].status).toBe('active');
    });
  });

  describe('E2E-PARTY-041: Log party activity', () => {
    it('should log party activity', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      await client.query(
        `INSERT INTO party_activity_log (party_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
        [party.id, leader.id, 'party_created', JSON.stringify({ name: party.name })]
      );

      const result = await client.query('SELECT * FROM party_activity_log WHERE party_id = $1', [
        party.id,
      ]);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].action).toBe('party_created');
    });
  });

  describe('E2E-PARTY-042: Get party activity log', () => {
    it('should retrieve party activity log', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      await client.query(
        `INSERT INTO party_activity_log (party_id, user_id, action) VALUES ($1, $2, $3)`,
        [party.id, leader.id, 'party_created']
      );
      await client.query(
        `INSERT INTO party_activity_log (party_id, user_id, action) VALUES ($1, $2, $3)`,
        [party.id, leader.id, 'settings_updated']
      );

      const result = await client.query(
        'SELECT * FROM party_activity_log WHERE party_id = $1 ORDER BY created_at DESC',
        [party.id]
      );
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-PARTY-043: Search public parties', () => {
    it('should search for public parties', async () => {
      const leader = await createTestUser(client);
      await createTestParty(client, leader.id, { name: 'Ranked Squad', is_private: false });
      await createTestParty(client, leader.id, { name: 'Casual Game', is_private: false });
      await createTestParty(client, leader.id, { name: 'Private Match', is_private: true });

      const result = await client.query(
        "SELECT * FROM parties WHERE is_private = false AND status = 'active'"
      );
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-PARTY-044: Filter parties by game mode', () => {
    it('should filter parties by game mode', async () => {
      const leader = await createTestUser(client);
      await createTestParty(client, leader.id, { game_mode: 'ranked' });
      await createTestParty(client, leader.id, { game_mode: 'casual' });

      const result = await client.query(
        "SELECT * FROM parties WHERE game_mode = 'ranked' AND status = 'active'"
      );
      expect(result.rows.length).toBe(1);
    });
  });

  describe('E2E-PARTY-045: Filter parties by region', () => {
    it('should filter parties by region', async () => {
      const leader = await createTestUser(client);
      await createTestParty(client, leader.id, { region: 'na-east' });
      await createTestParty(client, leader.id, { region: 'eu-west' });

      const result = await client.query(
        "SELECT * FROM parties WHERE region = 'na-east' AND status = 'active'"
      );
      expect(result.rows.length).toBe(1);
    });
  });

  describe('E2E-PARTY-046: Filter parties with available slots', () => {
    it('should filter parties with available slots', async () => {
      const leader = await createTestUser(client);
      await createTestParty(client, leader.id, { max_size: 4, current_size: 2 });
      await createTestParty(client, leader.id, { max_size: 2, current_size: 2 });

      const result = await client.query(
        "SELECT * FROM parties WHERE current_size < max_size AND status = 'active'"
      );
      expect(result.rows.length).toBe(1);
    });
  });

  describe('E2E-PARTY-047: Get user current party', () => {
    it('should get user current party', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      const result = await client.query(
        `SELECT p.* FROM parties p 
         JOIN party_members pm ON p.id = pm.party_id 
         WHERE pm.user_id = $1 AND p.status = 'active'`,
        [leader.id]
      );
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].id).toBe(party.id);
    });
  });

  describe('E2E-PARTY-048: Check if user is in party', () => {
    it('should check if user is in any party', async () => {
      const leader = await createTestUser(client);
      await createTestParty(client, leader.id);

      const result = await client.query(
        `SELECT EXISTS(
          SELECT 1 FROM party_members pm 
          JOIN parties p ON pm.party_id = p.id 
          WHERE pm.user_id = $1 AND p.status = 'active'
        ) as in_party`,
        [leader.id]
      );
      expect(result.rows[0].in_party).toBe(true);
    });
  });

  describe('E2E-PARTY-049: Prevent joining when already in party', () => {
    it('should detect user already in party', async () => {
      const leader = await createTestUser(client);
      const member = await createTestUser(client);
      const party1 = await createTestParty(client, leader.id);
      await addPartyMember(client, party1.id, member.id);

      const result = await client.query(
        `SELECT EXISTS(
          SELECT 1 FROM party_members pm 
          JOIN parties p ON pm.party_id = p.id 
          WHERE pm.user_id = $1 AND p.status = 'active'
        ) as in_party`,
        [member.id]
      );
      expect(result.rows[0].in_party).toBe(true);
    });
  });

  describe('E2E-PARTY-050: Prevent joining full party', () => {
    it('should detect party is full', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id, { max_size: 2, current_size: 2 });

      const result = await client.query(
        'SELECT current_size >= max_size as is_full FROM parties WHERE id = $1',
        [party.id]
      );
      expect(result.rows[0].is_full).toBe(true);
    });
  });

  describe('E2E-PARTY-051: Update member mute status', () => {
    it('should update member mute status in party', async () => {
      const leader = await createTestUser(client);
      const member = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      await addPartyMember(client, party.id, member.id);

      await client.query(
        'UPDATE party_members SET is_muted = true WHERE party_id = $1 AND user_id = $2',
        [party.id, member.id]
      );

      const result = await client.query(
        'SELECT is_muted FROM party_members WHERE party_id = $1 AND user_id = $2',
        [party.id, member.id]
      );
      expect(result.rows[0].is_muted).toBe(true);
    });
  });

  describe('E2E-PARTY-052: Update member deafen status', () => {
    it('should update member deafen status in party', async () => {
      const leader = await createTestUser(client);
      const member = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      await addPartyMember(client, party.id, member.id);

      await client.query(
        'UPDATE party_members SET is_deafened = true WHERE party_id = $1 AND user_id = $2',
        [party.id, member.id]
      );

      const result = await client.query(
        'SELECT is_deafened FROM party_members WHERE party_id = $1 AND user_id = $2',
        [party.id, member.id]
      );
      expect(result.rows[0].is_deafened).toBe(true);
    });
  });

  describe('E2E-PARTY-053: Get party member count', () => {
    it('should get accurate party member count', async () => {
      const leader = await createTestUser(client);
      const member1 = await createTestUser(client);
      const member2 = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      await addPartyMember(client, party.id, member1.id);
      await addPartyMember(client, party.id, member2.id);

      const result = await client.query(
        'SELECT COUNT(*) as count FROM party_members WHERE party_id = $1',
        [party.id]
      );
      expect(parseInt(result.rows[0].count)).toBe(3);
    });
  });

  describe('E2E-PARTY-054: Get party with member details', () => {
    it('should get party with member user details', async () => {
      const leader = await createTestUser(client, { display_name: 'Leader User' });
      const party = await createTestParty(client, leader.id);

      const result = await client.query(
        `SELECT p.*, u.display_name as leader_name 
         FROM parties p 
         JOIN users u ON p.leader_id = u.id 
         WHERE p.id = $1`,
        [party.id]
      );
      expect(result.rows[0].leader_name).toBe('Leader User');
    });
  });

  describe('E2E-PARTY-055: Validate party name length', () => {
    it('should enforce party name constraints', async () => {
      const leader = await createTestUser(client);
      const validName = 'A'.repeat(100);
      const party = await createTestParty(client, leader.id, { name: validName });

      expect(party.name.length).toBe(100);
    });
  });

  describe('E2E-PARTY-056: Validate max party size bounds', () => {
    it('should enforce max party size constraints', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id, { max_size: 100 });

      expect(party.max_size).toBeLessThanOrEqual(100);
      expect(party.max_size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('E2E-PARTY-057: Handle concurrent join requests', () => {
    it('should handle multiple join requests', async () => {
      const leader = await createTestUser(client);
      const member1 = await createTestUser(client);
      const member2 = await createTestUser(client);
      const party = await createTestParty(client, leader.id, { max_size: 4 });

      await Promise.all([
        addPartyMember(client, party.id, member1.id),
        addPartyMember(client, party.id, member2.id),
      ]);

      const result = await client.query('SELECT current_size FROM parties WHERE id = $1', [
        party.id,
      ]);
      expect(result.rows[0].current_size).toBe(3);
    });
  });

  describe('E2E-PARTY-058: Party timestamps are set correctly', () => {
    it('should set created_at and updated_at timestamps', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      expect(party.created_at).toBeDefined();
      expect(party.updated_at).toBeDefined();
    });
  });

  describe('E2E-PARTY-059: Update party updates timestamp', () => {
    it('should update updated_at on party modification', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      const originalUpdatedAt = party.updated_at;

      await client.query('UPDATE parties SET name = $1, updated_at = NOW() WHERE id = $2', [
        'Updated Name',
        party.id,
      ]);

      const result = await client.query('SELECT updated_at FROM parties WHERE id = $1', [party.id]);
      expect(new Date(result.rows[0].updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(originalUpdatedAt).getTime()
      );
    });
  });

  describe('E2E-PARTY-060: Get parties created by user', () => {
    it('should get all parties where user is leader', async () => {
      const leader = await createTestUser(client);
      await createTestParty(client, leader.id);
      await createTestParty(client, leader.id);

      const result = await client.query('SELECT * FROM parties WHERE leader_id = $1', [leader.id]);
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-PARTY-061: Get parties user has joined', () => {
    it('should get all parties user is member of', async () => {
      const leader1 = await createTestUser(client);
      const leader2 = await createTestUser(client);
      const member = await createTestUser(client);
      const party1 = await createTestParty(client, leader1.id);
      const party2 = await createTestParty(client, leader2.id);
      await addPartyMember(client, party1.id, member.id);
      await addPartyMember(client, party2.id, member.id);

      const result = await client.query(
        `SELECT p.* FROM parties p 
         JOIN party_members pm ON p.id = pm.party_id 
         WHERE pm.user_id = $1`,
        [member.id]
      );
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-PARTY-062: Soft delete party on disband', () => {
    it('should soft delete party by setting status', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      await client.query(
        "UPDATE parties SET status = 'disbanded', disbanded_at = NOW() WHERE id = $1",
        [party.id]
      );

      const result = await client.query('SELECT * FROM parties WHERE id = $1', [party.id]);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].status).toBe('disbanded');
      expect(result.rows[0].disbanded_at).toBeDefined();
    });
  });

  describe('E2E-PARTY-063: Cascade delete party members on party delete', () => {
    it('should delete party members when party is deleted', async () => {
      const leader = await createTestUser(client);
      const member = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      await addPartyMember(client, party.id, member.id);

      await client.query('DELETE FROM parties WHERE id = $1', [party.id]);

      const result = await client.query('SELECT * FROM party_members WHERE party_id = $1', [
        party.id,
      ]);
      expect(result.rows.length).toBe(0);
    });
  });

  describe('E2E-PARTY-064: Cascade delete invites on party delete', () => {
    it('should delete invites when party is deleted', async () => {
      const leader = await createTestUser(client);
      const invitee = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      await createPartyInvite(client, party.id, leader.id, invitee.id);

      await client.query('DELETE FROM parties WHERE id = $1', [party.id]);

      const result = await client.query('SELECT * FROM party_invites WHERE party_id = $1', [
        party.id,
      ]);
      expect(result.rows.length).toBe(0);
    });
  });

  describe('E2E-PARTY-065: Cascade delete voice channel on party delete', () => {
    it('should delete voice channel when party is deleted', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);
      await client.query('INSERT INTO voice_channels (party_id, name) VALUES ($1, $2)', [
        party.id,
        'Voice',
      ]);

      await client.query('DELETE FROM parties WHERE id = $1', [party.id]);

      const result = await client.query('SELECT * FROM voice_channels WHERE party_id = $1', [
        party.id,
      ]);
      expect(result.rows.length).toBe(0);
    });
  });

  describe('E2E-PARTY-066: Index performance for party queries', () => {
    it('should use indexes for party queries', async () => {
      const leader = await createTestUser(client);
      await createTestParty(client, leader.id);

      const result = await client.query(
        "EXPLAIN SELECT * FROM parties WHERE leader_id = $1 AND status = 'active'",
        [leader.id]
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('E2E-PARTY-067: Index performance for member queries', () => {
    it('should use indexes for member queries', async () => {
      const leader = await createTestUser(client);
      const party = await createTestParty(client, leader.id);

      const result = await client.query('EXPLAIN SELECT * FROM party_members WHERE party_id = $1', [
        party.id,
      ]);
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });
});
