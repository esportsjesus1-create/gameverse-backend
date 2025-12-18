import { Pool } from 'pg';
import { PermissionService } from '../services/permission.service';
import {
  PlayerRole,
  PermissionAction,
  DEFAULT_PERMISSIONS,
} from '../types';

const mockPool = {
  query: jest.fn(),
} as unknown as Pool;

describe('PermissionService', () => {
  let permissionService: PermissionService;

  beforeEach(() => {
    jest.clearAllMocks();
    permissionService = new PermissionService(mockPool);
  });

  describe('initializeRoomPermissions', () => {
    it('should initialize default permissions for room', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await permissionService.initializeRoomPermissions('room-123');

      const totalPermissions = Object.values(DEFAULT_PERMISSIONS).reduce(
        (sum, actions) => sum + actions.length,
        0
      );

      expect(mockPool.query).toHaveBeenCalledTimes(totalPermissions);
    });
  });

  describe('checkPermission', () => {
    it('should return true when user has permission', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [{ allowed: true }] });

      const result = await permissionService.checkPermission('room-123', 'user-123', 'kick');

      expect(result).toBe(true);
    });

    it('should throw PlayerNotInRoomError when user not in room', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(
        permissionService.checkPermission('room-123', 'user-123', 'kick')
      ).rejects.toThrow('Player is not in this room');
    });

    it('should throw PermissionDeniedError when user lacks permission', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ role: 'guest' }] })
        .mockResolvedValueOnce({ rows: [{ allowed: false }] });

      await expect(
        permissionService.checkPermission('room-123', 'user-123', 'kick')
      ).rejects.toThrow('Permission denied');
    });

    it('should recognize owner from room table', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ owner_id: 'user-123' }] })
        .mockResolvedValueOnce({ rows: [{ allowed: true }] });

      const result = await permissionService.checkPermission('room-123', 'user-123', 'delete');

      expect(result).toBe(true);
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has permission', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ role: 'admin' }] })
        .mockResolvedValueOnce({ rows: [{ allowed: true }] });

      const result = await permissionService.hasPermission('room-123', 'user-123', 'kick');

      expect(result).toBe(true);
    });

    it('should return false when user lacks permission', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ role: 'guest' }] })
        .mockResolvedValueOnce({ rows: [{ allowed: false }] });

      const result = await permissionService.hasPermission('room-123', 'user-123', 'kick');

      expect(result).toBe(false);
    });
  });

  describe('roleHasPermission', () => {
    it('should return true when role has permission in database', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ allowed: true }] });

      const result = await permissionService.roleHasPermission('room-123', 'admin', 'kick');

      expect(result).toBe(true);
    });

    it('should return false when role lacks permission in database', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ allowed: false }] });

      const result = await permissionService.roleHasPermission('room-123', 'guest', 'kick');

      expect(result).toBe(false);
    });

    it('should use default permissions when not in database', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await permissionService.roleHasPermission('room-123', 'owner', 'delete');

      expect(result).toBe(true);
    });

    it('should return false for non-default permission not in database', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await permissionService.roleHasPermission('room-123', 'guest', 'delete');

      expect(result).toBe(false);
    });
  });

  describe('setPermission', () => {
    it('should set permission successfully', async () => {
      const mockPermission = {
        id: 'perm-123',
        room_id: 'room-123',
        role: 'member',
        action: 'invite',
        allowed: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] })
        .mockResolvedValueOnce({ rows: [{ allowed: true }] })
        .mockResolvedValueOnce({ rows: [mockPermission] });

      const permission = await permissionService.setPermission(
        'room-123',
        'member',
        'invite',
        true,
        'owner-123'
      );

      expect(permission.role).toBe('member');
      expect(permission.action).toBe('invite');
      expect(permission.allowed).toBe(true);
    });
  });

  describe('getRoomPermissions', () => {
    it('should return all room permissions', async () => {
      const mockPermissions = [
        {
          id: 'perm-1',
          room_id: 'room-123',
          role: 'owner',
          action: 'delete',
          allowed: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'perm-2',
          room_id: 'room-123',
          role: 'admin',
          action: 'kick',
          allowed: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: mockPermissions });

      const permissions = await permissionService.getRoomPermissions('room-123');

      expect(permissions).toHaveLength(2);
      expect(permissions[0].role).toBe('owner');
      expect(permissions[1].role).toBe('admin');
    });
  });

  describe('getRolePermissions', () => {
    it('should return permissions for a specific role', async () => {
      const mockActions = [{ action: 'join' }, { action: 'leave' }, { action: 'kick' }];

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: mockActions });

      const actions = await permissionService.getRolePermissions('room-123', 'moderator');

      expect(actions).toEqual(['join', 'leave', 'kick']);
    });
  });

  describe('bulkSetPermissions', () => {
    it('should set multiple permissions at once', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] })
        .mockResolvedValueOnce({ rows: [{ allowed: true }] })
        .mockResolvedValue({ rows: [] });

      const permissions = [
        { role: 'member' as PlayerRole, action: 'invite' as PermissionAction, allowed: true },
        { role: 'member' as PlayerRole, action: 'kick' as PermissionAction, allowed: false },
      ];

      await permissionService.bulkSetPermissions('room-123', permissions, 'owner-123');

      expect(mockPool.query).toHaveBeenCalledTimes(4);
    });
  });

  describe('resetRoomPermissions', () => {
    it('should reset room permissions to defaults', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ role: 'owner' }] })
        .mockResolvedValueOnce({ rows: [{ allowed: true }] })
        .mockResolvedValue({ rows: [] });

      await permissionService.resetRoomPermissions('room-123', 'owner-123');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM room_permissions'),
        ['room-123']
      );
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific room', () => {
      permissionService.clearCache('room-123');
    });

    it('should clear all cache when no room specified', () => {
      permissionService.clearCache();
    });
  });
});
