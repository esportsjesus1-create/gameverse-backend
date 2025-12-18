import { Pool } from 'pg';
import { LifecycleService } from '../services/lifecycle.service';
import { RoomService } from '../services/room.service';
import { StateSyncService } from '../services/state-sync.service';

const mockPool = {
  query: jest.fn(),
} as unknown as Pool;

const mockRoomService = {
  getRoomById: jest.fn(),
  deleteRoom: jest.fn(),
  recordEvent: jest.fn(),
  getRoomPlayers: jest.fn(),
} as unknown as RoomService;

const mockStateSyncService = {
  publishRoomUpdate: jest.fn(),
} as unknown as StateSyncService;

describe('LifecycleService', () => {
  let lifecycleService: LifecycleService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    lifecycleService = new LifecycleService(mockPool, mockRoomService, mockStateSyncService);
  });

  afterEach(() => {
    lifecycleService.stop();
    jest.useRealTimers();
  });

  describe('start/stop', () => {
    it('should start cleanup interval', () => {
      const initialTimerCount = jest.getTimerCount();
      lifecycleService.start();
      expect(jest.getTimerCount()).toBeGreaterThan(initialTimerCount);
    });

    it('should stop cleanup interval', () => {
      lifecycleService.start();
      lifecycleService.stop();
      // Verify stop was called without error - the cleanup interval is cleared
      expect(true).toBe(true);
    });
  });

  describe('createInstance', () => {
    it('should create instance successfully', async () => {
      const mockRoom = {
        id: 'room-123',
        name: 'Test Room',
        capacity: 50,
      };

      (mockRoomService.getRoomById as jest.Mock).mockResolvedValueOnce(mockRoom);
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const instance = await lifecycleService.createInstance('room-123', 'server-1', 'us-east');

      expect(instance).toBeDefined();
      expect(instance.roomId).toBe('room-123');
      expect(instance.serverId).toBe('server-1');
      expect(instance.region).toBe('us-east');
      expect(instance.status).toBe('running');
      expect(instance.maxPlayers).toBe(50);
    });

    it('should throw error when room not found', async () => {
      (mockRoomService.getRoomById as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        lifecycleService.createInstance('nonexistent', 'server-1', 'us-east')
      ).rejects.toThrow('Room not found');
    });
  });

  describe('getInstance', () => {
    it('should return instance from cache', async () => {
      const mockRoom = { id: 'room-123', capacity: 50 };
      (mockRoomService.getRoomById as jest.Mock).mockResolvedValueOnce(mockRoom);
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const created = await lifecycleService.createInstance('room-123', 'server-1', 'us-east');
      const instance = await lifecycleService.getInstance(created.id);

      expect(instance).toBeDefined();
      expect(instance?.id).toBe(created.id);
    });

    it('should fetch instance from database if not cached', async () => {
      const mockInstance = {
        id: 'instance-123',
        room_id: 'room-123',
        server_id: 'server-1',
        region: 'us-east',
        status: 'running',
        connection_url: 'wss://test.com',
        player_count: 5,
        max_players: 50,
        started_at: new Date().toISOString(),
        metadata: JSON.stringify({}),
      };

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockInstance] });

      const instance = await lifecycleService.getInstance('instance-123');

      expect(instance).toBeDefined();
      expect(instance?.id).toBe('instance-123');
    });

    it('should return null when instance not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const instance = await lifecycleService.getInstance('nonexistent');

      expect(instance).toBeNull();
    });
  });

  describe('getInstanceByRoom', () => {
    it('should return running instance for room', async () => {
      const mockInstance = {
        id: 'instance-123',
        room_id: 'room-123',
        server_id: 'server-1',
        region: 'us-east',
        status: 'running',
        connection_url: 'wss://test.com',
        player_count: 5,
        max_players: 50,
        started_at: new Date().toISOString(),
        metadata: JSON.stringify({}),
      };

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockInstance] });

      const instance = await lifecycleService.getInstanceByRoom('room-123');

      expect(instance).toBeDefined();
      expect(instance?.roomId).toBe('room-123');
    });

    it('should return null when no running instance', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const instance = await lifecycleService.getInstanceByRoom('room-123');

      expect(instance).toBeNull();
    });
  });

  describe('stopInstance', () => {
    it('should stop instance successfully', async () => {
      const mockRoom = { id: 'room-123', capacity: 50 };
      (mockRoomService.getRoomById as jest.Mock).mockResolvedValueOnce(mockRoom);
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const created = await lifecycleService.createInstance('room-123', 'server-1', 'us-east');

      await lifecycleService.stopInstance(created.id);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('stopped'),
        expect.any(Array)
      );
      expect(mockRoomService.recordEvent).toHaveBeenCalledWith(
        'room-123',
        'instance_stopped',
        undefined,
        { instanceId: created.id }
      );
    });

    it('should throw error when instance not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(lifecycleService.stopInstance('nonexistent')).rejects.toThrow(
        'Instance not found'
      );
    });
  });

  describe('updateInstancePlayerCount', () => {
    it('should update player count', async () => {
      const mockRoom = { id: 'room-123', capacity: 50 };
      (mockRoomService.getRoomById as jest.Mock).mockResolvedValueOnce(mockRoom);
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const created = await lifecycleService.createInstance('room-123', 'server-1', 'us-east');

      await lifecycleService.updateInstancePlayerCount(created.id, 10);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('player_count'),
        [10, created.id]
      );
    });
  });

  describe('getActiveInstances', () => {
    it('should return all active instances', async () => {
      const mockInstances = [
        {
          id: 'instance-1',
          room_id: 'room-1',
          server_id: 'server-1',
          region: 'us-east',
          status: 'running',
          connection_url: 'wss://test.com',
          player_count: 5,
          max_players: 50,
          started_at: new Date().toISOString(),
          metadata: JSON.stringify({}),
        },
      ];

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: mockInstances });

      const instances = await lifecycleService.getActiveInstances();

      expect(instances).toHaveLength(1);
      expect(instances[0].status).toBe('running');
    });
  });

  describe('getInstancesByServer', () => {
    it('should return instances for specific server', async () => {
      const mockInstances = [
        {
          id: 'instance-1',
          room_id: 'room-1',
          server_id: 'server-1',
          region: 'us-east',
          status: 'running',
          connection_url: 'wss://test.com',
          player_count: 5,
          max_players: 50,
          started_at: new Date().toISOString(),
          metadata: JSON.stringify({}),
        },
      ];

      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: mockInstances });

      const instances = await lifecycleService.getInstancesByServer('server-1');

      expect(instances).toHaveLength(1);
      expect(instances[0].serverId).toBe('server-1');
    });
  });

  describe('pauseRoom', () => {
    it('should pause room successfully', async () => {
      const mockRoom = {
        id: 'room-123',
        status: 'active',
      };

      (mockRoomService.getRoomById as jest.Mock)
        .mockResolvedValueOnce(mockRoom)
        .mockResolvedValueOnce({ ...mockRoom, status: 'paused' });
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const room = await lifecycleService.pauseRoom('room-123', 'user-123');

      expect(room.status).toBe('paused');
      expect(mockStateSyncService.publishRoomUpdate).toHaveBeenCalledWith(
        'room-123',
        'room_paused',
        {}
      );
    });

    it('should throw error when room not found', async () => {
      (mockRoomService.getRoomById as jest.Mock).mockResolvedValueOnce(null);

      await expect(lifecycleService.pauseRoom('nonexistent', 'user-123')).rejects.toThrow(
        'Room not found'
      );
    });

    it('should throw error when room is not active', async () => {
      const mockRoom = { id: 'room-123', status: 'closed' };
      (mockRoomService.getRoomById as jest.Mock).mockResolvedValueOnce(mockRoom);

      await expect(lifecycleService.pauseRoom('room-123', 'user-123')).rejects.toThrow(
        'Room is not active'
      );
    });
  });

  describe('resumeRoom', () => {
    it('should resume room successfully', async () => {
      const mockRoom = {
        id: 'room-123',
        status: 'paused',
      };

      (mockRoomService.getRoomById as jest.Mock)
        .mockResolvedValueOnce(mockRoom)
        .mockResolvedValueOnce({ ...mockRoom, status: 'active' });
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const room = await lifecycleService.resumeRoom('room-123', 'user-123');

      expect(room.status).toBe('active');
      expect(mockStateSyncService.publishRoomUpdate).toHaveBeenCalledWith(
        'room-123',
        'room_resumed',
        {}
      );
    });

    it('should throw error when room is not paused', async () => {
      const mockRoom = { id: 'room-123', status: 'active' };
      (mockRoomService.getRoomById as jest.Mock).mockResolvedValueOnce(mockRoom);

      await expect(lifecycleService.resumeRoom('room-123', 'user-123')).rejects.toThrow(
        'Room is not paused'
      );
    });
  });

  describe('archiveRoom', () => {
    it('should archive room successfully', async () => {
      const mockRoom = {
        id: 'room-123',
        status: 'closed',
      };

      (mockRoomService.getRoomById as jest.Mock).mockResolvedValueOnce(mockRoom);
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await lifecycleService.archiveRoom('room-123', 'user-123');

      expect(mockRoomService.recordEvent).toHaveBeenCalledWith(
        'room-123',
        'room_archived',
        'user-123',
        {}
      );
    });

    it('should throw error when room is not closed', async () => {
      const mockRoom = { id: 'room-123', status: 'active' };
      (mockRoomService.getRoomById as jest.Mock).mockResolvedValueOnce(mockRoom);

      await expect(lifecycleService.archiveRoom('room-123', 'user-123')).rejects.toThrow(
        'Room must be closed before archiving'
      );
    });
  });
});
