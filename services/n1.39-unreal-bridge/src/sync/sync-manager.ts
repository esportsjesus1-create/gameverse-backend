import { EventEmitter } from 'eventemitter3';
import { LRUCache } from 'lru-cache';
import {
  StateSyncPayload,
  StateUpdatePayload,
  StateSnapshot
} from '../types';
import { StateError, ErrorCode } from '../utils/errors';
import { generateStateChecksum } from '../utils/checksum';
import pino from 'pino';

export interface SyncManagerConfig {
  maxStates: number;
  snapshotInterval: number;
  snapshotTTL: number;
  enableDeltaCompression: boolean;
}

export interface SyncManagerEvents {
  stateCreated: (stateId: string, version: number) => void;
  stateUpdated: (stateId: string, version: number, delta: unknown) => void;
  stateDeleted: (stateId: string) => void;
  conflictDetected: (stateId: string, clientVersion: number, serverVersion: number) => void;
}

interface StateEntry {
  stateId: string;
  version: number;
  data: unknown;
  checksum: string;
  subscribers: Set<string>;
  lastModified: number;
  createdAt: number;
}

export class SyncManager extends EventEmitter<SyncManagerEvents> {
  private readonly states: Map<string, StateEntry>;
  private readonly snapshots: LRUCache<string, StateSnapshot>;
  private readonly config: SyncManagerConfig;
  private readonly logger: pino.Logger;
  private snapshotTimer: NodeJS.Timeout | null = null;

  constructor(config: SyncManagerConfig, logger: pino.Logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.states = new Map();
    this.snapshots = new LRUCache({
      max: config.maxStates * 10,
      ttl: config.snapshotTTL
    });
  }

  start(): void {
    if (this.config.snapshotInterval > 0) {
      this.snapshotTimer = setInterval(() => {
        this.createSnapshots();
      }, this.config.snapshotInterval);
    }
    this.logger.info('SyncManager started');
  }

  stop(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    this.logger.info('SyncManager stopped');
  }

  createState(stateId: string, initialData: unknown): StateEntry {
    if (this.states.has(stateId)) {
      throw new StateError(
        ErrorCode.STATE_INVALID_OPERATION,
        `State already exists: ${stateId}`
      );
    }

    if (this.states.size >= this.config.maxStates) {
      throw new StateError(
        ErrorCode.STATE_INVALID_OPERATION,
        'Maximum state limit reached'
      );
    }

    const now = Date.now();
    const checksum = generateStateChecksum(initialData);

    const entry: StateEntry = {
      stateId,
      version: 1,
      data: initialData,
      checksum,
      subscribers: new Set(),
      lastModified: now,
      createdAt: now
    };

    this.states.set(stateId, entry);
    this.emit('stateCreated', stateId, 1);
    this.logger.debug({ stateId }, 'State created');

    return entry;
  }

  getState(stateId: string): StateEntry | undefined {
    return this.states.get(stateId);
  }

  updateState(stateId: string, data: unknown, expectedVersion?: number): StateEntry {
    const entry = this.states.get(stateId);
    if (!entry) {
      throw new StateError(ErrorCode.STATE_NOT_FOUND, `State not found: ${stateId}`);
    }

    if (expectedVersion !== undefined && entry.version !== expectedVersion) {
      this.emit('conflictDetected', stateId, expectedVersion, entry.version);
      throw new StateError(
        ErrorCode.STATE_VERSION_CONFLICT,
        `Version conflict: expected ${expectedVersion}, got ${entry.version}`,
        { expectedVersion, actualVersion: entry.version }
      );
    }

    const delta = this.config.enableDeltaCompression
      ? this.computeDelta(entry.data, data)
      : data;

    entry.version++;
    entry.data = data;
    entry.checksum = generateStateChecksum(data);
    entry.lastModified = Date.now();

    this.emit('stateUpdated', stateId, entry.version, delta);
    this.logger.debug({ stateId, version: entry.version }, 'State updated');

    return entry;
  }

  applyOperations(stateId: string, payload: StateUpdatePayload): StateEntry {
    const entry = this.states.get(stateId);
    if (!entry) {
      throw new StateError(ErrorCode.STATE_NOT_FOUND, `State not found: ${stateId}`);
    }

    if (payload.version !== entry.version) {
      this.emit('conflictDetected', stateId, payload.version, entry.version);
      throw new StateError(
        ErrorCode.STATE_VERSION_CONFLICT,
        `Version conflict: expected ${payload.version}, got ${entry.version}`
      );
    }

    let data = JSON.parse(JSON.stringify(entry.data));

    for (const op of payload.operations) {
      data = this.applyOperation(data, op);
    }

    return this.updateState(stateId, data, entry.version);
  }

