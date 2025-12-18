import { CameraService } from '../../src/services/camera.service';
import { CreateCameraDto, UpdateCameraDto, CameraStatus } from '../../src/types';
import { NotFoundError, ValidationError } from '../../src/utils/errors';

jest.mock('../../src/utils/logger');

describe('CameraService', () => {
  let cameraService: CameraService;

  beforeEach(() => {
    cameraService = new CameraService();
    cameraService.clear();
  });

  describe('create', () => {
    it('should create a camera successfully', async () => {
      const dto: CreateCameraDto = {
        name: 'Test Camera',
        description: 'A test camera',
        ownerId: 'user-123'
      };

      const camera = await cameraService.create(dto);

      expect(camera.id).toBeDefined();
      expect(camera.name).toBe('Test Camera');
      expect(camera.description).toBe('A test camera');
      expect(camera.ownerId).toBe('user-123');
      expect(camera.status).toBe(CameraStatus.OFFLINE);
      expect(camera.capabilities).toBeDefined();
      expect(camera.createdAt).toBeInstanceOf(Date);
    });

    it('should throw ValidationError when name is empty', async () => {
      const dto: CreateCameraDto = {
        name: '',
        ownerId: 'user-123'
      };

      await expect(cameraService.create(dto)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when ownerId is empty', async () => {
      const dto: CreateCameraDto = {
        name: 'Test Camera',
        ownerId: ''
      };

      await expect(cameraService.create(dto)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when name is too long', async () => {
      const dto: CreateCameraDto = {
        name: 'a'.repeat(101),
        ownerId: 'user-123'
      };

      await expect(cameraService.create(dto)).rejects.toThrow(ValidationError);
    });

    it('should create camera with custom capabilities', async () => {
      const dto: CreateCameraDto = {
        name: 'HD Camera',
        ownerId: 'user-123',
        capabilities: {
          maxFramerate: 120,
          hasPanTiltZoom: true
        }
      };

      const camera = await cameraService.create(dto);

      expect(camera.capabilities.maxFramerate).toBe(120);
      expect(camera.capabilities.hasPanTiltZoom).toBe(true);
    });
  });

  describe('findById', () => {
    it('should find a camera by id', async () => {
      const created = await cameraService.create({
        name: 'Test Camera',
        ownerId: 'user-123'
      });

      const found = await cameraService.findById(created.id);

      expect(found.id).toBe(created.id);
      expect(found.name).toBe('Test Camera');
    });

    it('should throw NotFoundError when camera does not exist', async () => {
      await expect(cameraService.findById('nonexistent-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('findAll', () => {
    it('should return paginated cameras', async () => {
      await cameraService.create({ name: 'Camera 1', ownerId: 'user-123' });
      await cameraService.create({ name: 'Camera 2', ownerId: 'user-123' });
      await cameraService.create({ name: 'Camera 3', ownerId: 'user-456' });

      const result = await cameraService.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by ownerId', async () => {
      await cameraService.create({ name: 'Camera 1', ownerId: 'user-123' });
      await cameraService.create({ name: 'Camera 2', ownerId: 'user-123' });
      await cameraService.create({ name: 'Camera 3', ownerId: 'user-456' });

      const result = await cameraService.findAll({ page: 1, limit: 10, ownerId: 'user-123' });

      expect(result.data).toHaveLength(2);
      expect(result.data.every(c => c.ownerId === 'user-123')).toBe(true);
    });

    it('should filter by status', async () => {
      const camera1 = await cameraService.create({ name: 'Camera 1', ownerId: 'user-123' });
      await cameraService.create({ name: 'Camera 2', ownerId: 'user-123' });
      await cameraService.setStatus(camera1.id, CameraStatus.ONLINE);

      const result = await cameraService.findAll({ page: 1, limit: 10, status: CameraStatus.ONLINE });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe(CameraStatus.ONLINE);
    });

    it('should handle pagination correctly', async () => {
      for (let i = 0; i < 25; i++) {
        await cameraService.create({ name: `Camera ${i}`, ownerId: 'user-123' });
      }

      const page1 = await cameraService.findAll({ page: 1, limit: 10 });
      const page2 = await cameraService.findAll({ page: 2, limit: 10 });
      const page3 = await cameraService.findAll({ page: 3, limit: 10 });

      expect(page1.data).toHaveLength(10);
      expect(page2.data).toHaveLength(10);
      expect(page3.data).toHaveLength(5);
      expect(page1.pagination.totalPages).toBe(3);
    });
  });

  describe('findByOwner', () => {
    it('should return cameras for a specific owner', async () => {
      await cameraService.create({ name: 'Camera 1', ownerId: 'user-123' });
      await cameraService.create({ name: 'Camera 2', ownerId: 'user-123' });
      await cameraService.create({ name: 'Camera 3', ownerId: 'user-456' });

      const cameras = await cameraService.findByOwner('user-123');

      expect(cameras).toHaveLength(2);
      expect(cameras.every(c => c.ownerId === 'user-123')).toBe(true);
    });
  });

  describe('update', () => {
    it('should update a camera successfully', async () => {
      const camera = await cameraService.create({
        name: 'Original Name',
        ownerId: 'user-123'
      });

      // Wait a small amount to ensure updatedAt will be different
      await new Promise(resolve => setTimeout(resolve, 5));

      const dto: UpdateCameraDto = {
        name: 'Updated Name',
        description: 'Updated description'
      };

      const updated = await cameraService.update(camera.id, dto);

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('Updated description');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(camera.updatedAt.getTime());
    });

    it('should throw ValidationError when updating with empty name', async () => {
      const camera = await cameraService.create({
        name: 'Test Camera',
        ownerId: 'user-123'
      });

      await expect(cameraService.update(camera.id, { name: '   ' })).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when camera does not exist', async () => {
      await expect(cameraService.update('nonexistent-id', { name: 'New Name' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('should delete a camera successfully', async () => {
      const camera = await cameraService.create({
        name: 'Test Camera',
        ownerId: 'user-123'
      });

      await cameraService.delete(camera.id);

      await expect(cameraService.findById(camera.id)).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when deleting a streaming camera', async () => {
      const camera = await cameraService.create({
        name: 'Test Camera',
        ownerId: 'user-123'
      });
      await cameraService.setStatus(camera.id, CameraStatus.STREAMING);

      await expect(cameraService.delete(camera.id)).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when camera does not exist', async () => {
      await expect(cameraService.delete('nonexistent-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('setStatus', () => {
    it('should set camera status', async () => {
      const camera = await cameraService.create({
        name: 'Test Camera',
        ownerId: 'user-123'
      });

      const updated = await cameraService.setStatus(camera.id, CameraStatus.ONLINE);

      expect(updated.status).toBe(CameraStatus.ONLINE);
    });
  });

  describe('getOnlineCameras', () => {
    it('should return online and streaming cameras', async () => {
      const camera1 = await cameraService.create({ name: 'Camera 1', ownerId: 'user-123' });
      const camera2 = await cameraService.create({ name: 'Camera 2', ownerId: 'user-123' });
      await cameraService.create({ name: 'Camera 3', ownerId: 'user-123' });

      await cameraService.setStatus(camera1.id, CameraStatus.ONLINE);
      await cameraService.setStatus(camera2.id, CameraStatus.STREAMING);

      const onlineCameras = await cameraService.getOnlineCameras();

      expect(onlineCameras).toHaveLength(2);
    });

    it('should filter by ownerId', async () => {
      const camera1 = await cameraService.create({ name: 'Camera 1', ownerId: 'user-123' });
      const camera2 = await cameraService.create({ name: 'Camera 2', ownerId: 'user-456' });

      await cameraService.setStatus(camera1.id, CameraStatus.ONLINE);
      await cameraService.setStatus(camera2.id, CameraStatus.ONLINE);

      const onlineCameras = await cameraService.getOnlineCameras('user-123');

      expect(onlineCameras).toHaveLength(1);
      expect(onlineCameras[0].ownerId).toBe('user-123');
    });
  });
});
