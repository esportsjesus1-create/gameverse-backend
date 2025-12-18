import { RecordingService } from '../../src/services/recording.service';
import { StreamService } from '../../src/services/stream.service';
import { CameraService } from '../../src/services/camera.service';
import { RecordingStatus, RecordingFormat } from '../../src/types';
import { NotFoundError, ValidationError, ConflictError, RecordingError } from '../../src/utils/errors';

jest.mock('../../src/utils/logger');

describe('RecordingService', () => {
  let recordingService: RecordingService;
  let streamService: StreamService;
  let cameraService: CameraService;
  let testStreamId: string;

  beforeEach(async () => {
    recordingService = new RecordingService();
    streamService = new StreamService();
    cameraService = new CameraService();
    recordingService.clear();
    streamService.clear();
    cameraService.clear();

    const camera = await cameraService.create({
      name: 'Test Camera',
      ownerId: 'user-123'
    });

    const stream = await streamService.create({
      cameraId: camera.id,
      ownerId: 'user-123',
      title: 'Test Stream'
    });
    await streamService.start(stream.id);
    testStreamId = stream.id;
  });

  describe('start', () => {
    it('should start a recording successfully', async () => {
      const recording = await recordingService.start({
        streamId: testStreamId
      });

      expect(recording.id).toBeDefined();
      expect(recording.streamId).toBe(testStreamId);
      expect(recording.status).toBe(RecordingStatus.RECORDING);
      expect(recording.format).toBe(RecordingFormat.WEBM);
      expect(recording.startedAt).toBeInstanceOf(Date);
      expect(recording.filePath).toBeDefined();
    });

    it('should start recording with custom format', async () => {
      const recording = await recordingService.start({
        streamId: testStreamId,
        format: RecordingFormat.MP4
      });

      expect(recording.format).toBe(RecordingFormat.MP4);
    });

    it('should throw ValidationError when streamId is empty', async () => {
      await expect(recordingService.start({ streamId: '' })).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when stream does not exist', async () => {
      await expect(recordingService.start({ streamId: 'nonexistent-stream' })).rejects.toThrow(ValidationError);
    });

    it('should throw RecordingError when stream is not live', async () => {
      await streamService.stop(testStreamId);

      await expect(recordingService.start({ streamId: testStreamId })).rejects.toThrow(RecordingError);
    });

    it('should throw ConflictError when stream is already being recorded', async () => {
      await recordingService.start({ streamId: testStreamId });

      await expect(recordingService.start({ streamId: testStreamId })).rejects.toThrow(ConflictError);
    });
  });

  describe('findById', () => {
    it('should find a recording by id', async () => {
      const created = await recordingService.start({ streamId: testStreamId });

      const found = await recordingService.findById(created.id);

      expect(found.id).toBe(created.id);
      expect(found.streamId).toBe(testStreamId);
    });

    it('should throw NotFoundError when recording does not exist', async () => {
      await expect(recordingService.findById('nonexistent-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('findAll', () => {
    it('should return paginated recordings', async () => {
      await recordingService.start({ streamId: testStreamId });

      const result = await recordingService.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by ownerId', async () => {
      await recordingService.start({ streamId: testStreamId });

      const result = await recordingService.findAll({ page: 1, limit: 10, ownerId: 'user-123' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].ownerId).toBe('user-123');
    });

    it('should filter by streamId', async () => {
      await recordingService.start({ streamId: testStreamId });

      const result = await recordingService.findAll({ page: 1, limit: 10, streamId: testStreamId });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].streamId).toBe(testStreamId);
    });

    it('should filter by status', async () => {
      await recordingService.start({ streamId: testStreamId });

      const result = await recordingService.findAll({ page: 1, limit: 10, status: RecordingStatus.RECORDING });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe(RecordingStatus.RECORDING);
    });
  });

  describe('findByStream', () => {
    it('should return recordings for a specific stream', async () => {
      await recordingService.start({ streamId: testStreamId });

      const recordings = await recordingService.findByStream(testStreamId);

      expect(recordings).toHaveLength(1);
      expect(recordings[0].streamId).toBe(testStreamId);
    });
  });

  describe('stop', () => {
    it('should stop a recording successfully', async () => {
      const recording = await recordingService.start({ streamId: testStreamId });

      const stopped = await recordingService.stop(recording.id);

      expect(stopped.status).toBe(RecordingStatus.COMPLETED);
      expect(stopped.endedAt).toBeInstanceOf(Date);
      expect(stopped.duration).toBeDefined();
      expect(stopped.fileSize).toBeDefined();
    });

    it('should throw ValidationError when recording is not active', async () => {
      const recording = await recordingService.start({ streamId: testStreamId });
      await recordingService.stop(recording.id);

      await expect(recordingService.stop(recording.id)).rejects.toThrow(ValidationError);
    });
  });

  describe('pause and resume', () => {
    it('should pause a recording', async () => {
      const recording = await recordingService.start({ streamId: testStreamId });

      const paused = await recordingService.pause(recording.id);

      expect(paused.status).toBe(RecordingStatus.PAUSED);
    });

    it('should resume a paused recording', async () => {
      const recording = await recordingService.start({ streamId: testStreamId });
      await recordingService.pause(recording.id);

      const resumed = await recordingService.resume(recording.id);

      expect(resumed.status).toBe(RecordingStatus.RECORDING);
    });

    it('should throw ValidationError when pausing non-recording', async () => {
      const recording = await recordingService.start({ streamId: testStreamId });
      await recordingService.stop(recording.id);

      await expect(recordingService.pause(recording.id)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when resuming non-paused recording', async () => {
      const recording = await recordingService.start({ streamId: testStreamId });

      await expect(recordingService.resume(recording.id)).rejects.toThrow(ValidationError);
    });
  });

  describe('delete', () => {
    it('should delete a completed recording', async () => {
      const recording = await recordingService.start({ streamId: testStreamId });
      await recordingService.stop(recording.id);

      await recordingService.delete(recording.id);

      await expect(recordingService.findById(recording.id)).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when deleting active recording', async () => {
      const recording = await recordingService.start({ streamId: testStreamId });

      await expect(recordingService.delete(recording.id)).rejects.toThrow(ValidationError);
    });
  });

  describe('getStorageUsage', () => {
    it('should return storage usage for owner', async () => {
      const recording = await recordingService.start({ streamId: testStreamId });
      await recordingService.stop(recording.id);

      const usage = await recordingService.getStorageUsage('user-123');

      expect(usage.used).toBeGreaterThan(0);
      expect(usage.limit).toBeGreaterThan(0);
      expect(usage.percentage).toBeDefined();
    });
  });

  describe('setFailed', () => {
    it('should set recording as failed', async () => {
      const recording = await recordingService.start({ streamId: testStreamId });

      const failed = await recordingService.setFailed(recording.id, 'Storage full');

      expect(failed.status).toBe(RecordingStatus.FAILED);
      expect(failed.metadata).toHaveProperty('error', 'Storage full');
    });
  });
});
