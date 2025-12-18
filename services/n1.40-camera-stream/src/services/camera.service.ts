import { v4 as uuidv4 } from 'uuid';
import {
  Camera,
  CameraStatus,
  CreateCameraDto,
  UpdateCameraDto,
  PaginationParams,
  PaginatedResult
} from '../types';
import { getDefaultCameraCapabilities } from '../config';
import { NotFoundError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';

const cameras: Map<string, Camera> = new Map();

export class CameraService {
  async create(dto: CreateCameraDto): Promise<Camera> {
    this.validateCreateDto(dto);

    const camera: Camera = {
      id: uuidv4(),
      name: dto.name,
      description: dto.description,
      ownerId: dto.ownerId,
      deviceId: dto.deviceId,
      capabilities: {
        ...getDefaultCameraCapabilities(),
        ...dto.capabilities
      },
      status: CameraStatus.OFFLINE,
      metadata: dto.metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    cameras.set(camera.id, camera);
    logger.info(`Camera created: ${camera.id}`);
    return camera;
  }

  async findById(id: string): Promise<Camera> {
    const camera = cameras.get(id);
    if (!camera) {
      throw new NotFoundError('Camera', id);
    }
    return camera;
  }

  async findAll(params: PaginationParams & { ownerId?: string; status?: CameraStatus }): Promise<PaginatedResult<Camera>> {
    let filteredCameras = Array.from(cameras.values());

    if (params.ownerId) {
      filteredCameras = filteredCameras.filter(c => c.ownerId === params.ownerId);
    }

    if (params.status) {
      filteredCameras = filteredCameras.filter(c => c.status === params.status);
    }

    const total = filteredCameras.length;
    const totalPages = Math.ceil(total / params.limit);
    const start = (params.page - 1) * params.limit;
    const data = filteredCameras.slice(start, start + params.limit);

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

  async findByOwner(ownerId: string): Promise<Camera[]> {
    return Array.from(cameras.values()).filter(c => c.ownerId === ownerId);
  }

  async update(id: string, dto: UpdateCameraDto): Promise<Camera> {
    const camera = await this.findById(id);
    this.validateUpdateDto(dto);

    const updatedCamera: Camera = {
      ...camera,
      name: dto.name ?? camera.name,
      description: dto.description ?? camera.description,
      deviceId: dto.deviceId ?? camera.deviceId,
      capabilities: dto.capabilities
        ? { ...camera.capabilities, ...dto.capabilities }
        : camera.capabilities,
      status: dto.status ?? camera.status,
      metadata: dto.metadata ?? camera.metadata,
      updatedAt: new Date()
    };

    cameras.set(id, updatedCamera);
    logger.info(`Camera updated: ${id}`);
    return updatedCamera;
  }

  async delete(id: string): Promise<void> {
    const camera = await this.findById(id);
    
    if (camera.status === CameraStatus.STREAMING) {
      throw new ValidationError('Cannot delete camera while streaming');
    }

    cameras.delete(id);
    logger.info(`Camera deleted: ${id}`);
  }

  async setStatus(id: string, status: CameraStatus): Promise<Camera> {
    const camera = await this.findById(id);
    camera.status = status;
    camera.updatedAt = new Date();
    cameras.set(id, camera);
    logger.debug(`Camera ${id} status changed to ${status}`);
    return camera;
  }

  async getOnlineCameras(ownerId?: string): Promise<Camera[]> {
    let result = Array.from(cameras.values()).filter(
      c => c.status === CameraStatus.ONLINE || c.status === CameraStatus.STREAMING
    );

    if (ownerId) {
      result = result.filter(c => c.ownerId === ownerId);
    }

    return result;
  }

  private validateCreateDto(dto: CreateCameraDto): void {
    const errors: string[] = [];

    if (!dto.name || dto.name.trim().length === 0) {
      errors.push('Camera name is required');
    }

    if (!dto.ownerId || dto.ownerId.trim().length === 0) {
      errors.push('Owner ID is required');
    }

    if (dto.name && dto.name.length > 100) {
      errors.push('Camera name must be 100 characters or less');
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid camera data', errors);
    }
  }

  private validateUpdateDto(dto: UpdateCameraDto): void {
    const errors: string[] = [];

    if (dto.name !== undefined && dto.name.trim().length === 0) {
      errors.push('Camera name cannot be empty');
    }

    if (dto.name && dto.name.length > 100) {
      errors.push('Camera name must be 100 characters or less');
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid camera data', errors);
    }
  }

  clear(): void {
    cameras.clear();
  }
}

export const cameraService = new CameraService();
