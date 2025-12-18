import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import {
  Room,
  RoomPlayer,
  RoomSettings,
  RoomEvent,
  RoomEventType,
  CreateRoomInput,
  UpdateRoomInput,
  JoinRoomInput,
  UpdatePlayerInput,
  RoomFilter,
  PaginatedResult,
  DEFAULT_ROOM_SETTINGS,
  RoomError,
  RoomNotFoundError,
  RoomFullError,
  RoomClosedError,
  PlayerNotInRoomError,
  PlayerAlreadyInRoomError,
  InvalidPasswordError,
  PlayerRole,
} from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';
import { StateSyncService } from './state-sync.service';
import { PermissionService } from './permission.service';

export class RoomService {
  private pool: Pool;
  private stateSyncService: StateSyncService;
  private permissionService: PermissionService;

  constructor(pool: Pool, stateSyncService: StateSyncService, permissionService: PermissionService) {
    this.pool = pool;
    this.stateSyncService = stateSyncService;
    this.permissionService = permissionService;
  }

  async createRoom(input: CreateRoomInput): Promise<Room> {
    const roomId = uuidv4();
    const now = new Date();

    const settings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      ...input.settings,
    };

    const capacity = Math.min(
      input.capacity || config.room.defaultCapacity,
      config.room.maxCapacity
    );

    const room: Room = {
      id: roomId,
      name: input.name,
      description: input.description,
      type: input.type,
      status: 'creating',
      visibility: input.visibility || 'public',
      ownerId: input.ownerId,
      capacity,
      currentPlayerCount: 0,
      settings,
      metadata: input.metadata,
      tags: input.tags,
      password: input.password,
      parentRoomId: input.parentRoomId,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    };

