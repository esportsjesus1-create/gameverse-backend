import request from 'supertest';
import { app } from '../../src/index';
import { cameraService } from '../../src/services/camera.service';
import { streamService } from '../../src/services/stream.service';
import { recordingService } from '../../src/services/recording.service';
import { viewerService } from '../../src/services/viewer.service';
import { signalingService } from '../../src/services/signaling.service';
import { bandwidthService } from '../../src/services/bandwidth.service';
import { CameraStatus, StreamStatus, QualityPreset } from '../../src/types';

jest.mock('../../src/utils/logger');

describe('API Integration Tests', () => {
  beforeEach(() => {
    cameraService.clear();
    streamService.clear();
    recordingService.clear();
    viewerService.clear();
    signalingService.clear();
    bandwidthService.clear();
  });

  describe('Health Check', () => {
    it('GET /health should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('camera-stream');
    });
  });

  describe('Camera API', () => {
    describe('POST /api/v1/cameras', () => {
      it('should create a camera', async () => {
        const response = await request(app)
          .post('/api/v1/cameras')
          .send({
            name: 'Test Camera',
            description: 'A test camera',
            ownerId: 'user-123'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Test Camera');
        expect(response.body.data.id).toBeDefined();
      });

      it('should return 400 for invalid data', async () => {
        const response = await request(app)
          .post('/api/v1/cameras')
          .send({
            name: '',
            ownerId: 'user-123'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/v1/cameras', () => {
      it('should return paginated cameras', async () => {
        await cameraService.create({ name: 'Camera 1', ownerId: 'user-123' });
        await cameraService.create({ name: 'Camera 2', ownerId: 'user-123' });

        const response = await request(app).get('/api/v1/cameras');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.pagination).toBeDefined();
      });

      it('should filter by ownerId', async () => {
        await cameraService.create({ name: 'Camera 1', ownerId: 'user-123' });
        await cameraService.create({ name: 'Camera 2', ownerId: 'user-456' });

        const response = await request(app).get('/api/v1/cameras?ownerId=user-123');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
      });
    });

    describe('GET /api/v1/cameras/:id', () => {
      it('should return a camera by id', async () => {
        const camera = await cameraService.create({ name: 'Test Camera', ownerId: 'user-123' });

        const response = await request(app).get(`/api/v1/cameras/${camera.id}`);

        expect(response.status).toBe(200);
        expect(response.body.data.id).toBe(camera.id);
      });

      it('should return 404 for non-existent camera', async () => {
        const response = await request(app).get('/api/v1/cameras/nonexistent-id');

        expect(response.status).toBe(404);
      });
    });

    describe('PUT /api/v1/cameras/:id', () => {
      it('should update a camera', async () => {
        const camera = await cameraService.create({ name: 'Original', ownerId: 'user-123' });

        const response = await request(app)
          .put(`/api/v1/cameras/${camera.id}`)
          .send({ name: 'Updated' });

        expect(response.status).toBe(200);
        expect(response.body.data.name).toBe('Updated');
      });
    });

    describe('DELETE /api/v1/cameras/:id', () => {
      it('should delete a camera', async () => {
        const camera = await cameraService.create({ name: 'Test Camera', ownerId: 'user-123' });

        const response = await request(app).delete(`/api/v1/cameras/${camera.id}`);

        expect(response.status).toBe(204);
      });
    });

    describe('GET /api/v1/cameras/online', () => {
      it('should return online cameras', async () => {
        const camera = await cameraService.create({ name: 'Camera 1', ownerId: 'user-123' });
        await cameraService.setStatus(camera.id, CameraStatus.ONLINE);

        const response = await request(app).get('/api/v1/cameras/online');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
      });
    });
  });

  describe('Stream API', () => {
    let testCameraId: string;

    beforeEach(async () => {
      const camera = await cameraService.create({ name: 'Test Camera', ownerId: 'user-123' });
      testCameraId = camera.id;
    });

    describe('POST /api/v1/streams', () => {
      it('should create a stream', async () => {
        const response = await request(app)
          .post('/api/v1/streams')
          .send({
            cameraId: testCameraId,
            ownerId: 'user-123',
            title: 'Test Stream'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('Test Stream');
      });
    });

    describe('GET /api/v1/streams', () => {
      it('should return paginated streams', async () => {
        await streamService.create({ cameraId: testCameraId, ownerId: 'user-123', title: 'Stream 1' });

        const response = await request(app).get('/api/v1/streams');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
      });
    });

    describe('POST /api/v1/streams/:id/start', () => {
      it('should start a stream', async () => {
        const stream = await streamService.create({
          cameraId: testCameraId,
          ownerId: 'user-123',
          title: 'Test Stream'
        });

        const response = await request(app).post(`/api/v1/streams/${stream.id}/start`);

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe(StreamStatus.LIVE);
      });
    });

    describe('POST /api/v1/streams/:id/stop', () => {
      it('should stop a stream', async () => {
        const stream = await streamService.create({
          cameraId: testCameraId,
          ownerId: 'user-123',
          title: 'Test Stream'
        });
        await streamService.start(stream.id);
        await signalingService.createRoom(stream.id, 'user-123');

        const response = await request(app).post(`/api/v1/streams/${stream.id}/stop`);

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe(StreamStatus.ENDED);
      });
    });

    describe('GET /api/v1/streams/live', () => {
      it('should return live streams', async () => {
        const stream = await streamService.create({
          cameraId: testCameraId,
          ownerId: 'user-123',
          title: 'Test Stream'
        });
        await streamService.start(stream.id);

        const response = await request(app).get('/api/v1/streams/live');

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
      });
    });
  });

  describe('Recording API', () => {
    let testStreamId: string;

    beforeEach(async () => {
      const camera = await cameraService.create({ name: 'Test Camera', ownerId: 'user-123' });
      const stream = await streamService.create({
        cameraId: camera.id,
        ownerId: 'user-123',
        title: 'Test Stream'
      });
      await streamService.start(stream.id);
      testStreamId = stream.id;
    });

    describe('POST /api/v1/recordings', () => {
      it('should start a recording', async () => {
        const response = await request(app)
          .post('/api/v1/recordings')
          .send({ streamId: testStreamId });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.streamId).toBe(testStreamId);
      });
    });

    describe('POST /api/v1/recordings/:id/stop', () => {
      it('should stop a recording', async () => {
        const recording = await recordingService.start({ streamId: testStreamId });

        const response = await request(app).post(`/api/v1/recordings/${recording.id}/stop`);

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe('completed');
      });
    });
  });

  describe('Viewer API', () => {
    let testStreamId: string;

    beforeEach(async () => {
      const camera = await cameraService.create({ name: 'Test Camera', ownerId: 'user-123' });
      const stream = await streamService.create({
        cameraId: camera.id,
        ownerId: 'user-123',
        title: 'Test Stream'
      });
      await streamService.start(stream.id);
      await signalingService.createRoom(stream.id, 'user-123');
      testStreamId = stream.id;
    });

    describe('POST /api/v1/viewers/join', () => {
      it('should join a stream', async () => {
        const response = await request(app)
          .post('/api/v1/viewers/join')
          .send({ streamId: testStreamId, userId: 'viewer-1' });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.viewer).toBeDefined();
        expect(response.body.data.webrtcConfig).toBeDefined();
      });
    });

    describe('POST /api/v1/viewers/:id/leave', () => {
      it('should leave a stream', async () => {
        const viewer = await viewerService.join(testStreamId, 'viewer-1');
        await signalingService.addViewerToRoom(testStreamId, viewer);

        const response = await request(app).post(`/api/v1/viewers/${viewer.id}/leave`);

        expect(response.status).toBe(204);
      });
    });

    describe('PATCH /api/v1/viewers/:id/quality', () => {
      it('should set viewer quality', async () => {
        const viewer = await viewerService.join(testStreamId, 'viewer-1');

        const response = await request(app)
          .patch(`/api/v1/viewers/${viewer.id}/quality`)
          .send({ quality: QualityPreset.HIGH });

        expect(response.status).toBe(200);
        expect(response.body.data.quality).toBe(QualityPreset.HIGH);
      });
    });

    describe('GET /api/v1/viewers/stream/:streamId/stats', () => {
      it('should return stream viewer stats', async () => {
        await viewerService.join(testStreamId, 'viewer-1');
        await viewerService.join(testStreamId, 'viewer-2');

        const response = await request(app).get(`/api/v1/viewers/stream/${testStreamId}/stats`);

        expect(response.status).toBe(200);
        expect(response.body.data.totalViewers).toBe(2);
      });
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/v1/unknown');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
