import { StateStore } from '../../src/state/state-store';
import { testLogger } from '../setup';

describe('StateStore', () => {
  let stateStore: StateStore;

  beforeEach(() => {
    stateStore = new StateStore(
      {
        maxEntries: 100,
        snapshotCapacity: 50,
        enablePersistence: false,
        transactionTimeout: 5000
      },
      testLogger
    );
  });

  describe('set/get', () => {
    it('should set and get a value', () => {
      stateStore.set('key1', { value: 'test' });

      const result = stateStore.get('key1');

      expect(result).toEqual({ value: 'test' });
    });

    it('should return undefined for non-existent key', () => {
      const result = stateStore.get('non-existent');
      expect(result).toBeUndefined();
    });

    it('should increment version on update', () => {
      stateStore.set('key1', { value: 1 });
      const entry1 = stateStore.getEntry('key1');

      stateStore.set('key1', { value: 2 });
      const entry2 = stateStore.getEntry('key1');

      expect(entry2?.version).toBe((entry1?.version || 0) + 1);
    });

    it('should throw error when max entries reached', () => {
      const limitedStore = new StateStore(
        {
          maxEntries: 1,
          snapshotCapacity: 50,
          enablePersistence: false,
          transactionTimeout: 5000
        },
        testLogger
      );

      limitedStore.set('key1', {});

      expect(() => limitedStore.set('key2', {})).toThrow();
    });

    it('should emit entryCreated event', () => {
      const callback = jest.fn();
      stateStore.on('entryCreated', callback);

      stateStore.set('key1', { value: 'test' });

      expect(callback).toHaveBeenCalledWith('key1', { value: 'test' });
    });

    it('should emit entryUpdated event', () => {
      const callback = jest.fn();
      stateStore.on('entryUpdated', callback);

      stateStore.set('key1', { value: 1 });
      stateStore.set('key1', { value: 2 });

      expect(callback).toHaveBeenCalledWith('key1', { value: 1 }, { value: 2 });
    });
  });

  describe('getEntry', () => {
    it('should return full entry with metadata', () => {
      stateStore.set('key1', { value: 'test' }, { custom: 'meta' });

      const entry = stateStore.getEntry('key1');

      expect(entry).toBeDefined();
      expect(entry?.key).toBe('key1');
      expect(entry?.value).toEqual({ value: 'test' });
      expect(entry?.version).toBe(1);
      expect(entry?.checksum).toBeDefined();
      expect(entry?.metadata.custom).toBe('meta');
    });
  });

  describe('delete', () => {
    it('should delete existing entry', () => {
      stateStore.set('key1', {});

      const result = stateStore.delete('key1');

      expect(result).toBe(true);
      expect(stateStore.get('key1')).toBeUndefined();
    });

    it('should return false for non-existent key', () => {
      const result = stateStore.delete('non-existent');
      expect(result).toBe(false);
    });

    it('should emit entryDeleted event', () => {
      const callback = jest.fn();
      stateStore.on('entryDeleted', callback);

      stateStore.set('key1', {});
      stateStore.delete('key1');

      expect(callback).toHaveBeenCalledWith('key1');
    });
  });

  describe('has', () => {
    it('should return true for existing key', () => {
      stateStore.set('key1', {});
      expect(stateStore.has('key1')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(stateStore.has('non-existent')).toBe(false);
    });
  });

  describe('keys/values/entries_list', () => {
    it('should return all keys', () => {
      stateStore.set('key1', {});
      stateStore.set('key2', {});

      const keys = stateStore.keys();

      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('should return all values', () => {
      stateStore.set('key1', { a: 1 });
      stateStore.set('key2', { b: 2 });

      const values = stateStore.values();

      expect(values).toContainEqual({ a: 1 });
      expect(values).toContainEqual({ b: 2 });
    });

    it('should return all entries', () => {
      stateStore.set('key1', { a: 1 });
      stateStore.set('key2', { b: 2 });

      const entries = stateStore.entries_list();

      expect(entries.length).toBe(2);
    });
  });

  describe('size', () => {
    it('should return correct size', () => {
      expect(stateStore.size()).toBe(0);

      stateStore.set('key1', {});
      stateStore.set('key2', {});

      expect(stateStore.size()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      stateStore.set('key1', {});
      stateStore.set('key2', {});

      stateStore.clear();

      expect(stateStore.size()).toBe(0);
    });

    it('should emit entryDeleted for each entry', () => {
      const callback = jest.fn();
      stateStore.on('entryDeleted', callback);

      stateStore.set('key1', {});
      stateStore.set('key2', {});
      stateStore.clear();

      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('transactions', () => {
    it('should begin transaction', () => {
      const txnId = stateStore.beginTransaction();

      expect(txnId).toBeDefined();
      expect(txnId).toMatch(/^txn_/);
    });

    it('should emit transactionStarted event', () => {
      const callback = jest.fn();
      stateStore.on('transactionStarted', callback);

      const txnId = stateStore.beginTransaction();

      expect(callback).toHaveBeenCalledWith(txnId);
    });

    it('should commit transaction with set operations', () => {
      const txnId = stateStore.beginTransaction();

      stateStore.transactionSet(txnId, 'key1', { value: 1 });
      stateStore.transactionSet(txnId, 'key2', { value: 2 });
      stateStore.commitTransaction(txnId);

      expect(stateStore.get('key1')).toEqual({ value: 1 });
      expect(stateStore.get('key2')).toEqual({ value: 2 });
    });

    it('should commit transaction with delete operations', () => {
      stateStore.set('key1', { value: 1 });

      const txnId = stateStore.beginTransaction();
      stateStore.transactionDelete(txnId, 'key1');
      stateStore.commitTransaction(txnId);

      expect(stateStore.get('key1')).toBeUndefined();
    });

    it('should emit transactionCommitted event', () => {
      const callback = jest.fn();
      stateStore.on('transactionCommitted', callback);

      const txnId = stateStore.beginTransaction();
      stateStore.commitTransaction(txnId);

      expect(callback).toHaveBeenCalledWith(txnId);
    });

    it('should rollback transaction', () => {
      stateStore.set('key1', { value: 1 });

      const txnId = stateStore.beginTransaction();
      stateStore.transactionSet(txnId, 'key1', { value: 2 });
      stateStore.rollbackTransaction(txnId);

      expect(stateStore.get('key1')).toEqual({ value: 1 });
    });

    it('should emit transactionRolledBack event', () => {
      const callback = jest.fn();
      stateStore.on('transactionRolledBack', callback);

      const txnId = stateStore.beginTransaction();
      stateStore.rollbackTransaction(txnId);

      expect(callback).toHaveBeenCalledWith(txnId);
    });

    it('should throw error for non-existent transaction', () => {
      expect(() => stateStore.transactionSet('invalid', 'key', {})).toThrow();
      expect(() => stateStore.transactionDelete('invalid', 'key')).toThrow();
      expect(() => stateStore.commitTransaction('invalid')).toThrow();
      expect(() => stateStore.rollbackTransaction('invalid')).toThrow();
    });

    it('should throw error for already committed transaction', () => {
      const txnId = stateStore.beginTransaction();
      stateStore.commitTransaction(txnId);

      expect(() => stateStore.transactionSet(txnId, 'key', {})).toThrow();
    });
  });

  describe('snapshots', () => {
    it('should create snapshot', () => {
      stateStore.set('key1', { value: 'test' });

      const snapshot = stateStore.createSnapshot('key1');

      expect(snapshot).toBeDefined();
      expect(snapshot?.stateId).toBe('key1');
      expect(snapshot?.data).toEqual({ value: 'test' });
    });

    it('should return null for non-existent key', () => {
      const snapshot = stateStore.createSnapshot('non-existent');
      expect(snapshot).toBeNull();
    });

    it('should get snapshot by key and version', () => {
      stateStore.set('key1', { value: 'test' });
      stateStore.createSnapshot('key1');

      const snapshot = stateStore.getSnapshot('key1', 1);

      expect(snapshot).toBeDefined();
      expect(snapshot?.version).toBe(1);
    });

    it('should restore from snapshot', () => {
      stateStore.set('key1', { value: 'original' });
      const snapshot = stateStore.createSnapshot('key1');

      stateStore.set('key1', { value: 'modified' });

      if (snapshot) {
        stateStore.restoreFromSnapshot(snapshot);
      }

      expect(stateStore.get('key1')).toEqual({ value: 'original' });
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      stateStore.set('key1', {});
      stateStore.createSnapshot('key1');
      stateStore.beginTransaction();

      const stats = stateStore.getStats();

      expect(stats.entryCount).toBe(1);
      expect(stats.snapshotCount).toBe(1);
      expect(stats.activeTransactions).toBe(1);
    });
  });
});
