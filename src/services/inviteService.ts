import { pool } from '../config/database';
import { redis, CACHE_KEYS, CACHE_TTL, cacheGet, cacheSet, cacheDelete } from '../config/redis';
import { PartyInvite, InviteStatus, SendInviteRequest, BulkInviteRequest } from '../types';
import { partyService } from './partyService';

export class InviteService {
  private readonly DEFAULT_EXPIRY_MINUTES = 30;

  async sendInvite(partyId: string, senderId: string, request: SendInviteRequest): Promise<PartyInvite> {
    const party = await partyService.getParty(partyId);
    if (!party) {
      throw new Error('Party not found');
    }

    const senderMember = await partyService.getPartyMember(partyId, senderId);
    if (!senderMember) {
      throw new Error('You must be a member of the party to send invites');
    }

    if (senderMember.role === 'member') {
      throw new Error('Only leaders and officers can send invites');
    }

    const recipientParty = await partyService.getUserParty(request.recipientId);
    if (recipientParty) {
      throw new Error('Recipient is already in a party');
    }

    const existingInvite = await this.getPendingInvite(partyId, request.recipientId);
    if (existingInvite) {
      throw new Error('An invite is already pending for this user');
    }

    const memberCount = await partyService.getPartyMemberCount(partyId);
    if (memberCount >= party.maxSize) {
      throw new Error('Party is full');
    }

    const expiryMinutes = request.expiresInMinutes || this.DEFAULT_EXPIRY_MINUTES;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO party_invites (party_id, sender_id, recipient_id, message, expires_at, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [partyId, senderId, request.recipientId, request.message || null, expiresAt, InviteStatus.PENDING]
    );

    const invite = this.mapInviteRow(result.rows[0]);
    await cacheDelete(CACHE_KEYS.USER_INVITES(request.recipientId));
    await this.publishInviteEvent(request.recipientId, 'invite_received', { invite });

    return invite;
  }

