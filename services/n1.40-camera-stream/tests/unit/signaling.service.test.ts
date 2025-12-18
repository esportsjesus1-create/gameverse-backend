import { SignalingService } from '../../src/services/signaling.service';
import { SignalingMessageType, QualityPreset, ConnectionState } from '../../src/types';
import { NotFoundError, ValidationError } from '../../src/utils/errors';

jest.mock('../../src/utils/logger');

describe('SignalingService', () => {
  let signalingService: SignalingService;

  beforeEach(() => {
    signalingService = new SignalingService();
    signalingService.clear();
  });

  describe('getWebRTCConfig', () => {
    it('should return WebRTC configuration', () => {
      const config = signalingService.getWebRTCConfig();

      expect(config.iceServers).toBeDefined();
      expect(config.iceServers.length).toBeGreaterThan(0);
      expect(config.iceCandidatePoolSize).toBeDefined();
    });
  });

  describe('createRoom', () => {
    it('should create a room successfully', async () => {
      const room = await signalingService.createRoom('stream-123', 'broadcaster-1');

      expect(room.streamId).toBe('stream-123');
      expect(room.broadcaster).toBe('broadcaster-1');
      expect(room.viewers.size).toBe(0);
      expect(room.createdAt).toBeInstanceOf(Date);
    });

    it('should throw ValidationError when room already exists', async () => {
      await signalingService.createRoom('stream-123', 'broadcaster-1');

      await expect(signalingService.createRoom('stream-123', 'broadcaster-2')).rejects.toThrow(ValidationError);
    });
  });

  describe('getRoom', () => {
    it('should get a room by streamId', async () => {
      await signalingService.createRoom('stream-123', 'broadcaster-1');

      const room = await signalingService.getRoom('stream-123');

      expect(room.streamId).toBe('stream-123');
    });

    it('should throw NotFoundError when room does not exist', async () => {
      await expect(signalingService.getRoom('nonexistent-stream')).rejects.toThrow(NotFoundError);
    });
  });

  describe('closeRoom', () => {
    it('should close a room successfully', async () => {
      await signalingService.createRoom('stream-123', 'broadcaster-1');

      await signalingService.closeRoom('stream-123');

      await expect(signalingService.getRoom('stream-123')).rejects.toThrow(NotFoundError);
    });

    it('should not throw when closing non-existent room', async () => {
      await expect(signalingService.closeRoom('nonexistent-stream')).resolves.not.toThrow();
    });
  });

  describe('addViewerToRoom', () => {
    it('should add viewer to room', async () => {
      await signalingService.createRoom('stream-123', 'broadcaster-1');

      const viewer = {
        id: 'viewer-1',
        streamId: 'stream-123',
        sessionId: 'session-1',
        connectionState: ConnectionState.CONNECTING,
        quality: QualityPreset.AUTO,
        bandwidth: { estimatedBandwidth: 0, currentBitrate: 0, packetLoss: 0, latency: 0, jitter: 0 },
        joinedAt: new Date(),
        lastActiveAt: new Date()
      };

      await signalingService.addViewerToRoom('stream-123', viewer);

      const room = await signalingService.getRoom('stream-123');
      expect(room.viewers.size).toBe(1);
      expect(room.viewers.has('viewer-1')).toBe(true);
    });
  });

  describe('removeViewerFromRoom', () => {
    it('should remove viewer from room', async () => {
      await signalingService.createRoom('stream-123', 'broadcaster-1');
      const viewer = {
        id: 'viewer-1',
        streamId: 'stream-123',
        sessionId: 'session-1',
        connectionState: ConnectionState.CONNECTING,
        quality: QualityPreset.AUTO,
        bandwidth: { estimatedBandwidth: 0, currentBitrate: 0, packetLoss: 0, latency: 0, jitter: 0 },
        joinedAt: new Date(),
        lastActiveAt: new Date()
      };
      await signalingService.addViewerToRoom('stream-123', viewer);

      await signalingService.removeViewerFromRoom('stream-123', 'viewer-1');

      const room = await signalingService.getRoom('stream-123');
      expect(room.viewers.size).toBe(0);
    });
  });

  describe('handleOffer', () => {
    it('should handle offer from broadcaster', async () => {
      await signalingService.createRoom('stream-123', 'broadcaster-1');

      const message = {
        type: SignalingMessageType.OFFER,
        streamId: 'stream-123',
        senderId: 'broadcaster-1',
        payload: { sdp: 'test-sdp' },
        timestamp: Date.now()
      };

      await expect(signalingService.handleOffer(message)).resolves.not.toThrow();
    });

    it('should throw ValidationError when sender is not broadcaster', async () => {
      await signalingService.createRoom('stream-123', 'broadcaster-1');

      const message = {
        type: SignalingMessageType.OFFER,
        streamId: 'stream-123',
        senderId: 'not-broadcaster',
        payload: { sdp: 'test-sdp' },
        timestamp: Date.now()
      };

      await expect(signalingService.handleOffer(message)).rejects.toThrow(ValidationError);
    });
  });

  describe('handleAnswer', () => {
    it('should handle answer from viewer', async () => {
      await signalingService.createRoom('stream-123', 'broadcaster-1');
      const viewer = {
        id: 'viewer-1',
        streamId: 'stream-123',
        sessionId: 'session-1',
        connectionState: ConnectionState.CONNECTING,
        quality: QualityPreset.AUTO,
        bandwidth: { estimatedBandwidth: 0, currentBitrate: 0, packetLoss: 0, latency: 0, jitter: 0 },
        joinedAt: new Date(),
        lastActiveAt: new Date()
      };
      await signalingService.addViewerToRoom('stream-123', viewer);

      const message = {
        type: SignalingMessageType.ANSWER,
        streamId: 'stream-123',
        senderId: 'viewer-1',
        payload: { sdp: 'test-sdp' },
        timestamp: Date.now()
      };

      await expect(signalingService.handleAnswer(message)).resolves.not.toThrow();
    });

    it('should throw ValidationError when sender is not a viewer', async () => {
      await signalingService.createRoom('stream-123', 'broadcaster-1');

      const message = {
        type: SignalingMessageType.ANSWER,
        streamId: 'stream-123',
        senderId: 'not-viewer',
        payload: { sdp: 'test-sdp' },
        timestamp: Date.now()
      };

      await expect(signalingService.handleAnswer(message)).rejects.toThrow(ValidationError);
    });
  });

  describe('handleIceCandidate', () => {
    it('should handle ICE candidate from broadcaster', async () => {
      await signalingService.createRoom('stream-123', 'broadcaster-1');

      const message = {
        type: SignalingMessageType.ICE_CANDIDATE,
        streamId: 'stream-123',
        senderId: 'broadcaster-1',
        payload: { candidate: 'test-candidate' },
        timestamp: Date.now()
      };

      await expect(signalingService.handleIceCandidate(message)).resolves.not.toThrow();
    });

    it('should handle ICE candidate from viewer', async () => {
      await signalingService.createRoom('stream-123', 'broadcaster-1');
      const viewer = {
        id: 'viewer-1',
        streamId: 'stream-123',
        sessionId: 'session-1',
        connectionState: ConnectionState.CONNECTING,
        quality: QualityPreset.AUTO,
        bandwidth: { estimatedBandwidth: 0, currentBitrate: 0, packetLoss: 0, latency: 0, jitter: 0 },
        joinedAt: new Date(),
        lastActiveAt: new Date()
      };
      await signalingService.addViewerToRoom('stream-123', viewer);

      const message = {
        type: SignalingMessageType.ICE_CANDIDATE,
        streamId: 'stream-123',
        senderId: 'viewer-1',
        payload: { candidate: 'test-candidate' },
        timestamp: Date.now()
      };

      await expect(signalingService.handleIceCandidate(message)).resolves.not.toThrow();
    });
  });

  describe('handleJoin', () => {
    it('should return offer when available', async () => {
      await signalingService.createRoom('stream-123', 'broadcaster-1');
      
      const offerMessage = {
        type: SignalingMessageType.OFFER,
        streamId: 'stream-123',
        senderId: 'broadcaster-1',
        payload: { sdp: 'test-sdp' },
        timestamp: Date.now()
      };
      await signalingService.handleOffer(offerMessage);

      const joinMessage = {
        type: SignalingMessageType.JOIN,
        streamId: 'stream-123',
        senderId: 'viewer-1',
        payload: {},
        timestamp: Date.now()
      };

      const response = await signalingService.handleJoin(joinMessage);

      expect(response).not.toBeNull();
      expect(response?.type).toBe(SignalingMessageType.OFFER);
    });

    it('should return null when no offer available', async () => {
      await signalingService.createRoom('stream-123', 'broadcaster-1');

      const joinMessage = {
        type: SignalingMessageType.JOIN,
        streamId: 'stream-123',
        senderId: 'viewer-1',
        payload: {},
        timestamp: Date.now()
      };

      const response = await signalingService.handleJoin(joinMessage);

      expect(response).toBeNull();
    });
  });

  describe('handleQualityChange', () => {
    it('should handle quality change', async () => {
      await signalingService.createRoom('stream-123', 'broadcaster-1');
      const viewer = {
        id: 'viewer-1',
        streamId: 'stream-123',
        sessionId: 'session-1',
        connectionState: ConnectionState.CONNECTING,
        quality: QualityPreset.AUTO,
        bandwidth: { estimatedBandwidth: 0, currentBitrate: 0, packetLoss: 0, latency: 0, jitter: 0 },
        joinedAt: new Date(),
        lastActiveAt: new Date()
      };
      await signalingService.addViewerToRoom('stream-123', viewer);

      const message = {
        type: SignalingMessageType.QUALITY_CHANGE,
        streamId: 'stream-123',
        senderId: 'viewer-1',
        payload: { quality: QualityPreset.HIGH },
        timestamp: Date.now()
      };

      await expect(signalingService.handleQualityChange(message)).resolves.not.toThrow();
    });
  });

  describe('processMessage', () => {
    it('should process different message types', async () => {
      await signalingService.createRoom('stream-123', 'broadcaster-1');

      const offerMessage = {
        type: SignalingMessageType.OFFER,
        streamId: 'stream-123',
        senderId: 'broadcaster-1',
        payload: { sdp: 'test-sdp' },
        timestamp: Date.now()
      };

      const result = await signalingService.processMessage(offerMessage);
      expect(result).toBeNull();
    });

    it('should throw ValidationError for unknown message type', async () => {
      const message = {
        type: 'unknown' as SignalingMessageType,
        streamId: 'stream-123',
        senderId: 'user-1',
        payload: {},
        timestamp: Date.now()
      };

      await expect(signalingService.processMessage(message)).rejects.toThrow(ValidationError);
    });
  });

  describe('getRoomStats', () => {
    it('should return room statistics', async () => {
      await signalingService.createRoom('stream-123', 'broadcaster-1');
      const viewer = {
        id: 'viewer-1',
        streamId: 'stream-123',
        sessionId: 'session-1',
        connectionState: ConnectionState.CONNECTING,
        quality: QualityPreset.AUTO,
        bandwidth: { estimatedBandwidth: 0, currentBitrate: 0, packetLoss: 0, latency: 0, jitter: 0 },
        joinedAt: new Date(),
        lastActiveAt: new Date()
      };
      await signalingService.addViewerToRoom('stream-123', viewer);

      const stats = await signalingService.getRoomStats('stream-123');

      expect(stats.viewerCount).toBe(1);
      expect(stats.broadcaster).toBe('broadcaster-1');
    });
  });

  describe('getAllRooms', () => {
    it('should return all room stream IDs', async () => {
      await signalingService.createRoom('stream-1', 'broadcaster-1');
      await signalingService.createRoom('stream-2', 'broadcaster-2');

      const rooms = await signalingService.getAllRooms();

      expect(rooms).toHaveLength(2);
      expect(rooms).toContain('stream-1');
      expect(rooms).toContain('stream-2');
    });
  });

  describe('createMessage', () => {
    it('should create a signaling message', () => {
      const message = signalingService.createMessage(
        SignalingMessageType.OFFER,
        'stream-123',
        'sender-1',
        { sdp: 'test' }
      );

      expect(message.type).toBe(SignalingMessageType.OFFER);
      expect(message.streamId).toBe('stream-123');
      expect(message.senderId).toBe('sender-1');
      expect(message.timestamp).toBeDefined();
    });
  });

  describe('createErrorMessage', () => {
    it('should create an error message', () => {
      const message = signalingService.createErrorMessage('stream-123', 'Test error');

      expect(message.type).toBe(SignalingMessageType.ERROR);
      expect(message.streamId).toBe('stream-123');
      expect(message.senderId).toBe('server');
      expect((message.payload as { error: string }).error).toBe('Test error');
    });
  });
});
