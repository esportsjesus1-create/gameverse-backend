import { EventEmitter } from 'eventemitter3';
import { LRUCache } from 'lru-cache';
import { StateSnapshot } from '../types';
import { StateError, ErrorCode } from '../utils/errors';
import { generateStateChecksum } from '../utils/checksum';
import pino from 'pino';

export interface StateStoreConfig {
  maxEntries: number;
  snapshotCapacity: number;
  enablePersistence: boolean;
  transactionTimeout: number;
}

export interface StateStoreEvents {
  entryCreated: (key: string, value: unknown) => void;
  entryUpdated: (key: string, oldValue: unknown, newValue: unknown) => void;
  entryDeleted: (key: string) => void;
  transactionStarted: (transactionId: string) => void;
  transactionCommitted: (transactionId: string) => void;
  transactionRolledBack: (transactionId: string) => void;
}

interface StateEntry {
  key: string;
  value: unknown;
  version: number;
  checksum: string;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

interface Transaction {
  id: string;
  operations: Array<{
    type: 'set' | 'delete';
    key: string;
    value?: unknown;
    previousValue?: unknown;
  }>;
  startedAt: number;
  committed: boolean;
}

export class StateStore extends EventEmitter<StateStoreEvents> {
  private readonly entries: Map<string, StateEntry>;
  private readonly snapshots: LRUCache<string, StateSnapshot>;
  private readonly transactions: Map<string, Transaction>;
  private readonly config: StateStoreConfig;
  private readonly logger: pino.Logger;
  private transactionCounter = 0;

  constructor(config: StateStoreConfig, logger: pino.Logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.entries = new Map();
    this.transactions = new Map();
    this.snapshots = new LRUCache({
      max: config.snapshotCapacity
    });
  }

  get(key: string): unknown | undefined {
    const entry = this.entries.get(key);
    return entry?.value;
  }

  getEntry(key: string): StateEntry | undefined {
    return this.entries.get(key);
  }

  set(key: string, value: unknown, metadata: Record<string, unknown> = {}): StateEntry {
    if (this.entries.size >= this.config.maxEntries && !this.entries.has(key)) {
      throw new StateError(
        ErrorCode.STATE_INVALID_OPERATION,
        'Maximum state entries reached'
      );
    }

    const existing = this.entries.get(key);
    const now = Date.now();
    const checksum = generateStateChecksum(value);

    const entry: StateEntry = {
      key,
      value,
      version: existing ? existing.version + 1 : 1,
      checksum,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      metadata: { ...existing?.metadata, ...metadata }
    };

    this.entries.set(key, entry);

    if (existing) {
      this.emit('entryUpdated', key, existing.value, value);
      this.logger.debug({ key, version: entry.version }, 'State entry updated');
    } else {
      this.emit('entryCreated', key, value);
      this.logger.debug({ key }, 'State entry created');
    }

    return entry;
  }

  delete(key: string): boolean {
    const deleted = this.entries.delete(key);
    if (deleted) {
      this.emit('entryDeleted', key);
      this.logger.debug({ key }, 'State entry deleted');
    }
    return deleted;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  keys(): string[] {
    return Array.from(this.entries.keys());
  }

  values(): unknown[] {
    return Array.from(this.entries.values()).map(e => e.value);
  }

  entries_list(): Array<[string, unknown]> {
    return Array.from(this.entries.entries()).map(([k, v]) => [k, v.value]);
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    const keys = Array.from(this.entries.keys());
    this.entries.clear();
    for (const key of keys) {
      this.emit('entryDeleted', key);
    }
    this.logger.info('State store cleared');
  }

  beginTransaction(): string {
    const transactionId = `txn_${++this.transactionCounter}_${Date.now()}`;

    const transaction: Transaction = {
      id: transactionId,
      operations: [],
      startedAt: Date.now(),
      committed: false
    };

    this.transactions.set(transactionId, transaction);
    this.emit('transactionStarted', transactionId);
    this.logger.debug({ transactionId }, 'Transaction started');

    return transactionId;
  }

  transactionSet(transactionId: string, key: string, value: unknown): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new StateError(
        ErrorCode.STATE_INVALID_OPERATION,
        `Transaction not found: ${transactionId}`
      );
    }

    if (transaction.committed) {
      throw new StateError(
        ErrorCode.STATE_INVALID_OPERATION,
        'Transaction already committed'
      );
    }

    const existing = this.entries.get(key);
    transaction.operations.push({
      type: 'set',
      key,
      value,
      previousValue: existing?.value
    });
  }

  transactionDelete(transactionId: string, key: string): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new StateError(
        ErrorCode.STATE_INVALID_OPERATION,
        `Transaction not found: ${transactionId}`
      );
    }

    if (transaction.committed) {
      throw new StateError(
        ErrorCode.STATE_INVALID_OPERATION,
        'Transaction already committed'
      );
    }

    const existing = this.entries.get(key);
    transaction.operations.push({
      type: 'delete',
      key,
      previousValue: existing?.value
    });
  }

  commitTransaction(transactionId: string): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new StateError(
        ErrorCode.STATE_INVALID_OPERATION,
        `Transaction not found: ${transactionId}`
      );
    }

    if (transaction.committed) {
      throw new StateError(
        ErrorCode.STATE_INVALID_OPERATION,
        'Transaction already committed'
      );
    }

    for (const op of transaction.operations) {
      if (op.type === 'set') {
        this.set(op.key, op.value);
      } else if (op.type === 'delete') {
        this.delete(op.key);
      }
    }

    transaction.committed = true;
    this.emit('transactionCommitted', transactionId);
    this.logger.debug({ transactionId, operations: transaction.operations.length }, 'Transaction committed');

    this.transactions.delete(transactionId);
  }

  rollbackTransaction(transactionId: string): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new StateError(
        ErrorCode.STATE_INVALID_OPERATION,
        `Transaction not found: ${transactionId}`
      );
    }

    this.transactions.delete(transactionId);
    this.emit('transactionRolledBack', transactionId);
    this.logger.debug({ transactionId }, 'Transaction rolled back');
  }

  createSnapshot(key: string): StateSnapshot | null {
    const entry = this.entries.get(key);
    if (!entry) return null;

    const now = Date.now();
    const snapshot: StateSnapshot = {
      stateId: key,
      version: entry.version,
      data: JSON.parse(JSON.stringify(entry.value)),
      checksum: entry.checksum,
      createdAt: now,
      expiresAt: now + 3600000
    };

    const snapshotKey = `${key}:${entry.version}`;
    this.snapshots.set(snapshotKey, snapshot);

    this.logger.debug({ key, version: entry.version }, 'Snapshot created');

    return snapshot;
  }

  getSnapshot(key: string, version: number): StateSnapshot | undefined {
    return this.snapshots.get(`${key}:${version}`);
  }

  restoreFromSnapshot(snapshot: StateSnapshot): StateEntry {
    return this.set(snapshot.stateId, snapshot.data, {
      restoredFrom: snapshot.version,
      restoredAt: Date.now()
    });
  }

  getStats(): {
    entryCount: number;
    snapshotCount: number;
    activeTransactions: number;
  } {
    return {
      entryCount: this.entries.size,
      snapshotCount: this.snapshots.size,
      activeTransactions: this.transactions.size
    };
  }
}
