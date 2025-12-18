import Redis from 'ioredis';
import { StateSyncService } from '../services/state-sync.service';

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  lpush: jest.fn(),
  ltrim: jest.fn(),
  lrange: jest.fn(),
  publish: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  on: jest.fn(),
  duplicate: jest.fn().mockReturnThis(),
  quit: jest.fn(),
} as unknown as Redis;

describe('StateSyncService', () => {
  let stateSyncService: StateSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockRedis.duplicate as jest.Mock).mockReturnValue(mockRedis);
    stateSyncService = new StateSyncService(mockRedis);
  });

  describe('initializeRoomState', () => {
    it('should initialize room state successfully', async () => {
      (mockRedis.set as jest.Mock).mockResolvedValueOnce('OK');

      const state = await stateSyncService.initializeRoomState('room-123');

      expect(state).toBeDefined();
      expect(state.roomId).toBe('room-123');
      expect(state.version).toBe(1);
      expect(state.data).toEqual({});
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });

  describe('getState', () => {
    it('should return cached state if available', async () => {
      (mockRedis.set as jest.Mock).mockResolvedValueOnce('OK');
      await stateSyncService.initializeRoomState('room-123');

      const state = await stateSyncService.getState('room-123');

      expect(state).toBeDefined();
      expect(state?.roomId).toBe('room-123');
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should fetch state from Redis if not cached', async () => {
      const mockState = {
        roomId: 'room-456',
        version: 5,
        data: { test: 'value' },
        lastUpdatedAt: new Date().toISOString(),
      };

      (mockRedis.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockState));

      const state = await stateSyncService.getState('room-456');

      expect(state).toBeDefined();
      expect(state?.roomId).toBe('room-456');
      expect(state?.version).toBe(5);
      expect(mockRedis.get).toHaveBeenCalledWith('room:room-456:state');
    });

    it('should return null if state not found', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValueOnce(null);

      const state = await stateSyncService.getState('nonexistent');

      expect(state).toBeNull();
    });
  });

  describe('updateState', () => {
    it('should update state successfully', async () => {
      (mockRedis.set as jest.Mock).mockResolvedValue('OK');
      (mockRedis.publish as jest.Mock).mockResolvedValue(1);
      (mockRedis.lpush as jest.Mock).mockResolvedValue(1);
      (mockRedis.ltrim as jest.Mock).mockResolvedValue('OK');

      await stateSyncService.initializeRoomState('room-123');

      const newState = await stateSyncService.updateState(
        'room-123',
        { data: { key: 'value' }, merge: false },
        'user-123'
      );

      expect(newState.version).toBe(2);
      expect(newState.data).toEqual({ key: 'value' });
      expect(newState.lastUpdatedBy).toBe('user-123');
    });

    it('should merge state when merge is true', async () => {
      (mockRedis.set as jest.Mock).mockResolvedValue('OK');
      (mockRedis.publish as jest.Mock).mockResolvedValue(1);
      (mockRedis.lpush as jest.Mock).mockResolvedValue(1);
      (mockRedis.ltrim as jest.Mock).mockResolvedValue('OK');

      await stateSyncService.initializeRoomState('room-123');
      await stateSyncService.updateState(
        'room-123',
        { data: { existing: 'data' }, merge: false },
        'user-123'
      );

      const newState = await stateSyncService.updateState(
        'room-123',
        { data: { new: 'value' }, merge: true },
        'user-123'
      );

      expect(newState.data).toEqual({ existing: 'data', new: 'value' });
    });

    it('should throw error on version conflict', async () => {
      (mockRedis.set as jest.Mock).mockResolvedValue('OK');
      (mockRedis.publish as jest.Mock).mockResolvedValue(1);
      (mockRedis.lpush as jest.Mock).mockResolvedValue(1);
      (mockRedis.ltrim as jest.Mock).mockResolvedValue('OK');

      await stateSyncService.initializeRoomState('room-123');

      await expect(
        stateSyncService.updateState(
          'room-123',
          { data: { key: 'value' }, merge: false },
          'user-123',
          999
        )
      ).rejects.toThrow('State version conflict');
    });

    it('should initialize state if not exists', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValueOnce(null);
      (mockRedis.set as jest.Mock).mockResolvedValue('OK');

      const state = await stateSyncService.updateState(
        'new-room',
        { data: { key: 'value' }, merge: false },
        'user-123'
      );

      expect(state.version).toBe(1);
    });
  });

  describe('patchState', () => {
    it('should patch nested state value', async () => {
      (mockRedis.set as jest.Mock).mockResolvedValue('OK');
      (mockRedis.publish as jest.Mock).mockResolvedValue(1);
      (mockRedis.lpush as jest.Mock).mockResolvedValue(1);
      (mockRedis.ltrim as jest.Mock).mockResolvedValue('OK');

      await stateSyncService.initializeRoomState('room-123');
      await stateSyncService.updateState(
        'room-123',
        { data: { player: { name: 'test' } }, merge: false },
        'user-123'
      );

      const newState = await stateSyncService.patchState(
        'room-123',
        'player.score',
        100,
        'user-123'
      );

      expect(newState.data).toEqual({ player: { name: 'test', score: 100 } });
    });

    it('should throw error if state not found', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        stateSyncService.patchState('nonexistent', 'key', 'value', 'user-123')
      ).rejects.toThrow('Room state not found');
    });
  });

  describe('deleteStateKey', () => {
    it('should delete nested state key', async () => {
      (mockRedis.set as jest.Mock).mockResolvedValue('OK');
      (mockRedis.publish as jest.Mock).mockResolvedValue(1);
      (mockRedis.lpush as jest.Mock).mockResolvedValue(1);
      (mockRedis.ltrim as jest.Mock).mockResolvedValue('OK');

      await stateSyncService.initializeRoomState('room-123');
      await stateSyncService.updateState(
        'room-123',
        { data: { player: { name: 'test', score: 100 } }, merge: false },
        'user-123'
      );

      const newState = await stateSyncService.deleteStateKey(
        'room-123',
        'player.score',
        'user-123'
      );

      expect(newState.data).toEqual({ player: { name: 'test' } });
    });
  });

  describe('subscribeToRoom', () => {
    it('should subscribe to room updates', async () => {
      (mockRedis.subscribe as jest.Mock).mockResolvedValue(1);

      const callback = jest.fn();
      const subscriptionId = await stateSyncService.subscribeToRoom('room-123', callback);

      expect(subscriptionId).toBeDefined();
      expect(mockRedis.subscribe).toHaveBeenCalledWith('room:room-123:state:updates');
    });
  });

  describe('unsubscribeFromRoom', () => {
    it('should unsubscribe from room updates', async () => {
      (mockRedis.subscribe as jest.Mock).mockResolvedValue(1);
      (mockRedis.unsubscribe as jest.Mock).mockResolvedValue(1);

      const callback = jest.fn();
      await stateSyncService.subscribeToRoom('room-123', callback);
      await stateSyncService.unsubscribeFromRoom('room-123', callback);

      expect(mockRedis.unsubscribe).toHaveBeenCalledWith('room:room-123:state:updates');
    });
  });

  describe('publishRoomUpdate', () => {
    it('should publish room update', async () => {
      (mockRedis.publish as jest.Mock).mockResolvedValue(1);

      await stateSyncService.publishRoomUpdate('room-123', 'player_joined', { userId: 'user-1' });

      expect(mockRedis.publish).toHaveBeenCalledWith(
        'room:room-123:events',
        expect.stringContaining('player_joined')
      );
    });
  });

  describe('cleanupRoomState', () => {
    it('should cleanup room state', async () => {
      (mockRedis.del as jest.Mock).mockResolvedValue(1);
      (mockRedis.unsubscribe as jest.Mock).mockResolvedValue(1);

      await stateSyncService.cleanupRoomState('room-123');

      expect(mockRedis.del).toHaveBeenCalledWith('room:room-123:state');
    });
  });

  describe('getStateHistory', () => {
    it('should return state history', async () => {
      const mockHistory = [
        JSON.stringify({ roomId: 'room-123', version: 2, changes: {}, timestamp: new Date() }),
        JSON.stringify({ roomId: 'room-123', version: 1, changes: {}, timestamp: new Date() }),
      ];

      (mockRedis.lrange as jest.Mock).mockResolvedValueOnce(mockHistory);

      const history = await stateSyncService.getStateHistory('room-123', 10);

      expect(history).toHaveLength(2);
      expect(mockRedis.lrange).toHaveBeenCalledWith('room:room-123:state:history', 0, 9);
    });
  });

  describe('disconnect', () => {
    it('should disconnect Redis connections', async () => {
      (mockRedis.quit as jest.Mock).mockResolvedValue('OK');

      await stateSyncService.disconnect();

      expect(mockRedis.quit).toHaveBeenCalledTimes(2);
    });
  });
});
