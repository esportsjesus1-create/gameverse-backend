import { ViewerService } from '../../src/services/viewer.service';
import { StreamService } from '../../src/services/stream.service';
import { CameraService } from '../../src/services/camera.service';
import { ConnectionState, QualityPreset } from '../../src/types';
import { NotFoundError, ValidationError } from '../../src/utils/errors';

jest.mock('../../src/utils/logger');

describe('ViewerService', () => {
  let viewerService: ViewerService;
  let streamService: StreamService;
  let cameraService: CameraService;
  let testStreamId: string;

  beforeEach(async () => {
    viewerService = new ViewerService();
    streamService = new StreamService();
    cameraService = new CameraService();
    viewerService.clear();
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

  describe('join', () => {
    it('should join a stream successfully', async () => {
      const viewer = await viewerService.join(testStreamId, 'viewer-user-1');

      expect(viewer.id).toBeDefined();
      expect(viewer.streamId).toBe(testStreamId);
      expect(viewer.userId).toBe('viewer-user-1');
      expect(viewer.connectionState).toBe(ConnectionState.CONNECTING);
      expect(viewer.quality).toBe(QualityPreset.AUTO);
      expect(viewer.joinedAt).toBeInstanceOf(Date);
    });

    it('should join without userId', async () => {
      const viewer = await viewerService.join(testStreamId);

      expect(viewer.id).toBeDefined();
      expect(viewer.userId).toBeUndefined();
    });

    it('should throw ValidationError when stream is not live', async () => {
      await streamService.stop(testStreamId);

      await expect(viewerService.join(testStreamId)).rejects.toThrow(ValidationError);
    });

    it('should increment stream viewer count', async () => {
      await viewerService.join(testStreamId);
      await viewerService.join(testStreamId);

      const stream = await streamService.findById(testStreamId);
      expect(stream.viewerCount).toBe(2);
    });
  });

  describe('findById', () => {
    it('should find a viewer by id', async () => {
      const created = await viewerService.join(testStreamId);

      const found = await viewerService.findById(created.id);

      expect(found.id).toBe(created.id);
      expect(found.streamId).toBe(testStreamId);
    });

    it('should throw NotFoundError when viewer does not exist', async () => {
      await expect(viewerService.findById('nonexistent-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('findByStream', () => {
    it('should return viewers for a specific stream', async () => {
      await viewerService.join(testStreamId, 'user-1');
      await viewerService.join(testStreamId, 'user-2');

      const viewers = await viewerService.findByStream(testStreamId);

      expect(viewers).toHaveLength(2);
      expect(viewers.every(v => v.streamId === testStreamId)).toBe(true);
    });
  });

  describe('findAll', () => {
    it('should return paginated viewers', async () => {
      await viewerService.join(testStreamId, 'user-1');
      await viewerService.join(testStreamId, 'user-2');

      const result = await viewerService.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter by streamId', async () => {
      await viewerService.join(testStreamId);

      const result = await viewerService.findAll({ page: 1, limit: 10, streamId: testStreamId });

      expect(result.data).toHaveLength(1);
    });

    it('should filter by userId', async () => {
      await viewerService.join(testStreamId, 'user-1');
      await viewerService.join(testStreamId, 'user-2');

      const result = await viewerService.findAll({ page: 1, limit: 10, userId: 'user-1' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].userId).toBe('user-1');
    });

    it('should filter by connectionState', async () => {
      const viewer = await viewerService.join(testStreamId);
      await viewerService.setConnectionState(viewer.id, ConnectionState.CONNECTED);
      await viewerService.join(testStreamId);

      const result = await viewerService.findAll({ page: 1, limit: 10, connectionState: ConnectionState.CONNECTED });

      expect(result.data).toHaveLength(1);
    });
  });

  describe('leave', () => {
    it('should leave a stream successfully', async () => {
      const viewer = await viewerService.join(testStreamId);

      await viewerService.leave(viewer.id);

      await expect(viewerService.findById(viewer.id)).rejects.toThrow(NotFoundError);
    });

    it('should decrement stream viewer count', async () => {
      const viewer1 = await viewerService.join(testStreamId);
      await viewerService.join(testStreamId);

      await viewerService.leave(viewer1.id);

      const stream = await streamService.findById(testStreamId);
      expect(stream.viewerCount).toBe(1);
    });
  });

  describe('setConnectionState', () => {
    it('should set connection state', async () => {
      const viewer = await viewerService.join(testStreamId);

      const updated = await viewerService.setConnectionState(viewer.id, ConnectionState.CONNECTED);

      expect(updated.connectionState).toBe(ConnectionState.CONNECTED);
    });
  });

  describe('setQuality', () => {
    it('should set quality preference', async () => {
      const viewer = await viewerService.join(testStreamId);

      const updated = await viewerService.setQuality(viewer.id, QualityPreset.HIGH);

      expect(updated.quality).toBe(QualityPreset.HIGH);
    });
  });

  describe('updateBandwidth', () => {
    it('should update bandwidth stats', async () => {
      const viewer = await viewerService.join(testStreamId);

      const updated = await viewerService.updateBandwidth(viewer.id, {
        estimatedBandwidth: 5000000,
        currentBitrate: 2500000,
        packetLoss: 0.5,
        latency: 50,
        jitter: 10
      });

      expect(updated.bandwidth.estimatedBandwidth).toBe(5000000);
      expect(updated.bandwidth.packetLoss).toBe(0.5);
    });
  });

  describe('getStreamViewerCount', () => {
    it('should return connected viewer count', async () => {
      const viewer1 = await viewerService.join(testStreamId);
      const viewer2 = await viewerService.join(testStreamId);
      await viewerService.setConnectionState(viewer1.id, ConnectionState.CONNECTED);
      await viewerService.setConnectionState(viewer2.id, ConnectionState.CONNECTED);

      const count = await viewerService.getStreamViewerCount(testStreamId);

      expect(count).toBe(2);
    });
  });

  describe('getStreamStats', () => {
    it('should return stream statistics', async () => {
      const viewer1 = await viewerService.join(testStreamId);
      const viewer2 = await viewerService.join(testStreamId);
      await viewerService.setConnectionState(viewer1.id, ConnectionState.CONNECTED);
      await viewerService.setConnectionState(viewer2.id, ConnectionState.CONNECTED);
      await viewerService.setQuality(viewer1.id, QualityPreset.HIGH);
      await viewerService.setQuality(viewer2.id, QualityPreset.MEDIUM);

      const stats = await viewerService.getStreamStats(testStreamId);

      expect(stats.totalViewers).toBe(2);
      expect(stats.connectedViewers).toBe(2);
      expect(stats.qualityDistribution[QualityPreset.HIGH]).toBe(1);
      expect(stats.qualityDistribution[QualityPreset.MEDIUM]).toBe(1);
    });
  });

  describe('heartbeat', () => {
    it('should update lastActiveAt', async () => {
      const viewer = await viewerService.join(testStreamId);
      const originalTime = viewer.lastActiveAt;

      await new Promise(resolve => setTimeout(resolve, 10));
      const updated = await viewerService.heartbeat(viewer.id);

      expect(updated.lastActiveAt.getTime()).toBeGreaterThan(originalTime.getTime());
    });
  });

  describe('cleanupInactiveViewers', () => {
    it('should remove inactive viewers', async () => {
      const viewer = await viewerService.join(testStreamId);

      // Wait a small amount to ensure the viewer becomes "inactive"
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Use a very small timeout (5ms) so the viewer is considered inactive
      const cleaned = await viewerService.cleanupInactiveViewers(5);

      expect(cleaned).toBe(1);
      await expect(viewerService.findById(viewer.id)).rejects.toThrow(NotFoundError);
    });
  });

  describe('disconnectAllFromStream', () => {
    it('should disconnect all viewers from stream', async () => {
      await viewerService.join(testStreamId);
      await viewerService.join(testStreamId);

      const disconnected = await viewerService.disconnectAllFromStream(testStreamId);

      expect(disconnected).toBe(2);
      const viewers = await viewerService.findByStream(testStreamId);
      expect(viewers).toHaveLength(0);
    });
  });
});
