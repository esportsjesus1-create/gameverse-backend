import { v4 as uuidv4 } from 'uuid';
import {
  Recording,
  RecordingStatus,
  RecordingFormat,
  StartRecordingDto,
  PaginationParams,
  PaginatedResult,
  StreamStatus
} from '../types';
import { config } from '../config';
import { NotFoundError, ValidationError, ConflictError, RecordingError } from '../utils/errors';
import { streamService } from './stream.service';
import logger from '../utils/logger';

const recordings: Map<string, Recording> = new Map();

export class RecordingService {
  async start(dto: StartRecordingDto): Promise<Recording> {
    await this.validateStartDto(dto);

    const stream = await streamService.findById(dto.streamId);

    const existingRecording = Array.from(recordings.values()).find(
      r => r.streamId === dto.streamId && r.status === RecordingStatus.RECORDING
    );

    if (existingRecording) {
      throw new ConflictError(`Stream ${dto.streamId} is already being recorded`);
    }

    const recording: Recording = {
      id: uuidv4(),
      streamId: dto.streamId,
      cameraId: stream.cameraId,
      ownerId: stream.ownerId,
      status: RecordingStatus.PENDING,
      format: dto.format || RecordingFormat.WEBM,
      metadata: dto.metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    recordings.set(recording.id, recording);

    recording.status = RecordingStatus.RECORDING;
    recording.startedAt = new Date();
    recording.filePath = `${config.recording.storagePath}/${recording.id}.${recording.format}`;
    recording.updatedAt = new Date();
    recordings.set(recording.id, recording);

    logger.info(`Recording started: ${recording.id} for stream ${dto.streamId}`);
    return recording;
  }

  async findById(id: string): Promise<Recording> {
    const recording = recordings.get(id);
    if (!recording) {
      throw new NotFoundError('Recording', id);
    }
    return recording;
  }

  async findAll(params: PaginationParams & {
    ownerId?: string;
    streamId?: string;
    status?: RecordingStatus;
  }): Promise<PaginatedResult<Recording>> {
    let filteredRecordings = Array.from(recordings.values());

    if (params.ownerId) {
      filteredRecordings = filteredRecordings.filter(r => r.ownerId === params.ownerId);
    }

    if (params.streamId) {
      filteredRecordings = filteredRecordings.filter(r => r.streamId === params.streamId);
    }

    if (params.status) {
      filteredRecordings = filteredRecordings.filter(r => r.status === params.status);
    }

    const total = filteredRecordings.length;
    const totalPages = Math.ceil(total / params.limit);
    const start = (params.page - 1) * params.limit;
    const data = filteredRecordings.slice(start, start + params.limit);

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

  async findByStream(streamId: string): Promise<Recording[]> {
    return Array.from(recordings.values()).filter(r => r.streamId === streamId);
  }

  async stop(id: string): Promise<Recording> {
    const recording = await this.findById(id);

    if (recording.status !== RecordingStatus.RECORDING && recording.status !== RecordingStatus.PAUSED) {
      throw new ValidationError('Recording is not active');
    }

    recording.status = RecordingStatus.COMPLETED;
    recording.endedAt = new Date();
    recording.duration = recording.startedAt
      ? Math.floor((recording.endedAt.getTime() - recording.startedAt.getTime()) / 1000)
      : 0;
    recording.fileSize = Math.floor(Math.random() * 100000000);
    recording.updatedAt = new Date();
    recordings.set(id, recording);

    logger.info(`Recording stopped: ${id}, duration: ${recording.duration}s`);
    return recording;
  }

  async pause(id: string): Promise<Recording> {
    const recording = await this.findById(id);

    if (recording.status !== RecordingStatus.RECORDING) {
      throw new ValidationError('Can only pause an active recording');
    }

    recording.status = RecordingStatus.PAUSED;
    recording.updatedAt = new Date();
    recordings.set(id, recording);

    logger.info(`Recording paused: ${id}`);
    return recording;
  }

  async resume(id: string): Promise<Recording> {
    const recording = await this.findById(id);

    if (recording.status !== RecordingStatus.PAUSED) {
      throw new ValidationError('Can only resume a paused recording');
    }

    recording.status = RecordingStatus.RECORDING;
    recording.updatedAt = new Date();
    recordings.set(id, recording);

    logger.info(`Recording resumed: ${id}`);
    return recording;
  }

  async delete(id: string): Promise<void> {
    const recording = await this.findById(id);

    if (recording.status === RecordingStatus.RECORDING) {
      throw new ValidationError('Cannot delete an active recording');
    }

    recordings.delete(id);
    logger.info(`Recording deleted: ${id}`);
  }

  async getStorageUsage(ownerId: string): Promise<{ used: number; limit: number; percentage: number }> {
    const ownerRecordings = Array.from(recordings.values()).filter(
      r => r.ownerId === ownerId && r.fileSize
    );

    const used = ownerRecordings.reduce((sum, r) => sum + (r.fileSize || 0), 0);
    const limit = config.recording.maxSizeMB * 1024 * 1024;
    const percentage = (used / limit) * 100;

    return { used, limit, percentage };
  }

  async setFailed(id: string, error: string): Promise<Recording> {
    const recording = await this.findById(id);
    recording.status = RecordingStatus.FAILED;
    recording.metadata = { ...recording.metadata, error };
    recording.updatedAt = new Date();
    recordings.set(id, recording);

    logger.error(`Recording failed: ${id}, error: ${error}`);
    return recording;
  }

  private async validateStartDto(dto: StartRecordingDto): Promise<void> {
    const errors: string[] = [];

    if (!dto.streamId || dto.streamId.trim().length === 0) {
      errors.push('Stream ID is required');
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid recording data', errors);
    }

    try {
      const stream = await streamService.findById(dto.streamId);
      if (stream.status !== StreamStatus.LIVE) {
        throw new RecordingError('Can only record a live stream');
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new ValidationError('Stream not found');
      }
      throw error;
    }
  }

  clear(): void {
    recordings.clear();
  }
}

export const recordingService = new RecordingService();
