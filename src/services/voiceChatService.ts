import { pool } from '../config/database';
import { redis, CACHE_KEYS, CACHE_TTL, cacheGet, cacheSet, cacheDelete } from '../config/redis';
import { VoiceChannel, VoiceParticipant, UpdateVoiceStatusRequest } from '../types';
import { partyService } from './partyService';

export class VoiceChatService {
  async createVoiceChannel(partyId: string, userId: string, name?: string): Promise<VoiceChannel> {
    const party = await partyService.getParty(partyId);
    if (!party) {
      throw new Error('Party not found');
    }

    if (party.leaderId !== userId) {
      throw new Error('Only the party leader can create voice channels');
    }

    const existingChannel = await this.getPartyVoiceChannel(partyId);
    if (existingChannel) {
      throw new Error('Party already has a voice channel');
    }

    const channelName = name || `${party.name} Voice`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO voice_channels (party_id, name, max_participants, is_active)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [partyId, channelName, party.maxSize, true]
      );

      const channel = this.mapChannelRow(result.rows[0]);

      await client.query(
        `UPDATE parties SET voice_channel_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [channel.id, partyId]
      );

      await client.query('COMMIT');

      await cacheDelete(CACHE_KEYS.PARTY(partyId));
      await cacheSet(CACHE_KEYS.VOICE_CHANNEL(channel.id), channel, CACHE_TTL.VOICE_CHANNEL);

      await this.publishVoiceEvent(partyId, 'channel_created', { channel });

      return channel;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getVoiceChannel(channelId: string): Promise<VoiceChannel | null> {
    const cached = await cacheGet<VoiceChannel>(CACHE_KEYS.VOICE_CHANNEL(channelId));
    if (cached) return cached;

    const result = await pool.query(
      'SELECT * FROM voice_channels WHERE id = $1 AND is_active = true',
      [channelId]
    );

    if (result.rows.length === 0) return null;

    const channel = this.mapChannelRow(result.rows[0]);
    await cacheSet(CACHE_KEYS.VOICE_CHANNEL(channelId), channel, CACHE_TTL.VOICE_CHANNEL);
    return channel;
  }

  async getPartyVoiceChannel(partyId: string): Promise<VoiceChannel | null> {
    const result = await pool.query(
      'SELECT * FROM voice_channels WHERE party_id = $1 AND is_active = true',
      [partyId]
    );

    if (result.rows.length === 0) return null;
    return this.mapChannelRow(result.rows[0]);
  }

  async joinVoiceChannel(channelId: string, userId: string): Promise<VoiceParticipant> {
    const channel = await this.getVoiceChannel(channelId);
    if (!channel) {
      throw new Error('Voice channel not found');
    }

    const member = await partyService.getPartyMember(channel.partyId, userId);
    if (!member) {
      throw new Error('You must be a member of the party to join the voice channel');
    }

    const existingParticipant = await this.getParticipant(channelId, userId);
    if (existingParticipant) {
      return existingParticipant;
    }

    const participantCount = await this.getParticipantCount(channelId);
    if (participantCount >= channel.maxParticipants) {
      throw new Error('Voice channel is full');
    }

    const result = await pool.query(
      `INSERT INTO voice_participants (channel_id, user_id, is_muted, is_deafened, is_speaking)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [channelId, userId, false, false, false]
    );

    const participant = this.mapParticipantRow(result.rows[0]);
    await cacheDelete(CACHE_KEYS.VOICE_PARTICIPANTS(channelId));

    await this.publishVoiceEvent(channel.partyId, 'user_joined_voice', { userId, channelId });

