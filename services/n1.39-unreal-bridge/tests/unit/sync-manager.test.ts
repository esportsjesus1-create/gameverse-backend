import { SyncManager } from '../../src/sync/sync-manager';
import { testLogger } from '../setup';

describe('SyncManager', () => {
  let syncManager: SyncManager;

  beforeEach(() => {
    syncManager = new SyncManager(
      {
        maxStates: 100,
        snapshotInterval: 60000,
        snapshotTTL: 3600000,
        enableDeltaCompression: true
      },
      testLogger
    );
  });

  afterEach(() => {
    syncManager.stop();
  });

  describe('createState', () => {
    it('should create a new state', () => {
      const state = syncManager.createState('test-state', { value: 1 });

      expect(state).toBeDefined();
      expect(state.stateId).toBe('test-state');
      expect(state.version).toBe(1);
      expect(state.data).toEqual({ value: 1 });
    });

    it('should throw error for duplicate state ID', () => {
      syncManager.createState('test-state', { value: 1 });

      expect(() => syncManager.createState('test-state', { value: 2 })).toThrow();
    });

    it('should throw error when max states reached', () => {
      const limitedManager = new SyncManager(
        { maxStates: 1, snapshotInterval: 0, snapshotTTL: 3600000, enableDeltaCompression: false },
        testLogger
      );

      limitedManager.createState('state-1', {});

      expect(() => limitedManager.createState('state-2', {})).toThrow();
    });

    it('should emit stateCreated event', () => {
      const callback = jest.fn();
      syncManager.on('stateCreated', callback);

      syncManager.createState('test-state', { value: 1 });

      expect(callback).toHaveBeenCalledWith('test-state', 1);
    });
  });

  describe('getState', () => {
    it('should return existing state', () => {
      syncManager.createState('test-state', { value: 1 });

      const state = syncManager.getState('test-state');

      expect(state).toBeDefined();
      expect(state?.stateId).toBe('test-state');
    });

    it('should return undefined for non-existent state', () => {
      const state = syncManager.getState('non-existent');
      expect(state).toBeUndefined();
    });
  });

  describe('updateState', () => {
    it('should update state and increment version', () => {
      syncManager.createState('test-state', { value: 1 });

      const updated = syncManager.updateState('test-state', { value: 2 });

      expect(updated.version).toBe(2);
      expect(updated.data).toEqual({ value: 2 });
    });

    it('should throw error for non-existent state', () => {
      expect(() => syncManager.updateState('non-existent', {})).toThrow();
    });

    it('should throw error for version conflict', () => {
      syncManager.createState('test-state', { value: 1 });

      expect(() => syncManager.updateState('test-state', { value: 2 }, 99)).toThrow();
    });

    it('should emit stateUpdated event', () => {
      const callback = jest.fn();
      syncManager.on('stateUpdated', callback);

      syncManager.createState('test-state', { value: 1 });
      syncManager.updateState('test-state', { value: 2 });

      expect(callback).toHaveBeenCalled();
    });

    it('should emit conflictDetected event on version mismatch', () => {
      const callback = jest.fn();
      syncManager.on('conflictDetected', callback);

      syncManager.createState('test-state', { value: 1 });

      try {
        syncManager.updateState('test-state', { value: 2 }, 99);
      } catch {
        // Expected
      }

      expect(callback).toHaveBeenCalledWith('test-state', 99, 1);
    });
  });

  describe('applyOperations', () => {
    it('should apply add operation', () => {
      syncManager.createState('test-state', { existing: 'value' });

      const updated = syncManager.applyOperations('test-state', {
        stateId: 'test-state',
        version: 1,
        delta: null,
        operations: [{ op: 'add', path: '/newKey', value: 'newValue' }]
      });

      expect((updated.data as Record<string, unknown>).newKey).toBe('newValue');
    });

    it('should apply replace operation', () => {
      syncManager.createState('test-state', { key: 'oldValue' });

      const updated = syncManager.applyOperations('test-state', {
        stateId: 'test-state',
        version: 1,
        delta: null,
        operations: [{ op: 'replace', path: '/key', value: 'newValue' }]
      });

      expect((updated.data as Record<string, unknown>).key).toBe('newValue');
    });

    it('should apply remove operation', () => {
      syncManager.createState('test-state', { key: 'value', other: 'keep' });

      const updated = syncManager.applyOperations('test-state', {
        stateId: 'test-state',
        version: 1,
        delta: null,
        operations: [{ op: 'remove', path: '/key' }]
      });

      expect((updated.data as Record<string, unknown>).key).toBeUndefined();
      expect((updated.data as Record<string, unknown>).other).toBe('keep');
    });

    it('should throw error for version conflict', () => {
      syncManager.createState('test-state', { value: 1 });

      expect(() =>
        syncManager.applyOperations('test-state', {
          stateId: 'test-state',
          version: 99,
          delta: null,
          operations: []
        })
      ).toThrow();
    });
  });

  describe('deleteState', () => {
    it('should delete existing state', () => {
      syncManager.createState('test-state', {});

      const result = syncManager.deleteState('test-state');

      expect(result).toBe(true);
      expect(syncManager.getState('test-state')).toBeUndefined();
    });

    it('should return false for non-existent state', () => {
      const result = syncManager.deleteState('non-existent');
      expect(result).toBe(false);
    });

    it('should emit stateDeleted event', () => {
      const callback = jest.fn();
      syncManager.on('stateDeleted', callback);

      syncManager.createState('test-state', {});
      syncManager.deleteState('test-state');

      expect(callback).toHaveBeenCalledWith('test-state');
    });
  });

  describe('subscribe/unsubscribe', () => {
    it('should subscribe session to state', () => {
      syncManager.createState('test-state', {});

      const result = syncManager.subscribe('test-state', 'session-1');

      expect(result).toBe(true);
      expect(syncManager.getSubscribers('test-state')).toContain('session-1');
    });

    it('should return false for non-existent state', () => {
      const result = syncManager.subscribe('non-existent', 'session-1');
      expect(result).toBe(false);
    });

    it('should unsubscribe session from state', () => {
      syncManager.createState('test-state', {});
      syncManager.subscribe('test-state', 'session-1');

      const result = syncManager.unsubscribe('test-state', 'session-1');

      expect(result).toBe(true);
      expect(syncManager.getSubscribers('test-state')).not.toContain('session-1');
    });

    it('should unsubscribe session from all states', () => {
      syncManager.createState('state-1', {});
      syncManager.createState('state-2', {});
      syncManager.subscribe('state-1', 'session-1');
      syncManager.subscribe('state-2', 'session-1');

      const count = syncManager.unsubscribeAll('session-1');

      expect(count).toBe(2);
    });
  });

  describe('createSyncPayload', () => {
    it('should create sync payload for existing state', () => {
      syncManager.createState('test-state', { value: 1 });

      const payload = syncManager.createSyncPayload('test-state', true);

      expect(payload).toBeDefined();
      expect(payload?.stateId).toBe('test-state');
      expect(payload?.fullState).toBe(true);
      expect(payload?.data).toEqual({ value: 1 });
    });

    it('should return null for non-existent state', () => {
      const payload = syncManager.createSyncPayload('non-existent');
      expect(payload).toBeNull();
    });
  });

  describe('getStateCount', () => {
    it('should return correct state count', () => {
      expect(syncManager.getStateCount()).toBe(0);

      syncManager.createState('state-1', {});
      syncManager.createState('state-2', {});

      expect(syncManager.getStateCount()).toBe(2);
    });
  });

  describe('getAllStateIds', () => {
    it('should return all state IDs', () => {
      syncManager.createState('state-1', {});
      syncManager.createState('state-2', {});

      const ids = syncManager.getAllStateIds();

      expect(ids).toContain('state-1');
      expect(ids).toContain('state-2');
    });
  });

  describe('start/stop', () => {
    it('should start and stop without errors', () => {
      expect(() => syncManager.start()).not.toThrow();
      expect(() => syncManager.stop()).not.toThrow();
    });
  });
});