  async sendBulkInvites(partyId: string, senderId: string, request: BulkInviteRequest): Promise<{ sent: PartyInvite[]; failed: { recipientId: string; reason: string }[] }> {
    const sent: PartyInvite[] = [];
    const failed: { recipientId: string; reason: string }[] = [];

    for (const recipientId of request.recipientIds) {
      try {
        const invite = await this.sendInvite(partyId, senderId, {
          recipientId,
          message: request.message,
          expiresInMinutes: request.expiresInMinutes,
        });
        sent.push(invite);
      } catch (error) {
        failed.push({
          recipientId,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { sent, failed };
  }

  async acceptInvite(inviteId: string, userId: string): Promise<void> {
    const invite = await this.getInvite(inviteId);
    if (!invite) {
      throw new Error('Invite not found');
    }

    if (invite.recipientId !== userId) {
      throw new Error('This invite is not for you');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new Error(`Invite has already been ${invite.status}`);
    }

    if (new Date() > invite.expiresAt) {
      await this.updateInviteStatus(inviteId, InviteStatus.EXPIRED);
      throw new Error('Invite has expired');
    }

    const party = await partyService.getParty(invite.partyId);
    if (!party) {
      await this.updateInviteStatus(inviteId, InviteStatus.CANCELLED);
      throw new Error('Party no longer exists');
    }

    const memberCount = await partyService.getPartyMemberCount(invite.partyId);
    if (memberCount >= party.maxSize) {
      throw new Error('Party is now full');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE party_invites SET status = $1, responded_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [InviteStatus.ACCEPTED, inviteId]
      );

      await client.query(
        `INSERT INTO party_members (party_id, user_id, role, is_ready)
         VALUES ($1, $2, $3, $4)`,
        [invite.partyId, userId, 'member', false]
      );

      await client.query(
        `UPDATE party_invites SET status = $1 WHERE recipient_id = $2 AND status = $3 AND id != $4`,
        [InviteStatus.CANCELLED, userId, InviteStatus.PENDING, inviteId]
      );

      await client.query('COMMIT');

      await cacheDelete(CACHE_KEYS.USER_INVITES(userId));
      await cacheDelete(CACHE_KEYS.PARTY_MEMBERS(invite.partyId));
      await cacheSet(CACHE_KEYS.USER_PARTY(userId), invite.partyId, CACHE_TTL.USER_PARTY);

      await this.publishInviteEvent(invite.senderId, 'invite_accepted', { inviteId, recipientId: userId });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async declineInvite(inviteId: string, userId: string): Promise<void> {
    const invite = await this.getInvite(inviteId);
    if (!invite) {
      throw new Error('Invite not found');
    }

    if (invite.recipientId !== userId) {
      throw new Error('This invite is not for you');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new Error(`Invite has already been ${invite.status}`);
    }

    await this.updateInviteStatus(inviteId, InviteStatus.DECLINED);
    await cacheDelete(CACHE_KEYS.USER_INVITES(userId));

    await this.publishInviteEvent(invite.senderId, 'invite_declined', { inviteId, recipientId: userId });
  }

  async cancelInvite(inviteId: string, userId: string): Promise<void> {
    const invite = await this.getInvite(inviteId);
    if (!invite) {
      throw new Error('Invite not found');
    }

    if (invite.senderId !== userId) {
      const party = await partyService.getParty(invite.partyId);
      if (!party || party.leaderId !== userId) {
        throw new Error('Only the sender or party leader can cancel invites');
      }
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new Error(`Invite has already been ${invite.status}`);
    }

    await this.updateInviteStatus(inviteId, InviteStatus.CANCELLED);
    await cacheDelete(CACHE_KEYS.USER_INVITES(invite.recipientId));

    await this.publishInviteEvent(invite.recipientId, 'invite_cancelled', { inviteId });
  }

  async getInvite(inviteId: string): Promise<PartyInvite | null> {
    const result = await pool.query(
      'SELECT * FROM party_invites WHERE id = $1',
      [inviteId]
    );

    if (result.rows.length === 0) return null;
    return this.mapInviteRow(result.rows[0]);
  }

  async getUserInvites(userId: string): Promise<PartyInvite[]> {
    const cached = await cacheGet<PartyInvite[]>(CACHE_KEYS.USER_INVITES(userId));
    if (cached) return cached;

    const result = await pool.query(
      `SELECT * FROM party_invites 
       WHERE recipient_id = $1 AND status = $2 AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC`,
      [userId, InviteStatus.PENDING]
    );

    const invites = result.rows.map((row: Record<string, unknown>) => this.mapInviteRow(row));
    await cacheSet(CACHE_KEYS.USER_INVITES(userId), invites, CACHE_TTL.USER_INVITES);
    return invites;
  }

  async getPartyInvites(partyId: string): Promise<PartyInvite[]> {
    const result = await pool.query(
      `SELECT * FROM party_invites 
       WHERE party_id = $1 AND status = $2
       ORDER BY created_at DESC`,
      [partyId, InviteStatus.PENDING]
    );

    return result.rows.map((row: Record<string, unknown>) => this.mapInviteRow(row));
  }

  async getSentInvites(userId: string): Promise<PartyInvite[]> {
    const result = await pool.query(
      `SELECT * FROM party_invites 
       WHERE sender_id = $1 AND status = $2
       ORDER BY created_at DESC`,
      [userId, InviteStatus.PENDING]
    );

    return result.rows.map((row: Record<string, unknown>) => this.mapInviteRow(row));
  }

  async cleanupExpiredInvites(): Promise<number> {
    const result = await pool.query(
      `UPDATE party_invites 
       SET status = $1 
       WHERE status = $2 AND expires_at < CURRENT_TIMESTAMP
       RETURNING recipient_id`,
      [InviteStatus.EXPIRED, InviteStatus.PENDING]
    );

    for (const row of result.rows) {
      await cacheDelete(CACHE_KEYS.USER_INVITES(row.recipient_id));
    }

    return result.rowCount || 0;
  }

  private async getPendingInvite(partyId: string, recipientId: string): Promise<PartyInvite | null> {
    const result = await pool.query(
      `SELECT * FROM party_invites 
       WHERE party_id = $1 AND recipient_id = $2 AND status = $3 AND expires_at > CURRENT_TIMESTAMP`,
      [partyId, recipientId, InviteStatus.PENDING]
    );

    if (result.rows.length === 0) return null;
    return this.mapInviteRow(result.rows[0]);
  }

  private async updateInviteStatus(inviteId: string, status: InviteStatus): Promise<void> {
    await pool.query(
      `UPDATE party_invites SET status = $1, responded_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [status, inviteId]
    );
  }

  private async publishInviteEvent(userId: string, event: string, data: Record<string, unknown>): Promise<void> {
    await redis.publish(`user:${userId}:invites`, JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
  }

  private mapInviteRow(row: Record<string, unknown>): PartyInvite {
    return {
      id: row.id as string,
      partyId: row.party_id as string,
      senderId: row.sender_id as string,
      recipientId: row.recipient_id as string,
      status: row.status as InviteStatus,
      message: row.message as string | undefined,
      expiresAt: new Date(row.expires_at as string),
      createdAt: new Date(row.created_at as string),
      respondedAt: row.responded_at ? new Date(row.responded_at as string) : undefined,
    };
  }
}

export const inviteService = new InviteService();
