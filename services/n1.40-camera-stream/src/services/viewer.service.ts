import { v4 as uuidv4 } from 'uuid';
import {
  Viewer,
  ConnectionState,
  QualityPreset,
  BandwidthStats,
  PaginationParams,
  PaginatedResult,
  StreamStatus
} from '../types';
import { config } from '../config';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { streamService } from './stream.service';
import logger from '../utils/logger';

const viewers: Map<string, Viewer> = new Map();

export class ViewerService {
  async join(streamId: string, userId?: string): Promise<Viewer> {
    const stream = await streamService.findById(streamId);

    if (stream.status !== StreamStatus.LIVE) {
      throw new ValidationError('Cannot join a stream that is not live');
    }

    if (stream.viewerCount >= config.stream.maxViewersPerStream) {
      throw new ForbiddenError('Stream has reached maximum viewer capacity');
    }

    const viewer: Viewer = {
      id: uuidv4(),
      streamId,
      sessionId: uuidv4(),
      userId,
      connectionState: ConnectionState.CONNECTING,
      quality: QualityPreset.AUTO,
      bandwidth: {
        estimatedBandwidth: 0,
        currentBitrate: 0,
        packetLoss: 0,
        latency: 0,
        jitter: 0
      },
      joinedAt: new Date(),
      lastActiveAt: new Date()
    };

    viewers.set(viewer.id, viewer);
    await streamService.incrementViewerCount(streamId);

    logger.info(`Viewer ${viewer.id} joined stream ${streamId}`);
    return viewer;
  }

  async findById(id: string): Promise<Viewer> {
    const viewer = viewers.get(id);
    if (!viewer) {
      throw new NotFoundError('Viewer', id);
    }
    return viewer;
  }

  async findByStream(streamId: string): Promise<Viewer[]> {
    return Array.from(viewers.values()).filter(v => v.streamId === streamId);
  }

  async findAll(params: PaginationParams & {
    streamId?: string;
    userId?: string;
    connectionState?: ConnectionState;
  }): Promise<PaginatedResult<Viewer>> {
    let filteredViewers = Array.from(viewers.values());

    if (params.streamId) {
      filteredViewers = filteredViewers.filter(v => v.streamId === params.streamId);
    }

    if (params.userId) {
      filteredViewers = filteredViewers.filter(v => v.userId === params.userId);
    }

    if (params.connectionState) {
      filteredViewers = filteredViewers.filter(v => v.connectionState === params.connectionState);
    }

    const total = filteredViewers.length;
    const totalPages = Math.ceil(total / params.limit);
    const start = (params.page - 1) * params.limit;
    const data = filteredViewers.slice(start, start + params.limit);

    return {
      data,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages
      }
    };
  }

  async leave(id: string): Promise<void> {
    const viewer = await this.findById(id);

    viewer.connectionState = ConnectionState.DISCONNECTED;
    viewer.lastActiveAt = new Date();
    viewers.set(id, viewer);

    try {
      await streamService.decrementViewerCount(viewer.streamId);
    } catch {
      logger.warn(`Failed to decrement viewer count for stream ${viewer.streamId}`);
    }

    viewers.delete(id);
    logger.info(`Viewer ${id} left stream ${viewer.streamId}`);
  }

  async setConnectionState(id: string, state: ConnectionState): Promise<Viewer> {
    const viewer = await this.findById(id);
    viewer.connectionState = state;
    viewer.lastActiveAt = new Date();
    viewers.set(id, viewer);

    logger.debug(`Viewer ${id} connection state changed to ${state}`);
    return viewer;
  }

  async setQuality(id: string, quality: QualityPreset): Promise<Viewer> {
    const viewer = await this.findById(id);
    viewer.quality = quality;
    viewer.lastActiveAt = new Date();
    viewers.set(id, viewer);

    logger.debug(`Viewer ${id} quality changed to ${quality}`);
    return viewer;
  }

  async updateBandwidth(id: string, stats: Partial<BandwidthStats>): Promise<Viewer> {
    const viewer = await this.findById(id);
    viewer.bandwidth = { ...viewer.bandwidth, ...stats };
    viewer.lastActiveAt = new Date();
    viewers.set(id, viewer);
    return viewer;
  }

  async getStreamViewerCount(streamId: string): Promise<number> {
    const streamViewers = Array.from(viewers.values()).filter(
      v => v.streamId === streamId && v.connectionState === ConnectionState.CONNECTED
    );
    return streamViewers.length;
  }

  async getStreamStats(streamId: string): Promise<{
    totalViewers: number;
    connectedViewers: number;
    averageBandwidth: number;
    averageLatency: number;
    qualityDistribution: Record<QualityPreset, number>;
  }> {
    const streamViewers = Array.from(viewers.values()).filter(v => v.streamId === streamId);
    const connectedViewers = streamViewers.filter(v => v.connectionState === ConnectionState.CONNECTED);

    const qualityDistribution: Record<QualityPreset, number> = {
      [QualityPreset.LOW]: 0,
      [QualityPreset.MEDIUM]: 0,
      [QualityPreset.HIGH]: 0,
      [QualityPreset.ULTRA]: 0,
      [QualityPreset.AUTO]: 0
    };

    let totalBandwidth = 0;
    let totalLatency = 0;

    for (const viewer of connectedViewers) {
      qualityDistribution[viewer.quality]++;
      totalBandwidth += viewer.bandwidth.estimatedBandwidth;
      totalLatency += viewer.bandwidth.latency;
    }

    const count = connectedViewers.length || 1;

    return {
      totalViewers: streamViewers.length,
      connectedViewers: connectedViewers.length,
      averageBandwidth: totalBandwidth / count,
      averageLatency: totalLatency / count,
      qualityDistribution
    };
  }

  async heartbeat(id: string): Promise<Viewer> {
    const viewer = await this.findById(id);
    viewer.lastActiveAt = new Date();
    viewers.set(id, viewer);
    return viewer;
  }

  async cleanupInactiveViewers(maxInactiveMs: number = 60000): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, viewer] of viewers) {
      if (now - viewer.lastActiveAt.getTime() > maxInactiveMs) {
        try {
          await this.leave(id);
          cleaned++;
        } catch {
          viewers.delete(id);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} inactive viewers`);
    }

    return cleaned;
  }

  async disconnectAllFromStream(streamId: string): Promise<number> {
    const streamViewers = Array.from(viewers.values()).filter(v => v.streamId === streamId);
    
    for (const viewer of streamViewers) {
      viewer.connectionState = ConnectionState.DISCONNECTED;
      viewers.delete(viewer.id);
    }

    logger.info(`Disconnected ${streamViewers.length} viewers from stream ${streamId}`);
    return streamViewers.length;
  }

  clear(): void {
    viewers.clear();
  }
}

export const viewerService = new ViewerService();
