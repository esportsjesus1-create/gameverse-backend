import { Pool } from 'pg';
import { RoomService } from '../services/room.service';
import { StateSyncService } from '../services/state-sync.service';
import { PermissionService } from '../services/permission.service';
import {
  CreateRoomInput,
  UpdateRoomInput,
  JoinRoomInput,
  RoomError,
} from '../types';

const mockPool = {
  query: jest.fn(),
} as unknown as Pool;

const mockStateSyncService = {
  initializeRoomState: jest.fn(),
  publishRoomUpdate: jest.fn(),
  cleanupRoomState: jest.fn(),
} as unknown as StateSyncService;

const mockPermissionService = {
  initializeRoomPermissions: jest.fn(),
  checkPermission: jest.fn(),
} as unknown as PermissionService;

describe('RoomService', () => {
  let roomService: RoomService;

  beforeEach(() => {
    jest.clearAllMocks();
    roomService = new RoomService(mockPool, mockStateSyncService, mockPermissionService);
  });

  describe('createRoom', () => {
    it('should create a room successfully', async () => {
      const input: CreateRoomInput = {
        name: 'Test Room',
        type: 'lobby',
        ownerId: 'user-123',
        description: 'A test room',
        visibility: 'public',
        capacity: 50,
      };

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const room = await roomService.createRoom(input);

      expect(room).toBeDefined();
      expect(room.name).toBe('Test Room');
      expect(room.type).toBe('lobby');
      expect(room.ownerId).toBe('user-123');
      expect(room.status).toBe('active');
      expect(room.capacity).toBe(50);
      expect(mockStateSyncService.initializeRoomState).toHaveBeenCalled();
      expect(mockPermissionService.initializeRoomPermissions).toHaveBeenCalled();
    });

    it('should use default capacity when not provided', async () => {
      const input: CreateRoomInput = {
        name: 'Test Room',
        type: 'game',
        ownerId: 'user-123',
      };

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const room = await roomService.createRoom(input);

      expect(room.capacity).toBe(50);
    });

    it('should cap capacity at max capacity', async () => {
      const input: CreateRoomInput = {
        name: 'Test Room',
        type: 'game',
        ownerId: 'user-123',
        capacity: 500,
      };

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const room = await roomService.createRoom(input);

      expect(room.capacity).toBe(100);
    });

    it('should throw error when database insert fails', async () => {
      const input: CreateRoomInput = {
        name: 'Test Room',
        type: 'lobby',
        ownerId: 'user-123',
      };

      (mockPool.query as jest.Mock).mockRejectedValueOnce(new Error('DB Error'));

      await expect(roomService.createRoom(input)).rejects.toThrow(RoomError);
    });
  });

  describe('getRoomById', () => {
    it('should return room when found', async () => {
      const mockRow = {
        id: 'room-123',
        name: 'Test Room',
        type: 'lobby',
        status: 'active',
        visibility: 'public',
        owner_id: 'user-123',
        capacity: 50,
        current_player_count: 5,
        settings: JSON.stringify({ allowSpectators: true }),
        metadata: JSON.stringify({}),
        tags: ['test'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      };

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockRow] });

      const room = await roomService.getRoomById('room-123');

      expect(room).toBeDefined();
      expect(room?.id).toBe('room-123');
      expect(room?.name).toBe('Test Room');
    });

    it('should return null when room not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const room = await roomService.getRoomById('nonexistent');

      expect(room).toBeNull();
    });
  });

  describe('getRooms', () => {
    it('should return paginated rooms', async () => {
      const mockRows = [
        {
          id: 'room-1',
          name: 'Room 1',
          type: 'lobby',
          status: 'active',
          visibility: 'public',
          owner_id: 'user-1',
          capacity: 50,
          current_player_count: 5,
          settings: JSON.stringify({}),
          metadata: JSON.stringify({}),
          tags: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        },
      ];

      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: mockRows });

      const result = await roomService.getRooms({}, 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter rooms by type', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await roomService.getRooms({ type: 'game' }, 1, 20);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('type = $1'),
        expect.arrayContaining(['game'])
      );
    });

    it('should filter rooms by visibility', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await roomService.getRooms({ visibility: 'private' }, 1, 20);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('visibility = $1'),
        expect.arrayContaining(['private'])
      );
    });

    it('should filter rooms with capacity', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await roomService.getRooms({ hasCapacity: true }, 1, 20);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('current_player_count < capacity'),
        expect.any(Array)
      );
    });
  });

  describe('updateRoom', () => {
    it('should update room successfully', async () => {
      const mockRoom = {
        id: 'room-123',
        name: 'Test Room',
        type: 'lobby',
        status: 'active',
        visibility: 'public',
        owner_id: 'user-123',
        capacity: 50,
        current_player_count: 5,
        settings: JSON.stringify({ allowSpectators: true }),
        metadata: JSON.stringify({}),
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      };

      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockRoom] })
        .mockResolvedValueOnce({ rows: [{ ...mockRoom, name: 'Updated Room' }] });
      (mockPermissionService.checkPermission as jest.Mock).mockResolvedValueOnce(true);

      const input: UpdateRoomInput = { name: 'Updated Room' };
      const room = await roomService.updateRoom('room-123', input, 'user-123');

      expect(room.name).toBe('Updated Room');
    });

    it('should throw error when room not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        roomService.updateRoom('nonexistent', { name: 'Test' }, 'user-123')
      ).rejects.toThrow('Room not found');
    });

    it('should throw error when reducing capacity below current player count', async () => {
      const mockRoom = {
        id: 'room-123',
        name: 'Test Room',
        type: 'lobby',
        status: 'active',
        visibility: 'public',
        owner_id: 'user-123',
        capacity: 50,
        current_player_count: 30,
        settings: JSON.stringify({}),
        metadata: JSON.stringify({}),
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      };

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockRoom] });
      (mockPermissionService.checkPermission as jest.Mock).mockResolvedValueOnce(true);

      await expect(
        roomService.updateRoom('room-123', { capacity: 20 }, 'user-123')
      ).rejects.toThrow(RoomError);
    });
  });

  describe('deleteRoom', () => {
    it('should delete room successfully', async () => {
      const mockRoom = {
        id: 'room-123',
        name: 'Test Room',
        type: 'lobby',
        status: 'active',
        visibility: 'public',
        owner_id: 'user-123',
        capacity: 50,
        current_player_count: 0,
        settings: JSON.stringify({}),
        metadata: JSON.stringify({}),
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      };

      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockRoom] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      (mockPermissionService.checkPermission as jest.Mock).mockResolvedValueOnce(true);

      await expect(roomService.deleteRoom('room-123', 'user-123')).resolves.not.toThrow();
      expect(mockStateSyncService.cleanupRoomState).toHaveBeenCalledWith('room-123');
    });

    it('should throw error when room not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(roomService.deleteRoom('nonexistent', 'user-123')).rejects.toThrow(
        'Room not found'
      );
    });
  });

  describe('joinRoom', () => {
    const mockActiveRoom = {
      id: 'room-123',
      name: 'Test Room',
      type: 'lobby',
      status: 'active',
      visibility: 'public',
      owner_id: 'owner-123',
      capacity: 50,
      current_player_count: 5,
      settings: JSON.stringify({ allowSpectators: true, maxSpectators: 10 }),
      metadata: JSON.stringify({}),
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    };

    it('should join room successfully', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockActiveRoom] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const input: JoinRoomInput = {
        roomId: 'room-123',
        userId: 'user-456',
        username: 'testuser',
      };

      const player = await roomService.joinRoom(input);

      expect(player).toBeDefined();
      expect(player.userId).toBe('user-456');
      expect(player.username).toBe('testuser');
      expect(player.role).toBe('member');
    });

    it('should assign owner role when owner joins', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockActiveRoom] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const input: JoinRoomInput = {
        roomId: 'room-123',
        userId: 'owner-123',
        username: 'owner',
      };

      const player = await roomService.joinRoom(input);

      expect(player.role).toBe('owner');
    });

    it('should throw error when room not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const input: JoinRoomInput = {
        roomId: 'nonexistent',
        userId: 'user-123',
        username: 'testuser',
      };

      await expect(roomService.joinRoom(input)).rejects.toThrow('Room not found');
    });

    it('should throw error when room is closed', async () => {
      const closedRoom = { ...mockActiveRoom, status: 'closed' };
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [closedRoom] });

      const input: JoinRoomInput = {
        roomId: 'room-123',
        userId: 'user-123',
        username: 'testuser',
      };

      await expect(roomService.joinRoom(input)).rejects.toThrow('Room is closed');
    });

    it('should throw error when password is incorrect', async () => {
      const passwordRoom = { ...mockActiveRoom, password: 'secret123' };
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [passwordRoom] });

      const input: JoinRoomInput = {
        roomId: 'room-123',
        userId: 'user-123',
        username: 'testuser',
        password: 'wrongpassword',
      };

      await expect(roomService.joinRoom(input)).rejects.toThrow('Invalid room password');
    });

    it('should throw error when player already in room', async () => {
      const existingPlayer = {
        id: 'player-123',
        room_id: 'room-123',
        user_id: 'user-123',
        username: 'testuser',
        role: 'member',
        is_spectator: false,
        joined_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      };

      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockActiveRoom] })
        .mockResolvedValueOnce({ rows: [existingPlayer] });

      const input: JoinRoomInput = {
        roomId: 'room-123',
        userId: 'user-123',
        username: 'testuser',
      };

      await expect(roomService.joinRoom(input)).rejects.toThrow('Player is already in this room');
    });

    it('should throw error when room is full', async () => {
      const fullRoom = { ...mockActiveRoom, current_player_count: 50 };
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [fullRoom] })
        .mockResolvedValueOnce({ rows: [] });

      const input: JoinRoomInput = {
        roomId: 'room-123',
        userId: 'user-123',
        username: 'testuser',
      };

      await expect(roomService.joinRoom(input)).rejects.toThrow('Room is at full capacity');
    });
  });

  describe('leaveRoom', () => {
    it('should leave room successfully', async () => {
      const mockPlayer = {
        id: 'player-123',
        room_id: 'room-123',
        user_id: 'user-123',
        username: 'testuser',
        role: 'member',
        is_spectator: false,
        joined_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      };

      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockPlayer] })
        .mockResolvedValueOnce({ rows: [mockPlayer] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(roomService.leaveRoom('room-123', 'user-123')).resolves.not.toThrow();
    });

    it('should throw error when player not in room', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(roomService.leaveRoom('room-123', 'user-123')).rejects.toThrow(
        'Player is not in this room'
      );
    });
  });

  describe('kickPlayer', () => {
    it('should kick player successfully', async () => {
      const mockPlayer = {
        id: 'player-123',
        room_id: 'room-123',
        user_id: 'user-456',
        username: 'testuser',
        role: 'member',
        is_spectator: false,
        joined_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      };

      (mockPermissionService.checkPermission as jest.Mock).mockResolvedValueOnce(true);
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockPlayer] })
        .mockResolvedValueOnce({ rows: [mockPlayer] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(
        roomService.kickPlayer('room-123', 'user-456', 'admin-123')
      ).resolves.not.toThrow();
    });

    it('should throw error when trying to kick owner', async () => {
      const ownerPlayer = {
        id: 'player-123',
        room_id: 'room-123',
        user_id: 'owner-123',
        username: 'owner',
        role: 'owner',
        is_spectator: false,
        joined_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      };

      (mockPermissionService.checkPermission as jest.Mock).mockResolvedValueOnce(true);
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [ownerPlayer] });

      await expect(
        roomService.kickPlayer('room-123', 'owner-123', 'admin-123')
      ).rejects.toThrow(RoomError);
    });
  });

  describe('updatePlayerRole', () => {
    it('should update player role successfully', async () => {
      const mockPlayer = {
        id: 'player-123',
        room_id: 'room-123',
        user_id: 'user-456',
        username: 'testuser',
        role: 'member',
        is_spectator: false,
        joined_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      };

      (mockPermissionService.checkPermission as jest.Mock).mockResolvedValueOnce(true);
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockPlayer] })
        .mockResolvedValueOnce({ rows: [{ ...mockPlayer, role: 'moderator' }] })
        .mockResolvedValueOnce({ rows: [] });

      const player = await roomService.updatePlayerRole(
        'room-123',
        'user-456',
        'moderator',
        'admin-123'
      );

      expect(player.role).toBe('moderator');
    });

    it('should throw error when trying to change owner role', async () => {
      const ownerPlayer = {
        id: 'player-123',
        room_id: 'room-123',
        user_id: 'owner-123',
        username: 'owner',
        role: 'owner',
        is_spectator: false,
        joined_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      };

      (mockPermissionService.checkPermission as jest.Mock).mockResolvedValueOnce(true);
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [ownerPlayer] });

      await expect(
        roomService.updatePlayerRole('room-123', 'owner-123', 'admin', 'admin-123')
      ).rejects.toThrow(RoomError);
    });
  });

  describe('getRoomPlayers', () => {
    it('should return room players', async () => {
      const mockPlayers = [
        {
          id: 'player-1',
          room_id: 'room-123',
          user_id: 'user-1',
          username: 'user1',
          role: 'owner',
          is_spectator: false,
          joined_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
        },
        {
          id: 'player-2',
          room_id: 'room-123',
          user_id: 'user-2',
          username: 'user2',
          role: 'member',
          is_spectator: false,
          joined_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
        },
      ];

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: mockPlayers });

      const players = await roomService.getRoomPlayers('room-123');

      expect(players).toHaveLength(2);
      expect(players[0].username).toBe('user1');
      expect(players[1].username).toBe('user2');
    });
  });

  describe('getRoomEvents', () => {
    it('should return room events', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          room_id: 'room-123',
          type: 'player_joined',
          player_id: 'user-1',
          data: JSON.stringify({}),
          timestamp: new Date().toISOString(),
        },
      ];

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: mockEvents });

      const events = await roomService.getRoomEvents('room-123', 100);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('player_joined');
    });
  });
});