    return participant;
  }

  async leaveVoiceChannel(channelId: string, userId: string): Promise<void> {
    const channel = await this.getVoiceChannel(channelId);
    if (!channel) {
      throw new Error('Voice channel not found');
    }

    const participant = await this.getParticipant(channelId, userId);
    if (!participant) {
      throw new Error('You are not in this voice channel');
    }

    await pool.query(
      'DELETE FROM voice_participants WHERE channel_id = $1 AND user_id = $2',
      [channelId, userId]
    );

    await cacheDelete(CACHE_KEYS.VOICE_PARTICIPANTS(channelId));

    await this.publishVoiceEvent(channel.partyId, 'user_left_voice', { userId, channelId });
  }

  async updateVoiceStatus(channelId: string, userId: string, request: UpdateVoiceStatusRequest): Promise<VoiceParticipant> {
    const participant = await this.getParticipant(channelId, userId);
    if (!participant) {
      throw new Error('You are not in this voice channel');
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (request.isMuted !== undefined) {
      updates.push(`is_muted = $${paramIndex++}`);
      values.push(request.isMuted);
    }
    if (request.isDeafened !== undefined) {
      updates.push(`is_deafened = $${paramIndex++}`);
      values.push(request.isDeafened);
    }

    if (updates.length === 0) {
      return participant;
    }

    values.push(channelId, userId);

    const result = await pool.query(
      `UPDATE voice_participants SET ${updates.join(', ')} 
       WHERE channel_id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING *`,
      values
    );

    const updatedParticipant = this.mapParticipantRow(result.rows[0]);
    await cacheDelete(CACHE_KEYS.VOICE_PARTICIPANTS(channelId));

    const channel = await this.getVoiceChannel(channelId);
    if (channel) {
      await this.publishVoiceEvent(channel.partyId, 'voice_status_updated', {
        userId,
        channelId,
        isMuted: updatedParticipant.isMuted,
        isDeafened: updatedParticipant.isDeafened,
      });
    }

    return updatedParticipant;
  }

  async setSpeakingStatus(channelId: string, userId: string, isSpeaking: boolean): Promise<void> {
    const participant = await this.getParticipant(channelId, userId);
    if (!participant) {
      return;
    }

    await pool.query(
      'UPDATE voice_participants SET is_speaking = $1 WHERE channel_id = $2 AND user_id = $3',
      [isSpeaking, channelId, userId]
    );

    await cacheDelete(CACHE_KEYS.VOICE_PARTICIPANTS(channelId));

    const channel = await this.getVoiceChannel(channelId);
    if (channel) {
      await this.publishVoiceEvent(channel.partyId, 'speaking_status_changed', { userId, channelId, isSpeaking });
    }
  }

  async getChannelParticipants(channelId: string): Promise<VoiceParticipant[]> {
    const cached = await cacheGet<VoiceParticipant[]>(CACHE_KEYS.VOICE_PARTICIPANTS(channelId));
    if (cached) return cached;

    const result = await pool.query(
      'SELECT * FROM voice_participants WHERE channel_id = $1 ORDER BY joined_at ASC',
      [channelId]
    );

    const participants = result.rows.map((row: Record<string, unknown>) => this.mapParticipantRow(row));
    await cacheSet(CACHE_KEYS.VOICE_PARTICIPANTS(channelId), participants, CACHE_TTL.VOICE_PARTICIPANTS);
    return participants;
  }

  async getParticipant(channelId: string, userId: string): Promise<VoiceParticipant | null> {
    const result = await pool.query(
      'SELECT * FROM voice_participants WHERE channel_id = $1 AND user_id = $2',
      [channelId, userId]
    );

    if (result.rows.length === 0) return null;
    return this.mapParticipantRow(result.rows[0]);
  }

  async getParticipantCount(channelId: string): Promise<number> {
    const result = await pool.query(
      'SELECT COUNT(*) FROM voice_participants WHERE channel_id = $1',
      [channelId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  async muteParticipant(channelId: string, moderatorId: string, targetUserId: string): Promise<void> {
    const channel = await this.getVoiceChannel(channelId);
    if (!channel) {
      throw new Error('Voice channel not found');
    }

    const moderatorMember = await partyService.getPartyMember(channel.partyId, moderatorId);
    if (!moderatorMember || (moderatorMember.role !== 'leader' && moderatorMember.role !== 'officer')) {
      throw new Error('Only leaders and officers can mute participants');
    }

    const targetParticipant = await this.getParticipant(channelId, targetUserId);
    if (!targetParticipant) {
      throw new Error('Target user is not in the voice channel');
    }

    await pool.query(
      'UPDATE voice_participants SET is_muted = true WHERE channel_id = $1 AND user_id = $2',
      [channelId, targetUserId]
    );

    await cacheDelete(CACHE_KEYS.VOICE_PARTICIPANTS(channelId));

    await this.publishVoiceEvent(channel.partyId, 'user_muted', { userId: targetUserId, mutedBy: moderatorId });
  }

  async unmuteParticipant(channelId: string, moderatorId: string, targetUserId: string): Promise<void> {
    const channel = await this.getVoiceChannel(channelId);
    if (!channel) {
      throw new Error('Voice channel not found');
    }

    const moderatorMember = await partyService.getPartyMember(channel.partyId, moderatorId);
    if (!moderatorMember || (moderatorMember.role !== 'leader' && moderatorMember.role !== 'officer')) {
      throw new Error('Only leaders and officers can unmute participants');
    }

    const targetParticipant = await this.getParticipant(channelId, targetUserId);
    if (!targetParticipant) {
      throw new Error('Target user is not in the voice channel');
    }

    await pool.query(
      'UPDATE voice_participants SET is_muted = false WHERE channel_id = $1 AND user_id = $2',
      [channelId, targetUserId]
    );

    await cacheDelete(CACHE_KEYS.VOICE_PARTICIPANTS(channelId));

    await this.publishVoiceEvent(channel.partyId, 'user_unmuted', { userId: targetUserId, unmutedBy: moderatorId });
  }

  async deleteVoiceChannel(channelId: string, userId: string): Promise<void> {
    const channel = await this.getVoiceChannel(channelId);
    if (!channel) {
      throw new Error('Voice channel not found');
    }

    const party = await partyService.getParty(channel.partyId);
    if (!party || party.leaderId !== userId) {
      throw new Error('Only the party leader can delete the voice channel');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query('DELETE FROM voice_participants WHERE channel_id = $1', [channelId]);
      await client.query('UPDATE voice_channels SET is_active = false WHERE id = $1', [channelId]);
      await client.query(
        'UPDATE parties SET voice_channel_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [channel.partyId]
      );

      await client.query('COMMIT');

      await cacheDelete(CACHE_KEYS.VOICE_CHANNEL(channelId));
      await cacheDelete(CACHE_KEYS.VOICE_PARTICIPANTS(channelId));
      await cacheDelete(CACHE_KEYS.PARTY(channel.partyId));

      await this.publishVoiceEvent(channel.partyId, 'channel_deleted', { channelId });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserVoiceStatus(userId: string): Promise<{ channel: VoiceChannel; participant: VoiceParticipant } | null> {
    const result = await pool.query(
      `SELECT vp.*, vc.id as channel_id, vc.party_id, vc.name as channel_name, 
              vc.max_participants, vc.is_active, vc.created_at as channel_created_at
       FROM voice_participants vp
       JOIN voice_channels vc ON vp.channel_id = vc.id
       WHERE vp.user_id = $1 AND vc.is_active = true`,
      [userId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      channel: {
        id: row.channel_id,
        partyId: row.party_id,
        name: row.channel_name,
        maxParticipants: row.max_participants,
        isActive: row.is_active,
        createdAt: new Date(row.channel_created_at),
      },
      participant: this.mapParticipantRow(row),
    };
  }

  private async publishVoiceEvent(partyId: string, event: string, data: Record<string, unknown>): Promise<void> {
    await redis.publish(`party:${partyId}:voice`, JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
  }

  private mapChannelRow(row: Record<string, unknown>): VoiceChannel {
    return {
      id: row.id as string,
      partyId: row.party_id as string,
      name: row.name as string,
      maxParticipants: row.max_participants as number,
      isActive: row.is_active as boolean,
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapParticipantRow(row: Record<string, unknown>): VoiceParticipant {
    return {
      id: row.id as string,
      channelId: row.channel_id as string,
      userId: row.user_id as string,
      isMuted: row.is_muted as boolean,
      isDeafened: row.is_deafened as boolean,
      isSpeaking: row.is_speaking as boolean,
      joinedAt: new Date(row.joined_at as string),
    };
  }
}

export const voiceChatService = new VoiceChatService();