  private applyOperation(
    data: unknown,
    op: { op: string; path: string; value?: unknown; from?: string }
  ): unknown {
    const pathParts = op.path.split('/').filter(p => p);
    
    if (pathParts.length === 0) {
      if (op.op === 'replace') return op.value;
      throw new StateError(ErrorCode.STATE_INVALID_OPERATION, 'Invalid operation path');
    }

    const result = JSON.parse(JSON.stringify(data));
    let current: Record<string, unknown> = result as Record<string, unknown>;
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      const key = pathParts[i];
      if (current[key] === undefined) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    const lastKey = pathParts[pathParts.length - 1];

    switch (op.op) {
      case 'add':
      case 'replace':
        current[lastKey] = op.value;
        break;
      case 'remove':
        delete current[lastKey];
        break;
      case 'move':
      case 'copy':
        if (op.from) {
          const fromParts = op.from.split('/').filter(p => p);
          let fromCurrent: Record<string, unknown> = result as Record<string, unknown>;
          for (let i = 0; i < fromParts.length - 1; i++) {
            fromCurrent = fromCurrent[fromParts[i]] as Record<string, unknown>;
          }
          const fromKey = fromParts[fromParts.length - 1];
          current[lastKey] = fromCurrent[fromKey];
          if (op.op === 'move') {
            delete fromCurrent[fromKey];
          }
        }
        break;
      default:
        throw new StateError(
          ErrorCode.STATE_INVALID_OPERATION,
          `Unknown operation: ${op.op}`
        );
    }

    return result;
  }

  deleteState(stateId: string): boolean {
    const deleted = this.states.delete(stateId);
    if (deleted) {
      this.emit('stateDeleted', stateId);
      this.logger.debug({ stateId }, 'State deleted');
    }
    return deleted;
  }

  subscribe(stateId: string, sessionId: string): boolean {
    const entry = this.states.get(stateId);
    if (!entry) return false;

    entry.subscribers.add(sessionId);
    this.logger.debug({ stateId, sessionId }, 'Session subscribed to state');
    return true;
  }

  unsubscribe(stateId: string, sessionId: string): boolean {
    const entry = this.states.get(stateId);
    if (!entry) return false;

    const removed = entry.subscribers.delete(sessionId);
    if (removed) {
      this.logger.debug({ stateId, sessionId }, 'Session unsubscribed from state');
    }
    return removed;
  }

  unsubscribeAll(sessionId: string): number {
    let count = 0;
    for (const entry of this.states.values()) {
      if (entry.subscribers.delete(sessionId)) {
        count++;
      }
    }
    return count;
  }

  getSubscribers(stateId: string): string[] {
    const entry = this.states.get(stateId);
    if (!entry) return [];
    return Array.from(entry.subscribers);
  }

  createSyncPayload(stateId: string, fullState = false): StateSyncPayload | null {
    const entry = this.states.get(stateId);
    if (!entry) return null;

    return {
      stateId: entry.stateId,
      version: entry.version,
      fullState,
      data: entry.data,
      checksum: entry.checksum
    };
  }

  private computeDelta(oldData: unknown, newData: unknown): unknown {
    return {
      old: oldData,
      new: newData,
      timestamp: Date.now()
    };
  }

  private createSnapshots(): void {
    const now = Date.now();
    let created = 0;

    for (const entry of this.states.values()) {
      const snapshotKey = `${entry.stateId}:${entry.version}`;
      
      if (!this.snapshots.has(snapshotKey)) {
        const snapshot: StateSnapshot = {
          stateId: entry.stateId,
          version: entry.version,
          data: JSON.parse(JSON.stringify(entry.data)),
          checksum: entry.checksum,
          createdAt: now,
          expiresAt: now + this.config.snapshotTTL
        };

        this.snapshots.set(snapshotKey, snapshot);
        created++;
      }
    }

    if (created > 0) {
      this.logger.debug({ created }, 'Created state snapshots');
    }
  }

  getSnapshot(stateId: string, version: number): StateSnapshot | undefined {
    return this.snapshots.get(`${stateId}:${version}`);
  }

  getStateCount(): number {
    return this.states.size;
  }

  getAllStateIds(): string[] {
    return Array.from(this.states.keys());
  }
}