    const query = `
      INSERT INTO rooms (
        id, name, description, type, status, visibility, owner_id, capacity,
        current_player_count, settings, metadata, tags, password, parent_room_id,
        created_at, updated_at, last_activity_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;

    const values = [
      room.id,
      room.name,
      room.description,
      room.type,
      room.status,
      room.visibility,
      room.ownerId,
      room.capacity,
      room.currentPlayerCount,
      JSON.stringify(room.settings),
      JSON.stringify(room.metadata || {}),
      room.tags || [],
      room.password,
      room.parentRoomId,
      room.createdAt,
      room.updatedAt,
      room.lastActivityAt,
    ];

    try {
      await this.pool.query(query, values);
      
      await this.permissionService.initializeRoomPermissions(roomId);
      await this.stateSyncService.initializeRoomState(roomId);
      
      room.status = 'active';
      await this.updateRoomStatus(roomId, 'active');
      
      await this.recordEvent(roomId, 'room_created', undefined, { ownerId: input.ownerId });
      
      logger.info(`Room created: ${roomId}`, { roomId, name: room.name, type: room.type });
      
      return room;
    } catch (error) {
      logger.error('Failed to create room', { error, input });
      throw new RoomError('Failed to create room', 500, 'ROOM_CREATE_FAILED');
    }
  }

  async getRoomById(id: string): Promise<Room | null> {
    const query = `SELECT * FROM rooms WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToRoom(result.rows[0]);
  }

  async getRooms(filter: RoomFilter, page = 1, limit = 20): Promise<PaginatedResult<Room>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filter.type) {
      conditions.push(`type = $${paramIndex++}`);
      values.push(filter.type);
    }
    if (filter.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(filter.status);
    }
    if (filter.visibility) {
      conditions.push(`visibility = $${paramIndex++}`);
      values.push(filter.visibility);
    }
    if (filter.ownerId) {
      conditions.push(`owner_id = $${paramIndex++}`);
      values.push(filter.ownerId);
    }
    if (filter.tags && filter.tags.length > 0) {
      conditions.push(`tags && $${paramIndex++}`);
      values.push(filter.tags);
    }
    if (filter.search) {
      conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      values.push(`%${filter.search}%`);
      paramIndex++;
    }
    if (filter.hasCapacity) {
      conditions.push(`current_player_count < capacity`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const countQuery = `SELECT COUNT(*) FROM rooms ${whereClause}`;
    const countResult = await this.pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count, 10);

    const dataQuery = `
      SELECT * FROM rooms ${whereClause}
      ORDER BY last_activity_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    values.push(limit, offset);

    const dataResult = await this.pool.query(dataQuery, values);
    const rooms = dataResult.rows.map(row => this.mapRowToRoom(row));

    return {
      data: rooms,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateRoom(id: string, input: UpdateRoomInput, userId: string): Promise<Room> {
    const room = await this.getRoomById(id);
    if (!room) {
      throw new RoomNotFoundError();
    }

    await this.permissionService.checkPermission(id, userId, 'update_settings');

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.visibility !== undefined) {
      updates.push(`visibility = $${paramIndex++}`);
      values.push(input.visibility);
    }
    if (input.capacity !== undefined) {
      const newCapacity = Math.min(input.capacity, config.room.maxCapacity);
      if (newCapacity < room.currentPlayerCount) {
        throw new RoomError('Cannot reduce capacity below current player count', 400, 'INVALID_CAPACITY');
      }
      updates.push(`capacity = $${paramIndex++}`);
      values.push(newCapacity);
    }
    if (input.settings !== undefined) {
      const newSettings = { ...room.settings, ...input.settings };
      updates.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(newSettings));
    }
    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(input.metadata));
    }
    if (input.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(input.tags);
    }
    if (input.password !== undefined) {
      updates.push(`password = $${paramIndex++}`);
      values.push(input.password);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());

    values.push(id);

    const query = `
      UPDATE rooms SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    const updatedRoom = this.mapRowToRoom(result.rows[0]);

    await this.recordEvent(id, 'room_updated', userId, { changes: input });
    await this.stateSyncService.publishRoomUpdate(id, 'room_updated', { room: updatedRoom });

    logger.info(`Room updated: ${id}`, { roomId: id, changes: input });

    return updatedRoom;
  }

  async deleteRoom(id: string, userId: string): Promise<void> {
    const room = await this.getRoomById(id);
    if (!room) {
      throw new RoomNotFoundError();
    }

    await this.permissionService.checkPermission(id, userId, 'delete');

    await this.updateRoomStatus(id, 'closing');
    
    const players = await this.getRoomPlayers(id);
    for (const player of players) {
      await this.removePlayer(id, player.userId);
    }

    await this.updateRoomStatus(id, 'closed');
    
    const query = `UPDATE rooms SET closed_at = $1, updated_at = $1 WHERE id = $2`;
    await this.pool.query(query, [new Date(), id]);

    await this.recordEvent(id, 'room_closed', userId, {});
    await this.stateSyncService.publishRoomUpdate(id, 'room_closed', {});
    await this.stateSyncService.cleanupRoomState(id);

    logger.info(`Room closed: ${id}`, { roomId: id, closedBy: userId });
  }

  async joinRoom(input: JoinRoomInput): Promise<RoomPlayer> {
    const room = await this.getRoomById(input.roomId);
    if (!room) {
      throw new RoomNotFoundError();
    }

    if (room.status !== 'active') {
      throw new RoomClosedError();
    }

    if (room.password && room.password !== input.password) {
      throw new InvalidPasswordError();
    }

    const existingPlayer = await this.getPlayerInRoom(input.roomId, input.userId);
    if (existingPlayer) {
      throw new PlayerAlreadyInRoomError();
    }

    const effectiveCapacity = input.asSpectator 
      ? room.settings.maxSpectators 
      : room.capacity;
    
    const currentCount = input.asSpectator
      ? await this.getSpectatorCount(input.roomId)
      : room.currentPlayerCount;

    if (currentCount >= effectiveCapacity) {
      throw new RoomFullError();
    }

    const playerId = uuidv4();
    const now = new Date();

    const player: RoomPlayer = {
      id: playerId,
      roomId: input.roomId,
      userId: input.userId,
      username: input.username,
      role: room.ownerId === input.userId ? 'owner' : 'member',
      isSpectator: input.asSpectator || false,
      joinedAt: now,
      lastActiveAt: now,
    };

    const query = `
      INSERT INTO room_players (
        id, room_id, user_id, username, role, is_spectator, joined_at, last_active_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    await this.pool.query(query, [
      player.id,
      player.roomId,
      player.userId,
      player.username,
      player.role,
      player.isSpectator,
      player.joinedAt,
      player.lastActiveAt,
    ]);

    if (!input.asSpectator) {
      await this.incrementPlayerCount(input.roomId);
    }

    await this.updateRoomActivity(input.roomId);
    await this.recordEvent(input.roomId, 'player_joined', input.userId, { 
      username: input.username,
      isSpectator: input.asSpectator 
    });
    await this.stateSyncService.publishRoomUpdate(input.roomId, 'player_joined', { player });

    logger.info(`Player joined room: ${input.roomId}`, { 
      roomId: input.roomId, 
      userId: input.userId,
      isSpectator: input.asSpectator 
    });

    return player;
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const player = await this.getPlayerInRoom(roomId, userId);
    if (!player) {
      throw new PlayerNotInRoomError();
    }

    await this.removePlayer(roomId, userId);

    await this.recordEvent(roomId, 'player_left', userId, {});
    await this.stateSyncService.publishRoomUpdate(roomId, 'player_left', { userId });

    logger.info(`Player left room: ${roomId}`, { roomId, userId });
  }

  async kickPlayer(roomId: string, targetUserId: string, kickedBy: string): Promise<void> {
    await this.permissionService.checkPermission(roomId, kickedBy, 'kick');

    const player = await this.getPlayerInRoom(roomId, targetUserId);
    if (!player) {
      throw new PlayerNotInRoomError();
    }

    if (player.role === 'owner') {
      throw new RoomError('Cannot kick the room owner', 400, 'CANNOT_KICK_OWNER');
    }

    await this.removePlayer(roomId, targetUserId);

    await this.recordEvent(roomId, 'player_kicked', targetUserId, { kickedBy });
    await this.stateSyncService.publishRoomUpdate(roomId, 'player_kicked', { 
      userId: targetUserId, 
      kickedBy 
    });

    logger.info(`Player kicked from room: ${roomId}`, { roomId, targetUserId, kickedBy });
  }

  async updatePlayerRole(roomId: string, targetUserId: string, newRole: PlayerRole, updatedBy: string): Promise<RoomPlayer> {
    await this.permissionService.checkPermission(roomId, updatedBy, 'update_settings');

    const player = await this.getPlayerInRoom(roomId, targetUserId);
    if (!player) {
      throw new PlayerNotInRoomError();
    }

    if (player.role === 'owner' && newRole !== 'owner') {
      throw new RoomError('Cannot change owner role', 400, 'CANNOT_CHANGE_OWNER_ROLE');
    }

    const query = `
      UPDATE room_players SET role = $1, last_active_at = $2
      WHERE room_id = $3 AND user_id = $4
      RETURNING *
    `;

    const result = await this.pool.query(query, [newRole, new Date(), roomId, targetUserId]);
    const updatedPlayer = this.mapRowToPlayer(result.rows[0]);

    await this.recordEvent(roomId, 'player_role_changed', targetUserId, { 
      oldRole: player.role, 
      newRole, 
      updatedBy 
    });
    await this.stateSyncService.publishRoomUpdate(roomId, 'player_role_changed', { 
      userId: targetUserId, 
      newRole 
    });

    logger.info(`Player role updated: ${roomId}`, { roomId, targetUserId, newRole, updatedBy });

    return updatedPlayer;
  }

  async updatePlayer(roomId: string, userId: string, input: UpdatePlayerInput): Promise<RoomPlayer> {
    const player = await this.getPlayerInRoom(roomId, userId);
    if (!player) {
      throw new PlayerNotInRoomError();
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.position !== undefined) {
      updates.push(`position = $${paramIndex++}`);
      values.push(JSON.stringify(input.position));
    }
    if (input.rotation !== undefined) {
      updates.push(`rotation = $${paramIndex++}`);
      values.push(JSON.stringify(input.rotation));
    }
    if (input.customData !== undefined) {
      updates.push(`custom_data = $${paramIndex++}`);
      values.push(JSON.stringify(input.customData));
    }

    updates.push(`last_active_at = $${paramIndex++}`);
    values.push(new Date());

    values.push(roomId, userId);

    const query = `
      UPDATE room_players SET ${updates.join(', ')}
      WHERE room_id = $${paramIndex++} AND user_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    const updatedPlayer = this.mapRowToPlayer(result.rows[0]);

    await this.updateRoomActivity(roomId);

    return updatedPlayer;
  }

  async getRoomPlayers(roomId: string): Promise<RoomPlayer[]> {
    const query = `SELECT * FROM room_players WHERE room_id = $1 ORDER BY joined_at`;
    const result = await this.pool.query(query, [roomId]);
    return result.rows.map(row => this.mapRowToPlayer(row));
  }

  async getPlayerInRoom(roomId: string, userId: string): Promise<RoomPlayer | null> {
    const query = `SELECT * FROM room_players WHERE room_id = $1 AND user_id = $2`;
    const result = await this.pool.query(query, [roomId, userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToPlayer(result.rows[0]);
  }

  private async removePlayer(roomId: string, userId: string): Promise<void> {
    const player = await this.getPlayerInRoom(roomId, userId);
    if (!player) return;

    const query = `DELETE FROM room_players WHERE room_id = $1 AND user_id = $2`;
    await this.pool.query(query, [roomId, userId]);

    if (!player.isSpectator) {
      await this.decrementPlayerCount(roomId);
    }

    await this.updateRoomActivity(roomId);
  }

  private async getSpectatorCount(roomId: string): Promise<number> {
    const query = `SELECT COUNT(*) FROM room_players WHERE room_id = $1 AND is_spectator = true`;
    const result = await this.pool.query(query, [roomId]);
    return parseInt(result.rows[0].count, 10);
  }

  private async incrementPlayerCount(roomId: string): Promise<void> {
    const query = `UPDATE rooms SET current_player_count = current_player_count + 1 WHERE id = $1`;
    await this.pool.query(query, [roomId]);
  }

  private async decrementPlayerCount(roomId: string): Promise<void> {
    const query = `UPDATE rooms SET current_player_count = GREATEST(current_player_count - 1, 0) WHERE id = $1`;
    await this.pool.query(query, [roomId]);
  }

  private async updateRoomStatus(roomId: string, status: string): Promise<void> {
    const query = `UPDATE rooms SET status = $1, updated_at = $2 WHERE id = $3`;
    await this.pool.query(query, [status, new Date(), roomId]);
  }

  private async updateRoomActivity(roomId: string): Promise<void> {
    const query = `UPDATE rooms SET last_activity_at = $1 WHERE id = $2`;
    await this.pool.query(query, [new Date(), roomId]);
  }

  async recordEvent(roomId: string, type: RoomEventType, playerId?: string, data?: unknown): Promise<void> {
    const eventId = uuidv4();
    const query = `
      INSERT INTO room_events (id, room_id, type, player_id, data, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await this.pool.query(query, [eventId, roomId, type, playerId, JSON.stringify(data || {}), new Date()]);
  }

  async getRoomEvents(roomId: string, limit = 100): Promise<RoomEvent[]> {
    const query = `
      SELECT * FROM room_events 
      WHERE room_id = $1 
      ORDER BY timestamp DESC 
      LIMIT $2
    `;
    const result = await this.pool.query(query, [roomId, limit]);
    return result.rows.map(row => ({
      id: row.id,
      roomId: row.room_id,
      type: row.type,
      playerId: row.player_id,
      data: row.data,
      timestamp: row.timestamp,
    }));
  }

  private mapRowToRoom(row: Record<string, unknown>): Room {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      type: row.type as Room['type'],
      status: row.status as Room['status'],
      visibility: row.visibility as Room['visibility'],
      ownerId: row.owner_id as string,
      capacity: row.capacity as number,
      currentPlayerCount: row.current_player_count as number,
      settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings as RoomSettings,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata as Record<string, unknown>,
      tags: row.tags as string[],
      password: row.password as string | undefined,
      instanceId: row.instance_id as string | undefined,
      parentRoomId: row.parent_room_id as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      lastActivityAt: new Date(row.last_activity_at as string),
      closedAt: row.closed_at ? new Date(row.closed_at as string) : undefined,
    };
  }

  private mapRowToPlayer(row: Record<string, unknown>): RoomPlayer {
    return {
      id: row.id as string,
      roomId: row.room_id as string,
      userId: row.user_id as string,
      username: row.username as string,
      role: row.role as PlayerRole,
      isSpectator: row.is_spectator as boolean,
      position: row.position ? (typeof row.position === 'string' ? JSON.parse(row.position) : row.position) : undefined,
      rotation: row.rotation ? (typeof row.rotation === 'string' ? JSON.parse(row.rotation) : row.rotation) : undefined,
      customData: row.custom_data ? (typeof row.custom_data === 'string' ? JSON.parse(row.custom_data) : row.custom_data) : undefined,
      joinedAt: new Date(row.joined_at as string),
      lastActiveAt: new Date(row.last_active_at as string),
      disconnectedAt: row.disconnected_at ? new Date(row.disconnected_at as string) : undefined,
    };
  }
}
