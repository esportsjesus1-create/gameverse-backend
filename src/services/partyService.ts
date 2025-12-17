import { pool } from '../config/database';
import { redis, CACHE_KEYS, CACHE_TTL, cacheGet, cacheSet, cacheDelete, cacheDeletePattern } from '../config/redis';
import {
  Party,
  PartyMember,
  PartyStatus,
  PartyRole,
  CreatePartyRequest,
  UpdatePartyRequest,
} from '../types';

export class PartyService {
  async createParty(leaderId: string, request: CreatePartyRequest): Promise<Party> {
    const existingParty = await this.getUserParty(leaderId);
    if (existingParty) {
      throw new Error('User is already in a party');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const partyResult = await client.query(
        `INSERT INTO parties (name, leader_id, max_size, is_private, game_mode, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          request.name,
          leaderId,
          request.maxSize || 4,
          request.isPrivate || false,
          request.gameMode || null,
          PartyStatus.ACTIVE,
        ]
      );

      const party = this.mapPartyRow(partyResult.rows[0]);

      await client.query(
        `INSERT INTO party_members (party_id, user_id, role, is_ready)
         VALUES ($1, $2, $3, $4)`,
        [party.id, leaderId, PartyRole.LEADER, false]
      );

      await client.query('COMMIT');

      await cacheSet(CACHE_KEYS.PARTY(party.id), party, CACHE_TTL.PARTY);
      await cacheSet(CACHE_KEYS.USER_PARTY(leaderId), party.id, CACHE_TTL.USER_PARTY);

      return party;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getParty(partyId: string): Promise<Party | null> {
    const cached = await cacheGet<Party>(CACHE_KEYS.PARTY(partyId));
    if (cached) return cached;

    const result = await pool.query(
      'SELECT * FROM parties WHERE id = $1 AND status != $2',
      [partyId, PartyStatus.DISBANDED]
    );

    if (result.rows.length === 0) return null;

    const party = this.mapPartyRow(result.rows[0]);
    await cacheSet(CACHE_KEYS.PARTY(partyId), party, CACHE_TTL.PARTY);
    return party;
  }

  async getUserParty(userId: string): Promise<Party | null> {
    const cachedPartyId = await cacheGet<string>(CACHE_KEYS.USER_PARTY(userId));
    if (cachedPartyId) {
      return this.getParty(cachedPartyId);
    }

    const result = await pool.query(
      `SELECT p.* FROM parties p
       JOIN party_members pm ON p.id = pm.party_id
       WHERE pm.user_id = $1 AND p.status != $2`,
      [userId, PartyStatus.DISBANDED]
    );

    if (result.rows.length === 0) return null;

    const party = this.mapPartyRow(result.rows[0]);
    await cacheSet(CACHE_KEYS.USER_PARTY(userId), party.id, CACHE_TTL.USER_PARTY);
    return party;
  }

  async updateParty(partyId: string, userId: string, request: UpdatePartyRequest): Promise<Party> {
    const party = await this.getParty(partyId);
    if (!party) {
      throw new Error('Party not found');
    }

    if (party.leaderId !== userId) {
      throw new Error('Only the party leader can update party settings');
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (request.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(request.name);
    }
    if (request.maxSize !== undefined) {
      const memberCount = await this.getPartyMemberCount(partyId);
      if (request.maxSize < memberCount) {
        throw new Error('Cannot set max size below current member count');
      }
      updates.push(`max_size = $${paramIndex++}`);
      values.push(request.maxSize);
    }
    if (request.isPrivate !== undefined) {
      updates.push(`is_private = $${paramIndex++}`);
      values.push(request.isPrivate);
    }
    if (request.gameMode !== undefined) {
      updates.push(`game_mode = $${paramIndex++}`);
      values.push(request.gameMode);
    }

    if (updates.length === 0) {
      return party;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(partyId);

    const result = await pool.query(
      `UPDATE parties SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    const updatedParty = this.mapPartyRow(result.rows[0]);
    await cacheSet(CACHE_KEYS.PARTY(partyId), updatedParty, CACHE_TTL.PARTY);
    return updatedParty;
  }

  async joinParty(partyId: string, userId: string): Promise<PartyMember> {
    const existingParty = await this.getUserParty(userId);
    if (existingParty) {
      throw new Error('User is already in a party');
    }

    const party = await this.getParty(partyId);
    if (!party) {
      throw new Error('Party not found');
    }

    if (party.isPrivate) {
      throw new Error('Cannot join a private party without an invite');
    }

    const memberCount = await this.getPartyMemberCount(partyId);
    if (memberCount >= party.maxSize) {
      throw new Error('Party is full');
    }

    const result = await pool.query(
      `INSERT INTO party_members (party_id, user_id, role, is_ready)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [partyId, userId, PartyRole.MEMBER, false]
    );

    const member = this.mapMemberRow(result.rows[0]);
    await cacheDelete(CACHE_KEYS.PARTY_MEMBERS(partyId));
    await cacheSet(CACHE_KEYS.USER_PARTY(userId), partyId, CACHE_TTL.USER_PARTY);

    await this.publishPartyEvent(partyId, 'member_joined', { userId });

    return member;
  }

  async leaveParty(partyId: string, userId: string): Promise<void> {
    const party = await this.getParty(partyId);
    if (!party) {
      throw new Error('Party not found');
    }

    const member = await this.getPartyMember(partyId, userId);
    if (!member) {
      throw new Error('User is not a member of this party');
    }

    if (party.leaderId === userId) {
      const members = await this.getPartyMembers(partyId);
      const otherMembers = members.filter(m => m.userId !== userId);

      if (otherMembers.length > 0) {
        const newLeader = otherMembers.find(m => m.role === PartyRole.OFFICER) || otherMembers[0];
        await this.transferLeadership(partyId, userId, newLeader.userId);
      } else {
        await this.disbandParty(partyId, userId);
        return;
      }
    }

    await pool.query(
      'DELETE FROM party_members WHERE party_id = $1 AND user_id = $2',
      [partyId, userId]
    );

    await cacheDelete(CACHE_KEYS.PARTY_MEMBERS(partyId));
    await cacheDelete(CACHE_KEYS.USER_PARTY(userId));

    await this.publishPartyEvent(partyId, 'member_left', { userId });
  }

  async disbandParty(partyId: string, userId: string): Promise<void> {
    const party = await this.getParty(partyId);
    if (!party) {
      throw new Error('Party not found');
    }

    if (party.leaderId !== userId) {
      throw new Error('Only the party leader can disband the party');
    }

    const members = await this.getPartyMembers(partyId);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE parties SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [PartyStatus.DISBANDED, partyId]
      );

      await client.query('DELETE FROM party_members WHERE party_id = $1', [partyId]);
      await client.query('DELETE FROM party_invites WHERE party_id = $1', [partyId]);
      await client.query('DELETE FROM voice_channels WHERE party_id = $1', [partyId]);

      await client.query('COMMIT');

      await cacheDelete(CACHE_KEYS.PARTY(partyId));
      await cacheDelete(CACHE_KEYS.PARTY_MEMBERS(partyId));
      await cacheDeletePattern(`party:${partyId}:*`);

      for (const member of members) {
        await cacheDelete(CACHE_KEYS.USER_PARTY(member.userId));
      }

      await this.publishPartyEvent(partyId, 'party_disbanded', {});
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async transferLeadership(partyId: string, currentLeaderId: string, newLeaderId: string): Promise<void> {
    const party = await this.getParty(partyId);
    if (!party) {
      throw new Error('Party not found');
    }

    if (party.leaderId !== currentLeaderId) {
      throw new Error('Only the current leader can transfer leadership');
    }

    const newLeaderMember = await this.getPartyMember(partyId, newLeaderId);
    if (!newLeaderMember) {
      throw new Error('New leader must be a member of the party');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE parties SET leader_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newLeaderId, partyId]
      );

      await client.query(
        `UPDATE party_members SET role = $1 WHERE party_id = $2 AND user_id = $3`,
        [PartyRole.MEMBER, partyId, currentLeaderId]
      );

      await client.query(
        `UPDATE party_members SET role = $1 WHERE party_id = $2 AND user_id = $3`,
        [PartyRole.LEADER, partyId, newLeaderId]
      );

      await client.query('COMMIT');

      await cacheDelete(CACHE_KEYS.PARTY(partyId));
      await cacheDelete(CACHE_KEYS.PARTY_MEMBERS(partyId));

      await this.publishPartyEvent(partyId, 'leadership_transferred', {
        previousLeaderId: currentLeaderId,
        newLeaderId,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async promoteToOfficer(partyId: string, leaderId: string, memberId: string): Promise<void> {
    const party = await this.getParty(partyId);
    if (!party) {
      throw new Error('Party not found');
    }

    if (party.leaderId !== leaderId) {
      throw new Error('Only the party leader can promote members');
    }

    const member = await this.getPartyMember(partyId, memberId);
    if (!member) {
      throw new Error('User is not a member of this party');
    }

    if (member.role === PartyRole.LEADER) {
      throw new Error('Cannot change the role of the party leader');
    }

    await pool.query(
      `UPDATE party_members SET role = $1 WHERE party_id = $2 AND user_id = $3`,
      [PartyRole.OFFICER, partyId, memberId]
    );

    await cacheDelete(CACHE_KEYS.PARTY_MEMBERS(partyId));
    await this.publishPartyEvent(partyId, 'member_promoted', { userId: memberId, role: PartyRole.OFFICER });
  }

  async demoteToMember(partyId: string, leaderId: string, memberId: string): Promise<void> {
    const party = await this.getParty(partyId);
    if (!party) {
      throw new Error('Party not found');
    }

    if (party.leaderId !== leaderId) {
      throw new Error('Only the party leader can demote members');
    }

    const member = await this.getPartyMember(partyId, memberId);
    if (!member) {
      throw new Error('User is not a member of this party');
    }

    if (member.role === PartyRole.LEADER) {
      throw new Error('Cannot demote the party leader');
    }

    await pool.query(
      `UPDATE party_members SET role = $1 WHERE party_id = $2 AND user_id = $3`,
      [PartyRole.MEMBER, partyId, memberId]
    );

    await cacheDelete(CACHE_KEYS.PARTY_MEMBERS(partyId));
    await this.publishPartyEvent(partyId, 'member_demoted', { userId: memberId, role: PartyRole.MEMBER });
  }

  async kickMember(partyId: string, kickerId: string, memberId: string): Promise<void> {
    const party = await this.getParty(partyId);
    if (!party) {
      throw new Error('Party not found');
    }

    const kickerMember = await this.getPartyMember(partyId, kickerId);
    if (!kickerMember || (kickerMember.role !== PartyRole.LEADER && kickerMember.role !== PartyRole.OFFICER)) {
      throw new Error('Only leaders and officers can kick members');
    }

    const targetMember = await this.getPartyMember(partyId, memberId);
    if (!targetMember) {
      throw new Error('User is not a member of this party');
    }

    if (targetMember.role === PartyRole.LEADER) {
      throw new Error('Cannot kick the party leader');
    }

    if (kickerMember.role === PartyRole.OFFICER && targetMember.role === PartyRole.OFFICER) {
      throw new Error('Officers cannot kick other officers');
    }

    await pool.query(
      'DELETE FROM party_members WHERE party_id = $1 AND user_id = $2',
      [partyId, memberId]
    );

    await cacheDelete(CACHE_KEYS.PARTY_MEMBERS(partyId));
    await cacheDelete(CACHE_KEYS.USER_PARTY(memberId));

    await this.publishPartyEvent(partyId, 'member_kicked', { userId: memberId, kickedBy: kickerId });
  }

  async setReadyStatus(partyId: string, userId: string, isReady: boolean): Promise<void> {
    const member = await this.getPartyMember(partyId, userId);
    if (!member) {
      throw new Error('User is not a member of this party');
    }

    await pool.query(
      `UPDATE party_members SET is_ready = $1 WHERE party_id = $2 AND user_id = $3`,
      [isReady, partyId, userId]
    );

    await cacheDelete(CACHE_KEYS.PARTY_MEMBERS(partyId));
    await this.publishPartyEvent(partyId, 'ready_status_changed', { userId, isReady });
  }

  async updatePartyStatus(partyId: string, userId: string, status: PartyStatus): Promise<void> {
    const party = await this.getParty(partyId);
    if (!party) {
      throw new Error('Party not found');
    }

    if (party.leaderId !== userId) {
      throw new Error('Only the party leader can update party status');
    }

    await pool.query(
      `UPDATE parties SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [status, partyId]
    );

    await cacheDelete(CACHE_KEYS.PARTY(partyId));
    await this.publishPartyEvent(partyId, 'status_changed', { status });
  }

  async getPartyMembers(partyId: string): Promise<PartyMember[]> {
    const cached = await cacheGet<PartyMember[]>(CACHE_KEYS.PARTY_MEMBERS(partyId));
    if (cached) return cached;

    const result = await pool.query(
      'SELECT * FROM party_members WHERE party_id = $1 ORDER BY joined_at ASC',
      [partyId]
    );

    const members = result.rows.map((row: Record<string, unknown>) => this.mapMemberRow(row));
    await cacheSet(CACHE_KEYS.PARTY_MEMBERS(partyId), members, CACHE_TTL.PARTY_MEMBERS);
    return members;
  }

  async getPartyMember(partyId: string, userId: string): Promise<PartyMember | null> {
    const result = await pool.query(
      'SELECT * FROM party_members WHERE party_id = $1 AND user_id = $2',
      [partyId, userId]
    );

    if (result.rows.length === 0) return null;
    return this.mapMemberRow(result.rows[0]);
  }

  async getPartyMemberCount(partyId: string): Promise<number> {
    const result = await pool.query(
      'SELECT COUNT(*) FROM party_members WHERE party_id = $1',
      [partyId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  async getPublicParties(limit: number = 20, offset: number = 0): Promise<{ parties: Party[]; total: number }> {
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM parties WHERE is_private = false AND status = $1',
      [PartyStatus.ACTIVE]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT p.*, 
              (SELECT COUNT(*) FROM party_members WHERE party_id = p.id) as member_count
       FROM parties p
       WHERE p.is_private = false AND p.status = $1
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [PartyStatus.ACTIVE, limit, offset]
    );

    const parties = result.rows.map((row: Record<string, unknown>) => this.mapPartyRow(row));
    return { parties, total };
  }

  private async publishPartyEvent(partyId: string, event: string, data: Record<string, unknown>): Promise<void> {
    await redis.publish(`party:${partyId}:events`, JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
  }

  private mapPartyRow(row: Record<string, unknown>): Party {
    return {
      id: row.id as string,
      name: row.name as string,
      leaderId: row.leader_id as string,
      maxSize: row.max_size as number,
      isPrivate: row.is_private as boolean,
      status: row.status as PartyStatus,
      voiceChannelId: row.voice_channel_id as string | undefined,
      gameMode: row.game_mode as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapMemberRow(row: Record<string, unknown>): PartyMember {
    return {
      id: row.id as string,
      partyId: row.party_id as string,
      userId: row.user_id as string,
      role: row.role as PartyRole,
      joinedAt: new Date(row.joined_at as string),
      isReady: row.is_ready as boolean,
      isMuted: row.is_muted as boolean,
    };
  }
}

export const partyService = new PartyService();
