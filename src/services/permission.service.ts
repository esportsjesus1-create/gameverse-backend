import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  RoomPermission,
  PlayerRole,
  PermissionAction,
  DEFAULT_PERMISSIONS,
  PermissionDeniedError,
  PlayerNotInRoomError,
} from '../types';
import { logger } from '../utils/logger';

export class PermissionService {
  private pool: Pool;
  private permissionCache: Map<string, Map<PlayerRole, Set<PermissionAction>>> = new Map();

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async initializeRoomPermissions(roomId: string): Promise<void> {
    const permissions: RoomPermission[] = [];
    const now = new Date();

    for (const [role, actions] of Object.entries(DEFAULT_PERMISSIONS)) {
      for (const action of actions) {
        permissions.push({
          id: uuidv4(),
          roomId,
          role: role as PlayerRole,
          action: action as PermissionAction,
          allowed: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const query = `
      INSERT INTO room_permissions (id, room_id, role, action, allowed, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    for (const permission of permissions) {
      await this.pool.query(query, [
        permission.id,
        permission.roomId,
        permission.role,
        permission.action,
        permission.allowed,
        permission.createdAt,
        permission.updatedAt,
      ]);
    }

    this.cacheRoomPermissions(roomId, permissions);

    logger.debug(`Room permissions initialized: ${roomId}`);
  }

  async checkPermission(roomId: string, userId: string, action: PermissionAction): Promise<boolean> {
    const playerRole = await this.getPlayerRole(roomId, userId);
    
    if (!playerRole) {
      throw new PlayerNotInRoomError();
    }

    const hasPermission = await this.roleHasPermission(roomId, playerRole, action);
    
    if (!hasPermission) {
      throw new PermissionDeniedError(action);
    }

    return true;
  }

  async hasPermission(roomId: string, userId: string, action: PermissionAction): Promise<boolean> {
    try {
      await this.checkPermission(roomId, userId, action);
      return true;
    } catch {
      return false;
    }
  }

  async roleHasPermission(roomId: string, role: PlayerRole, action: PermissionAction): Promise<boolean> {
    const cached = this.permissionCache.get(roomId);
    if (cached) {
      const rolePermissions = cached.get(role);
      if (rolePermissions) {
        return rolePermissions.has(action);
      }
    }

    const query = `
      SELECT allowed FROM room_permissions
      WHERE room_id = $1 AND role = $2 AND action = $3
    `;
    const result = await this.pool.query(query, [roomId, role, action]);

    if (result.rows.length === 0) {
      const defaultActions = DEFAULT_PERMISSIONS[role] || [];
      return defaultActions.includes(action);
    }

    return result.rows[0].allowed;
  }

  async setPermission(
    roomId: string, 
    role: PlayerRole, 
    action: PermissionAction, 
    allowed: boolean,
    updatedBy: string
  ): Promise<RoomPermission> {
    await this.checkPermission(roomId, updatedBy, 'update_settings');

    const now = new Date();
    const query = `
      INSERT INTO room_permissions (id, room_id, role, action, allowed, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (room_id, role, action) 
      DO UPDATE SET allowed = $5, updated_at = $7
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      uuidv4(),
      roomId,
      role,
      action,
      allowed,
      now,
      now,
    ]);

    const permission = this.mapRowToPermission(result.rows[0]);

    this.updatePermissionCache(roomId, role, action, allowed);

    logger.info(`Permission updated: ${roomId}`, { role, action, allowed, updatedBy });

    return permission;
  }

  async getRoomPermissions(roomId: string): Promise<RoomPermission[]> {
    const query = `SELECT * FROM room_permissions WHERE room_id = $1 ORDER BY role, action`;
    const result = await this.pool.query(query, [roomId]);
    return result.rows.map(row => this.mapRowToPermission(row));
  }

  async getRolePermissions(roomId: string, role: PlayerRole): Promise<PermissionAction[]> {
    const query = `
      SELECT action FROM room_permissions 
      WHERE room_id = $1 AND role = $2 AND allowed = true
    `;
    const result = await this.pool.query(query, [roomId, role]);
    return result.rows.map(row => row.action as PermissionAction);
  }

  async bulkSetPermissions(
    roomId: string,
    permissions: { role: PlayerRole; action: PermissionAction; allowed: boolean }[],
    updatedBy: string
  ): Promise<void> {
    await this.checkPermission(roomId, updatedBy, 'update_settings');

    const now = new Date();
    const query = `
      INSERT INTO room_permissions (id, room_id, role, action, allowed, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (room_id, role, action) 
      DO UPDATE SET allowed = $5, updated_at = $7
    `;

    for (const perm of permissions) {
      await this.pool.query(query, [
        uuidv4(),
        roomId,
        perm.role,
        perm.action,
        perm.allowed,
        now,
        now,
      ]);
      this.updatePermissionCache(roomId, perm.role, perm.action, perm.allowed);
    }

    logger.info(`Bulk permissions updated: ${roomId}`, { count: permissions.length, updatedBy });
  }

  async resetRoomPermissions(roomId: string, updatedBy: string): Promise<void> {
    await this.checkPermission(roomId, updatedBy, 'update_settings');

    const deleteQuery = `DELETE FROM room_permissions WHERE room_id = $1`;
    await this.pool.query(deleteQuery, [roomId]);

    this.permissionCache.delete(roomId);

    await this.initializeRoomPermissions(roomId);

    logger.info(`Room permissions reset: ${roomId}`, { updatedBy });
  }

  private async getPlayerRole(roomId: string, userId: string): Promise<PlayerRole | null> {
    const query = `SELECT role FROM room_players WHERE room_id = $1 AND user_id = $2`;
    const result = await this.pool.query(query, [roomId, userId]);
    
    if (result.rows.length === 0) {
      const ownerQuery = `SELECT owner_id FROM rooms WHERE id = $1`;
      const ownerResult = await this.pool.query(ownerQuery, [roomId]);
      
      if (ownerResult.rows.length > 0 && ownerResult.rows[0].owner_id === userId) {
        return 'owner';
      }
      
      return null;
    }
    
    return result.rows[0].role as PlayerRole;
  }

  private cacheRoomPermissions(roomId: string, permissions: RoomPermission[]): void {
    const roleMap = new Map<PlayerRole, Set<PermissionAction>>();

    for (const permission of permissions) {
      if (permission.allowed) {
        if (!roleMap.has(permission.role)) {
          roleMap.set(permission.role, new Set());
        }
        roleMap.get(permission.role)!.add(permission.action);
      }
    }

    this.permissionCache.set(roomId, roleMap);
  }

  private updatePermissionCache(
    roomId: string, 
    role: PlayerRole, 
    action: PermissionAction, 
    allowed: boolean
  ): void {
    let roomCache = this.permissionCache.get(roomId);
    
    if (!roomCache) {
      roomCache = new Map();
      this.permissionCache.set(roomId, roomCache);
    }

    let rolePermissions = roomCache.get(role);
    
    if (!rolePermissions) {
      rolePermissions = new Set();
      roomCache.set(role, rolePermissions);
    }

    if (allowed) {
      rolePermissions.add(action);
    } else {
      rolePermissions.delete(action);
    }
  }

  clearCache(roomId?: string): void {
    if (roomId) {
      this.permissionCache.delete(roomId);
    } else {
      this.permissionCache.clear();
    }
  }

  private mapRowToPermission(row: Record<string, unknown>): RoomPermission {
    return {
      id: row.id as string,
      roomId: row.room_id as string,
      role: row.role as PlayerRole,
      action: row.action as PermissionAction,
      allowed: row.allowed as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
