import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  Room,
  RoomInstance,
  RoomStatus,
} from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';
import { RoomService } from './room.service';
import { StateSyncService } from './state-sync.service';

export class LifecycleService {
  private pool: Pool;
  private roomService: RoomService;
  private stateSyncService: StateSyncService;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private instances: Map<string, RoomInstance> = new Map();

  constructor(pool: Pool, roomService: RoomService, stateSyncService: StateSyncService) {
    this.pool = pool;
    this.roomService = roomService;
    this.stateSyncService = stateSyncService;
  }

  start(): void {
    this.cleanupInterval = setInterval(
      () => this.performCleanup(),
      config.room.cleanupIntervalMs
    );
    logger.info('Lifecycle service started', { 
      cleanupIntervalMs: config.room.cleanupIntervalMs,
      idleTimeoutMs: config.room.idleTimeoutMs 
    });
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    logger.info('Lifecycle service stopped');
  }

  async createInstance(roomId: string, serverId: string, region: string): Promise<RoomInstance> {
    const room = await this.roomService.getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const instanceId = uuidv4();
    const now = new Date();

    const instance: RoomInstance = {
      id: instanceId,
      roomId,
      serverId,
      region,
      status: 'starting',
      connectionUrl: `wss://${region}.gameverse.io/rooms/${roomId}`,
      playerCount: 0,
      maxPlayers: room.capacity,
      startedAt: now,
      metadata: {},
    };

    const query = `
      INSERT INTO room_instances (
        id, room_id, server_id, region, status, connection_url, 
        player_count, max_players, started_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    await this.pool.query(query, [
      instance.id,
      instance.roomId,
      instance.serverId,
      instance.region,
      instance.status,
      instance.connectionUrl,
      instance.playerCount,
      instance.maxPlayers,
      instance.startedAt,
      JSON.stringify(instance.metadata || {}),
    ]);

    await this.updateRoomInstance(roomId, instanceId);

    instance.status = 'running';
    await this.updateInstanceStatus(instanceId, 'running');

    this.instances.set(instanceId, instance);

    await this.roomService.recordEvent(roomId, 'instance_started', undefined, { 
      instanceId, 
      serverId, 
      region 
    });
    await this.stateSyncService.publishRoomUpdate(roomId, 'instance_started', { instance });

    logger.info(`Instance created: ${instanceId}`, { roomId, serverId, region });

    return instance;
  }

  async getInstance(instanceId: string): Promise<RoomInstance | null> {
    const cached = this.instances.get(instanceId);
    if (cached) {
      return cached;
    }

    const query = `SELECT * FROM room_instances WHERE id = $1`;
    const result = await this.pool.query(query, [instanceId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToInstance(result.rows[0]);
  }

  async getInstanceByRoom(roomId: string): Promise<RoomInstance | null> {
    const query = `SELECT * FROM room_instances WHERE room_id = $1 AND status = 'running'`;
    const result = await this.pool.query(query, [roomId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToInstance(result.rows[0]);
  }

  async stopInstance(instanceId: string): Promise<void> {
    const instance = await this.getInstance(instanceId);
    if (!instance) {
      throw new Error('Instance not found');
    }

    await this.updateInstanceStatus(instanceId, 'stopping');

    const now = new Date();
    const query = `
      UPDATE room_instances 
      SET status = 'stopped', stopped_at = $1 
      WHERE id = $2
    `;
    await this.pool.query(query, [now, instanceId]);

    this.instances.delete(instanceId);

    await this.roomService.recordEvent(instance.roomId, 'instance_stopped', undefined, { instanceId });
    await this.stateSyncService.publishRoomUpdate(instance.roomId, 'instance_stopped', { instanceId });

    logger.info(`Instance stopped: ${instanceId}`, { roomId: instance.roomId });
  }

  async updateInstancePlayerCount(instanceId: string, count: number): Promise<void> {
    const query = `UPDATE room_instances SET player_count = $1 WHERE id = $2`;
    await this.pool.query(query, [count, instanceId]);

    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.playerCount = count;
    }
  }

  async getActiveInstances(): Promise<RoomInstance[]> {
    const query = `SELECT * FROM room_instances WHERE status = 'running' ORDER BY started_at DESC`;
    const result = await this.pool.query(query);
    return result.rows.map(row => this.mapRowToInstance(row));
  }

  async getInstancesByServer(serverId: string): Promise<RoomInstance[]> {
    const query = `SELECT * FROM room_instances WHERE server_id = $1 AND status = 'running'`;
    const result = await this.pool.query(query, [serverId]);
    return result.rows.map(row => this.mapRowToInstance(row));
  }

  async pauseRoom(roomId: string, userId: string): Promise<Room> {
    const room = await this.roomService.getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'active') {
      throw new Error('Room is not active');
    }

    await this.updateRoomStatus(roomId, 'paused');
    
    const updatedRoom = await this.roomService.getRoomById(roomId);
    
    await this.roomService.recordEvent(roomId, 'room_updated', userId, { status: 'paused' });
    await this.stateSyncService.publishRoomUpdate(roomId, 'room_paused', {});

    logger.info(`Room paused: ${roomId}`, { pausedBy: userId });

    return updatedRoom!;
  }

  async resumeRoom(roomId: string, userId: string): Promise<Room> {
    const room = await this.roomService.getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'paused') {
      throw new Error('Room is not paused');
    }

    await this.updateRoomStatus(roomId, 'active');
    
    const updatedRoom = await this.roomService.getRoomById(roomId);
    
    await this.roomService.recordEvent(roomId, 'room_updated', userId, { status: 'active' });
    await this.stateSyncService.publishRoomUpdate(roomId, 'room_resumed', {});

    logger.info(`Room resumed: ${roomId}`, { resumedBy: userId });

    return updatedRoom!;
  }

  async archiveRoom(roomId: string, userId: string): Promise<void> {
    const room = await this.roomService.getRoomById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'closed') {
      throw new Error('Room must be closed before archiving');
    }

    await this.updateRoomStatus(roomId, 'archived');
    
    await this.roomService.recordEvent(roomId, 'room_archived', userId, {});

    logger.info(`Room archived: ${roomId}`, { archivedBy: userId });
  }

  private async performCleanup(): Promise<void> {
    try {
      const idleThreshold = new Date(Date.now() - config.room.idleTimeoutMs);

      const query = `
        SELECT id, owner_id FROM rooms 
        WHERE status = 'active' 
        AND settings->>'autoClose' = 'true'
        AND last_activity_at < $1
        AND current_player_count = 0
      `;
      const result = await this.pool.query(query, [idleThreshold]);

      for (const row of result.rows) {
        try {
          await this.roomService.deleteRoom(row.id, row.owner_id);
          logger.info(`Idle room cleaned up: ${row.id}`);
        } catch (error) {
          logger.error(`Failed to cleanup room: ${row.id}`, { error });
        }
      }

      const staleInstanceQuery = `
        SELECT id FROM room_instances 
        WHERE status = 'running' 
        AND started_at < $1
        AND player_count = 0
      `;
      const staleInstances = await this.pool.query(staleInstanceQuery, [idleThreshold]);

      for (const row of staleInstances.rows) {
        try {
          await this.stopInstance(row.id);
          logger.info(`Stale instance cleaned up: ${row.id}`);
        } catch (error) {
          logger.error(`Failed to cleanup instance: ${row.id}`, { error });
        }
      }

      if (result.rows.length > 0 || staleInstances.rows.length > 0) {
        logger.info('Cleanup completed', { 
          roomsCleaned: result.rows.length,
          instancesCleaned: staleInstances.rows.length 
        });
      }
    } catch (error) {
      logger.error('Cleanup failed', { error });
    }
  }

  private async updateRoomStatus(roomId: string, status: RoomStatus): Promise<void> {
    const query = `UPDATE rooms SET status = $1, updated_at = $2 WHERE id = $3`;
    await this.pool.query(query, [status, new Date(), roomId]);
  }

  private async updateRoomInstance(roomId: string, instanceId: string): Promise<void> {
    const query = `UPDATE rooms SET instance_id = $1, updated_at = $2 WHERE id = $3`;
    await this.pool.query(query, [instanceId, new Date(), roomId]);
  }

  private async updateInstanceStatus(instanceId: string, status: string): Promise<void> {
    const query = `UPDATE room_instances SET status = $1 WHERE id = $2`;
    await this.pool.query(query, [status, instanceId]);

    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.status = status as RoomInstance['status'];
    }
  }

  private mapRowToInstance(row: Record<string, unknown>): RoomInstance {
    return {
      id: row.id as string,
      roomId: row.room_id as string,
      serverId: row.server_id as string,
      region: row.region as string,
      status: row.status as RoomInstance['status'],
      connectionUrl: row.connection_url as string,
      playerCount: row.player_count as number,
      maxPlayers: row.max_players as number,
      startedAt: new Date(row.started_at as string),
      stoppedAt: row.stopped_at ? new Date(row.stopped_at as string) : undefined,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata as Record<string, unknown>,
    };
  }
}
