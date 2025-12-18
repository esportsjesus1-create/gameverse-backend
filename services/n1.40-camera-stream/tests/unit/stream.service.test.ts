import { StreamService } from '../../src/services/stream.service';
import { CameraService } from '../../src/services/camera.service';
import { CreateStreamDto, StreamStatus, QualityPreset } from '../../src/types';
import { NotFoundError, ValidationError, ConflictError } from '../../src/utils/errors';

jest.mock('../../src/utils/logger');

describe('StreamService', () => {
  let streamService: StreamService;
  let cameraService: CameraService;
  let testCameraId: string;

  beforeEach(async () => {
    streamService = new StreamService();
    cameraService = new CameraService();
    streamService.clear();
    cameraService.clear();

    const camera = await cameraService.create({
      name: 'Test Camera',
      ownerId: 'user-123'
    });
    testCameraId = camera.id;
  });

  describe('create', () => {
    it('should create a stream successfully', async () => {
      const dto: CreateStreamDto = {
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      };

      const stream = await streamService.create(dto);

      expect(stream.id).toBeDefined();
      expect(stream.cameraId).toBe(testCameraId);
      expect(stream.title).toBe('Test Stream');
      expect(stream.status).toBe(StreamStatus.CREATED);
      expect(stream.quality).toBe(QualityPreset.AUTO);
      expect(stream.viewerCount).toBe(0);
    });

    it('should throw ValidationError when cameraId is empty', async () => {
      const dto: CreateStreamDto = {
        cameraId: '',
        ownerId: 'user-123',
        title: 'Test Stream'
      };

      await expect(streamService.create(dto)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when title is empty', async () => {
      const dto: CreateStreamDto = {
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: ''
      };

      await expect(streamService.create(dto)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when camera does not exist', async () => {
      const dto: CreateStreamDto = {
        cameraId: 'nonexistent-camera',
        ownerId: 'user-123',
        title: 'Test Stream'
      };

      await expect(streamService.create(dto)).rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError when camera is already streaming', async () => {
      const stream1 = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Stream 1'
      });
      await streamService.start(stream1.id);

      const dto: CreateStreamDto = {
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Stream 2'
      };

      await expect(streamService.create(dto)).rejects.toThrow(ConflictError);
    });
  });

  describe('findById', () => {
    it('should find a stream by id', async () => {
      const created = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      });

      const found = await streamService.findById(created.id);

      expect(found.id).toBe(created.id);
      expect(found.title).toBe('Test Stream');
    });

    it('should throw NotFoundError when stream does not exist', async () => {
      await expect(streamService.findById('nonexistent-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('findAll', () => {
    it('should return paginated streams', async () => {
      await streamService.create({ cameraId: testCameraId, ownerId: 'user-123', title: 'Stream 1' });
      
      const camera2 = await cameraService.create({ name: 'Camera 2', ownerId: 'user-456' });
      await streamService.create({ cameraId: camera2.id, ownerId: 'user-456', title: 'Stream 2' });

      const result = await streamService.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter by ownerId', async () => {
      await streamService.create({ cameraId: testCameraId, ownerId: 'user-123', title: 'Stream 1' });
      
      const camera2 = await cameraService.create({ name: 'Camera 2', ownerId: 'user-456' });
      await streamService.create({ cameraId: camera2.id, ownerId: 'user-456', title: 'Stream 2' });

      const result = await streamService.findAll({ page: 1, limit: 10, ownerId: 'user-123' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].ownerId).toBe('user-123');
    });

    it('should filter by status', async () => {
      const stream1 = await streamService.create({ cameraId: testCameraId, ownerId: 'user-123', title: 'Stream 1' });
      await streamService.start(stream1.id);

      const camera2 = await cameraService.create({ name: 'Camera 2', ownerId: 'user-123' });
      await streamService.create({ cameraId: camera2.id, ownerId: 'user-123', title: 'Stream 2' });

      const result = await streamService.findAll({ page: 1, limit: 10, status: StreamStatus.LIVE });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe(StreamStatus.LIVE);
    });
  });

  describe('getLiveStreams', () => {
    it('should return only live streams', async () => {
      const stream1 = await streamService.create({ cameraId: testCameraId, ownerId: 'user-123', title: 'Stream 1' });
      await streamService.start(stream1.id);

      const camera2 = await cameraService.create({ name: 'Camera 2', ownerId: 'user-123' });
      await streamService.create({ cameraId: camera2.id, ownerId: 'user-123', title: 'Stream 2' });

      const liveStreams = await streamService.getLiveStreams();

      expect(liveStreams).toHaveLength(1);
      expect(liveStreams[0].status).toBe(StreamStatus.LIVE);
    });
  });

  describe('start', () => {
    it('should start a stream successfully', async () => {
      const stream = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      });

      const started = await streamService.start(stream.id);

      expect(started.status).toBe(StreamStatus.LIVE);
      expect(started.startedAt).toBeInstanceOf(Date);
    });

    it('should throw ConflictError when stream is already live', async () => {
      const stream = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      });
      await streamService.start(stream.id);

      await expect(streamService.start(stream.id)).rejects.toThrow(ConflictError);
    });

    it('should throw ValidationError when trying to restart ended stream', async () => {
      const stream = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      });
      await streamService.start(stream.id);
      await streamService.stop(stream.id);

      await expect(streamService.start(stream.id)).rejects.toThrow(ValidationError);
    });
  });

  describe('stop', () => {
    it('should stop a live stream successfully', async () => {
      const stream = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      });
      await streamService.start(stream.id);

      const stopped = await streamService.stop(stream.id);

      expect(stopped.status).toBe(StreamStatus.ENDED);
      expect(stopped.endedAt).toBeInstanceOf(Date);
    });

    it('should throw ValidationError when stream has already ended', async () => {
      const stream = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      });
      await streamService.start(stream.id);
      await streamService.stop(stream.id);

      await expect(streamService.stop(stream.id)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when stream is not active', async () => {
      const stream = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      });

      await expect(streamService.stop(stream.id)).rejects.toThrow(ValidationError);
    });
  });

  describe('pause and resume', () => {
    it('should pause a live stream', async () => {
      const stream = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      });
      await streamService.start(stream.id);

      const paused = await streamService.pause(stream.id);

      expect(paused.status).toBe(StreamStatus.PAUSED);
    });

    it('should resume a paused stream', async () => {
      const stream = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      });
      await streamService.start(stream.id);
      await streamService.pause(stream.id);

      const resumed = await streamService.resume(stream.id);

      expect(resumed.status).toBe(StreamStatus.LIVE);
    });

    it('should throw ValidationError when pausing non-live stream', async () => {
      const stream = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      });

      await expect(streamService.pause(stream.id)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when resuming non-paused stream', async () => {
      const stream = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      });
      await streamService.start(stream.id);

      await expect(streamService.resume(stream.id)).rejects.toThrow(ValidationError);
    });
  });

  describe('delete', () => {
    it('should delete a stream successfully', async () => {
      const stream = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      });

      await streamService.delete(stream.id);

      await expect(streamService.findById(stream.id)).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when deleting active stream', async () => {
      const stream = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      });
      await streamService.start(stream.id);

      await expect(streamService.delete(stream.id)).rejects.toThrow(ValidationError);
    });
  });

  describe('viewer count', () => {
    it('should update viewer count', async () => {
      const stream = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      });

      const updated = await streamService.updateViewerCount(stream.id, 100);

      expect(updated.viewerCount).toBe(100);
    });

    it('should increment viewer count', async () => {
      const stream = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      });

      await streamService.incrementViewerCount(stream.id);
      const updated = await streamService.incrementViewerCount(stream.id);

      expect(updated.viewerCount).toBe(2);
    });

    it('should decrement viewer count', async () => {
      const stream = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      });
      await streamService.updateViewerCount(stream.id, 5);

      const updated = await streamService.decrementViewerCount(stream.id);

      expect(updated.viewerCount).toBe(4);
    });

    it('should not go below zero', async () => {
      const stream = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      });

      const updated = await streamService.decrementViewerCount(stream.id);

      expect(updated.viewerCount).toBe(0);
    });
  });

  describe('setQuality', () => {
    it('should set stream quality', async () => {
      const stream = await streamService.create({
        cameraId: testCameraId,
        ownerId: 'user-123',
        title: 'Test Stream'
      });

      const updated = await streamService.setQuality(stream.id, QualityPreset.HIGH);

      expect(updated.quality).toBe(QualityPreset.HIGH);
    });
  });
});
