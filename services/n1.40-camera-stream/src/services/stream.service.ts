import { v4 as uuidv4 } from 'uuid';
import {
  Stream,
  StreamStatus,
  QualityPreset,
  CreateStreamDto,
  UpdateStreamDto,
  PaginationParams,
  PaginatedResult,
  CameraStatus
} from '../types';
import { getDefaultStreamSettings, config } from '../config';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import { cameraService } from './camera.service';
import logger from '../utils/logger';

const streams: Map<string, Stream> = new Map();

export class StreamService {
  async create(dto: CreateStreamDto): Promise<Stream> {
    await this.validateCreateDto(dto);

    const existingStream = Array.from(streams.values()).find(
      s => s.cameraId === dto.cameraId && 
      (s.status === StreamStatus.LIVE || s.status === StreamStatus.STARTING)
    );

    if (existingStream) {
      throw new ConflictError(`Camera ${dto.cameraId} is already streaming`);
    }

    const defaultSettings = getDefaultStreamSettings();
    const stream: Stream = {
      id: uuidv4(),
      cameraId: dto.cameraId,
      ownerId: dto.ownerId,
      title: dto.title,
      description: dto.description,
      status: StreamStatus.CREATED,
      quality: dto.quality || QualityPreset.AUTO,
      settings: {
        ...defaultSettings,
        ...dto.settings
      },
      viewerCount: 0,
      metadata: dto.metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    streams.set(stream.id, stream);
    logger.info(`Stream created: ${stream.id} for camera ${dto.cameraId}`);
    return stream;
  }

  async findById(id: string): Promise<Stream> {
    const stream = streams.get(id);
    if (!stream) {
      throw new NotFoundError('Stream', id);
    }
    return stream;
  }

  async findAll(params: PaginationParams & { 
    ownerId?: string; 
    status?: StreamStatus;
    cameraId?: string;
  }): Promise<PaginatedResult<Stream>> {
    let filteredStreams = Array.from(streams.values());

    if (params.ownerId) {
      filteredStreams = filteredStreams.filter(s => s.ownerId === params.ownerId);
    }

    if (params.status) {
      filteredStreams = filteredStreams.filter(s => s.status === params.status);
    }

    if (params.cameraId) {
      filteredStreams = filteredStreams.filter(s => s.cameraId === params.cameraId);
    }

    const total = filteredStreams.length;
    const totalPages = Math.ceil(total / params.limit);
    const start = (params.page - 1) * params.limit;
    const data = filteredStreams.slice(start, start + params.limit);

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

  async getLiveStreams(): Promise<Stream[]> {
    return Array.from(streams.values()).filter(s => s.status === StreamStatus.LIVE);
  }

  async update(id: string, dto: UpdateStreamDto): Promise<Stream> {
    const stream = await this.findById(id);
    this.validateUpdateDto(dto);

    const updatedStream: Stream = {
      ...stream,
      title: dto.title ?? stream.title,
      description: dto.description ?? stream.description,
      quality: dto.quality ?? stream.quality,
      settings: dto.settings
        ? { ...stream.settings, ...dto.settings }
        : stream.settings,
      metadata: dto.metadata ?? stream.metadata,
      updatedAt: new Date()
    };

    streams.set(id, updatedStream);
    logger.info(`Stream updated: ${id}`);
    return updatedStream;
  }

  async start(id: string): Promise<Stream> {
    const stream = await this.findById(id);

    if (stream.status === StreamStatus.LIVE) {
      throw new ConflictError('Stream is already live');
    }

    if (stream.status === StreamStatus.ENDED) {
      throw new ValidationError('Cannot restart an ended stream');
    }

    stream.status = StreamStatus.STARTING;
    stream.updatedAt = new Date();
    streams.set(id, stream);

    await cameraService.setStatus(stream.cameraId, CameraStatus.STREAMING);

    stream.status = StreamStatus.LIVE;
    stream.startedAt = new Date();
    stream.updatedAt = new Date();
    streams.set(id, stream);

    logger.info(`Stream started: ${id}`);
    return stream;
  }

  async stop(id: string): Promise<Stream> {
    const stream = await this.findById(id);

    if (stream.status === StreamStatus.ENDED) {
      throw new ValidationError('Stream has already ended');
    }

    if (stream.status !== StreamStatus.LIVE && stream.status !== StreamStatus.PAUSED) {
      throw new ValidationError('Stream is not active');
    }

    stream.status = StreamStatus.ENDED;
    stream.endedAt = new Date();
    stream.updatedAt = new Date();
    streams.set(id, stream);

    await cameraService.setStatus(stream.cameraId, CameraStatus.ONLINE);

    logger.info(`Stream stopped: ${id}`);
    return stream;
  }

  async pause(id: string): Promise<Stream> {
    const stream = await this.findById(id);

    if (stream.status !== StreamStatus.LIVE) {
      throw new ValidationError('Can only pause a live stream');
    }

    stream.status = StreamStatus.PAUSED;
    stream.updatedAt = new Date();
    streams.set(id, stream);

    logger.info(`Stream paused: ${id}`);
    return stream;
  }

  async resume(id: string): Promise<Stream> {
    const stream = await this.findById(id);

    if (stream.status !== StreamStatus.PAUSED) {
      throw new ValidationError('Can only resume a paused stream');
    }

    stream.status = StreamStatus.LIVE;
    stream.updatedAt = new Date();
    streams.set(id, stream);

    logger.info(`Stream resumed: ${id}`);
    return stream;
  }

  async delete(id: string): Promise<void> {
    const stream = await this.findById(id);

    if (stream.status === StreamStatus.LIVE || stream.status === StreamStatus.STARTING) {
      throw new ValidationError('Cannot delete an active stream');
    }

    streams.delete(id);
    logger.info(`Stream deleted: ${id}`);
  }

  async updateViewerCount(id: string, count: number): Promise<Stream> {
    const stream = await this.findById(id);
    stream.viewerCount = Math.max(0, count);
    stream.updatedAt = new Date();
    streams.set(id, stream);
    return stream;
  }

  async incrementViewerCount(id: string): Promise<Stream> {
    const stream = await this.findById(id);
    stream.viewerCount++;
    stream.updatedAt = new Date();
    streams.set(id, stream);
    return stream;
  }

  async decrementViewerCount(id: string): Promise<Stream> {
    const stream = await this.findById(id);
    stream.viewerCount = Math.max(0, stream.viewerCount - 1);
    stream.updatedAt = new Date();
    streams.set(id, stream);
    return stream;
  }

  async setQuality(id: string, quality: QualityPreset): Promise<Stream> {
    const stream = await this.findById(id);
    
    const qualityLevel = config.quality.presets.find(p => p.preset === quality);
    if (qualityLevel) {
      stream.quality = quality;
      stream.settings = {
        ...stream.settings,
        resolution: qualityLevel.resolution,
        framerate: qualityLevel.framerate,
        bitrate: qualityLevel.bitrate
      };
    } else {
      stream.quality = quality;
    }

    stream.updatedAt = new Date();
    streams.set(id, stream);
    logger.info(`Stream ${id} quality changed to ${quality}`);
    return stream;
  }

  private async validateCreateDto(dto: CreateStreamDto): Promise<void> {
    const errors: string[] = [];

    if (!dto.cameraId || dto.cameraId.trim().length === 0) {
      errors.push('Camera ID is required');
    }

    if (!dto.ownerId || dto.ownerId.trim().length === 0) {
      errors.push('Owner ID is required');
    }

    if (!dto.title || dto.title.trim().length === 0) {
      errors.push('Stream title is required');
    }

    if (dto.title && dto.title.length > 200) {
      errors.push('Stream title must be 200 characters or less');
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid stream data', errors);
    }

    try {
      await cameraService.findById(dto.cameraId);
    } catch {
      throw new ValidationError('Camera not found');
    }
  }

  private validateUpdateDto(dto: UpdateStreamDto): void {
    const errors: string[] = [];

    if (dto.title !== undefined && dto.title.trim().length === 0) {
      errors.push('Stream title cannot be empty');
    }

    if (dto.title && dto.title.length > 200) {
      errors.push('Stream title must be 200 characters or less');
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid stream data', errors);
    }
  }

  clear(): void {
    streams.clear();
  }
}

export const streamService = new StreamService();
