import { EventEmitter } from 'eventemitter3';
import { LRUCache } from 'lru-cache';
import {
  AssetManifest,
  AssetRequestPayload,
  AssetChunkPayload
} from '../types';
import { AssetError, ErrorCode } from '../utils/errors';
import { calculateChecksum } from '../utils/checksum';
import pino from 'pino';

export interface AssetManagerConfig {
  maxAssets: number;
  defaultChunkSize: number;
  maxConcurrentTransfers: number;
  transferTimeout: number;
  cacheSize: number;
}

export interface AssetManagerEvents {
  assetRegistered: (manifest: AssetManifest) => void;
  assetRemoved: (assetId: string) => void;
  transferStarted: (assetId: string, sessionId: string) => void;
  transferProgress: (assetId: string, sessionId: string, progress: number) => void;
  transferCompleted: (assetId: string, sessionId: string) => void;
  transferFailed: (assetId: string, sessionId: string, error: Error) => void;
}

interface AssetTransfer {
  assetId: string;
  sessionId: string;
  currentChunk: number;
  totalChunks: number;
  bytesTransferred: number;
  startedAt: number;
  lastActivity: number;
  priority: number;
}

export class AssetManager extends EventEmitter<AssetManagerEvents> {
  private readonly manifests: Map<string, AssetManifest>;
  private readonly assetData: Map<string, Buffer>;
  private readonly activeTransfers: Map<string, AssetTransfer>;
  private readonly chunkCache: LRUCache<string, Buffer>;
  private readonly config: AssetManagerConfig;
  private readonly logger: pino.Logger;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: AssetManagerConfig, logger: pino.Logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.manifests = new Map();
    this.assetData = new Map();
    this.activeTransfers = new Map();
    this.chunkCache = new LRUCache({
      max: config.cacheSize,
      maxSize: config.cacheSize * config.defaultChunkSize,
      sizeCalculation: (value: Buffer) => value.length
    });
  }

  start(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleTransfers();
    }, this.config.transferTimeout / 2);
    this.logger.info('AssetManager started');
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.activeTransfers.clear();
    this.logger.info('AssetManager stopped');
  }

  registerAsset(
    assetId: string,
    assetType: AssetManifest['assetType'],
    fileName: string,
    data: Buffer,
    metadata: Record<string, unknown> = {}
  ): AssetManifest {
    if (this.manifests.size >= this.config.maxAssets) {
      throw new AssetError(
        ErrorCode.ASSET_TRANSFER_ERROR,
        'Maximum asset limit reached'
      );
    }

    const checksum = calculateChecksum(data);
    const chunkSize = this.config.defaultChunkSize;
    const totalChunks = Math.ceil(data.length / chunkSize);
    const now = Date.now();

    const manifest: AssetManifest = {
      assetId,
      assetType,
      fileName,
      fileSize: data.length,
      checksum,
      chunkSize,
      totalChunks,
      metadata,
      createdAt: now,
      updatedAt: now
    };

    this.manifests.set(assetId, manifest);
    this.assetData.set(assetId, data);

    this.emit('assetRegistered', manifest);
    this.logger.info({ assetId, fileSize: data.length }, 'Asset registered');

    return manifest;
  }

  getManifest(assetId: string): AssetManifest | undefined {
    return this.manifests.get(assetId);
  }

  removeAsset(assetId: string): boolean {
    const removed = this.manifests.delete(assetId);
    this.assetData.delete(assetId);

    for (let i = 0; i < (this.manifests.get(assetId)?.totalChunks || 0); i++) {
      this.chunkCache.delete(`${assetId}:${i}`);
    }

    if (removed) {
      this.emit('assetRemoved', assetId);
      this.logger.info({ assetId }, 'Asset removed');
    }

    return removed;
  }

  startTransfer(request: AssetRequestPayload, sessionId: string): AssetManifest {
    const manifest = this.manifests.get(request.assetId);
    if (!manifest) {
      throw new AssetError(
        ErrorCode.ASSET_NOT_FOUND,
        `Asset not found: ${request.assetId}`
      );
    }

    const activeCount = this.getActiveTransferCount(sessionId);
    if (activeCount >= this.config.maxConcurrentTransfers) {
      throw new AssetError(
        ErrorCode.ASSET_TRANSFER_ERROR,
        'Maximum concurrent transfers reached'
      );
    }

    const transferKey = `${request.assetId}:${sessionId}`;
    const startChunk = request.resumeFrom
      ? Math.floor(request.resumeFrom / manifest.chunkSize)
      : 0;

    const transfer: AssetTransfer = {
      assetId: request.assetId,
      sessionId,
      currentChunk: startChunk,
      totalChunks: manifest.totalChunks,
      bytesTransferred: startChunk * manifest.chunkSize,
      startedAt: Date.now(),
      lastActivity: Date.now(),
      priority: request.priority
    };

    this.activeTransfers.set(transferKey, transfer);
    this.emit('transferStarted', request.assetId, sessionId);
    this.logger.debug({ assetId: request.assetId, sessionId }, 'Transfer started');

    return manifest;
  }

  getNextChunk(assetId: string, sessionId: string): AssetChunkPayload | null {
    const transferKey = `${assetId}:${sessionId}`;
    const transfer = this.activeTransfers.get(transferKey);
    
    if (!transfer) {
      return null;
    }

    const manifest = this.manifests.get(assetId);
    const data = this.assetData.get(assetId);
    
    if (!manifest || !data) {
      this.activeTransfers.delete(transferKey);
      return null;
    }

    if (transfer.currentChunk >= transfer.totalChunks) {
      this.completeTransfer(assetId, sessionId);
      return null;
    }

    const chunkKey = `${assetId}:${transfer.currentChunk}`;
    let chunkData = this.chunkCache.get(chunkKey);

    if (!chunkData) {
      const start = transfer.currentChunk * manifest.chunkSize;
      const end = Math.min(start + manifest.chunkSize, data.length);
      chunkData = data.subarray(start, end);
      this.chunkCache.set(chunkKey, Buffer.from(chunkData));
    }

    const chunkChecksum = calculateChecksum(chunkData);

    const payload: AssetChunkPayload = {
      assetId,
      chunkIndex: transfer.currentChunk,
      totalChunks: transfer.totalChunks,
      data: chunkData.toString('base64'),
      checksum: chunkChecksum,
      bytesTotal: manifest.fileSize,
      bytesTransferred: transfer.bytesTransferred + chunkData.length
    };

    transfer.currentChunk++;
    transfer.bytesTransferred = payload.bytesTransferred;
    transfer.lastActivity = Date.now();

    const progress = (transfer.currentChunk / transfer.totalChunks) * 100;
    this.emit('transferProgress', assetId, sessionId, progress);

    return payload;
  }

  completeTransfer(assetId: string, sessionId: string): void {
    const transferKey = `${assetId}:${sessionId}`;
    const transfer = this.activeTransfers.get(transferKey);

    if (transfer) {
      this.activeTransfers.delete(transferKey);
      this.emit('transferCompleted', assetId, sessionId);
      this.logger.info({ assetId, sessionId }, 'Transfer completed');
    }
  }

  cancelTransfer(assetId: string, sessionId: string): boolean {
    const transferKey = `${assetId}:${sessionId}`;
    const removed = this.activeTransfers.delete(transferKey);

    if (removed) {
      this.emit('transferFailed', assetId, sessionId, new Error('Transfer cancelled'));
      this.logger.info({ assetId, sessionId }, 'Transfer cancelled');
    }

    return removed;
  }

  cancelAllTransfers(sessionId: string): number {
    let count = 0;

    for (const [key, transfer] of this.activeTransfers) {
      if (transfer.sessionId === sessionId) {
        this.activeTransfers.delete(key);
        this.emit('transferFailed', transfer.assetId, sessionId, new Error('Session disconnected'));
        count++;
      }
    }

    return count;
  }

  getTransferStatus(assetId: string, sessionId: string): AssetTransfer | undefined {
    return this.activeTransfers.get(`${assetId}:${sessionId}`);
  }

  getActiveTransferCount(sessionId: string): number {
    let count = 0;
    for (const transfer of this.activeTransfers.values()) {
      if (transfer.sessionId === sessionId) {
        count++;
      }
    }
    return count;
  }

  private cleanupStaleTransfers(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, transfer] of this.activeTransfers) {
      if (now - transfer.lastActivity > this.config.transferTimeout) {
        this.activeTransfers.delete(key);
        this.emit(
          'transferFailed',
          transfer.assetId,
          transfer.sessionId,
          new Error('Transfer timeout')
        );
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.info({ cleaned }, 'Cleaned up stale transfers');
    }
  }

  getAssetCount(): number {
    return this.manifests.size;
  }

  getTotalTransferCount(): number {
    return this.activeTransfers.size;
  }

  getAllManifests(): AssetManifest[] {
    return Array.from(this.manifests.values());
  }
}
