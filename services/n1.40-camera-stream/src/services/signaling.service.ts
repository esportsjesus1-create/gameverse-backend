import {
  SignalingMessage,
  SignalingMessageType,
  StreamRoom,
  Viewer,
  WebRTCConfig,
  QualityPreset
} from '../types';
import { config } from '../config';
import { NotFoundError, ValidationError, StreamError } from '../utils/errors';
import logger from '../utils/logger';

const rooms: Map<string, StreamRoom> = new Map();
const pendingOffers: Map<string, SignalingMessage> = new Map();
const pendingCandidates: Map<string, SignalingMessage[]> = new Map();

export class SignalingService {
  getWebRTCConfig(): WebRTCConfig {
    return {
      iceServers: config.webrtc.iceServers,
      iceCandidatePoolSize: config.webrtc.iceCandidatePoolSize
    };
  }

  async createRoom(streamId: string, broadcasterId: string): Promise<StreamRoom> {
    if (rooms.has(streamId)) {
      throw new ValidationError(`Room for stream ${streamId} already exists`);
    }

    const room: StreamRoom = {
      streamId,
      broadcaster: broadcasterId,
      viewers: new Map(),
      maxViewers: config.stream.maxViewersPerStream,
      createdAt: new Date()
    };

    rooms.set(streamId, room);
    logger.info(`Signaling room created for stream ${streamId}`);
    return room;
  }

  async getRoom(streamId: string): Promise<StreamRoom> {
    const room = rooms.get(streamId);
    if (!room) {
      throw new NotFoundError('Room', streamId);
    }
    return room;
  }

  async closeRoom(streamId: string): Promise<void> {
    const room = rooms.get(streamId);
    if (!room) {
      return;
    }

    room.viewers.clear();
    rooms.delete(streamId);
    pendingOffers.delete(streamId);
    pendingCandidates.delete(streamId);

    logger.info(`Signaling room closed for stream ${streamId}`);
  }

  async addViewerToRoom(streamId: string, viewer: Viewer): Promise<void> {
    const room = await this.getRoom(streamId);

    if (room.viewers.size >= room.maxViewers) {
      throw new StreamError('Room is at maximum capacity', streamId);
    }

    room.viewers.set(viewer.id, viewer);
    logger.debug(`Viewer ${viewer.id} added to room ${streamId}`);
  }

  async removeViewerFromRoom(streamId: string, viewerId: string): Promise<void> {
    const room = rooms.get(streamId);
    if (room) {
      room.viewers.delete(viewerId);
      logger.debug(`Viewer ${viewerId} removed from room ${streamId}`);
    }
  }

  async handleOffer(message: SignalingMessage): Promise<void> {
    this.validateMessage(message, SignalingMessageType.OFFER);

    const room = await this.getRoom(message.streamId);
    
    if (message.senderId !== room.broadcaster) {
      throw new ValidationError('Only broadcaster can send offers');
    }

    pendingOffers.set(message.streamId, message);
    logger.debug(`Offer received for stream ${message.streamId}`);
  }

  async handleAnswer(message: SignalingMessage): Promise<void> {
    this.validateMessage(message, SignalingMessageType.ANSWER);

    const room = await this.getRoom(message.streamId);
    
    if (!room.viewers.has(message.senderId)) {
      throw new ValidationError('Sender is not a viewer in this room');
    }

    logger.debug(`Answer received from viewer ${message.senderId} for stream ${message.streamId}`);
  }

  async handleIceCandidate(message: SignalingMessage): Promise<void> {
    this.validateMessage(message, SignalingMessageType.ICE_CANDIDATE);

    const room = await this.getRoom(message.streamId);
    
    const isParticipant = message.senderId === room.broadcaster || room.viewers.has(message.senderId);
    if (!isParticipant) {
      throw new ValidationError('Sender is not a participant in this room');
    }

    const candidates = pendingCandidates.get(message.streamId) || [];
    candidates.push(message);
    pendingCandidates.set(message.streamId, candidates);

    logger.debug(`ICE candidate received from ${message.senderId} for stream ${message.streamId}`);
  }

  async handleJoin(message: SignalingMessage): Promise<SignalingMessage | null> {
    this.validateMessage(message, SignalingMessageType.JOIN);

    const room = await this.getRoom(message.streamId);
    
    const offer = pendingOffers.get(message.streamId);
    if (offer) {
      return {
        type: SignalingMessageType.OFFER,
        streamId: message.streamId,
        senderId: room.broadcaster,
        payload: offer.payload,
        timestamp: Date.now()
      };
    }

    return null;
  }

  async handleLeave(message: SignalingMessage): Promise<void> {
    this.validateMessage(message, SignalingMessageType.LEAVE);

    await this.removeViewerFromRoom(message.streamId, message.senderId);
    logger.debug(`Leave message processed for viewer ${message.senderId} in stream ${message.streamId}`);
  }

  async handleQualityChange(message: SignalingMessage): Promise<void> {
    this.validateMessage(message, SignalingMessageType.QUALITY_CHANGE);

    const room = await this.getRoom(message.streamId);
    const viewer = room.viewers.get(message.senderId);

    if (!viewer) {
      throw new ValidationError('Viewer not found in room');
    }

    const quality = (message.payload as { quality: QualityPreset }).quality;
    if (!Object.values(QualityPreset).includes(quality)) {
      throw new ValidationError('Invalid quality preset');
    }

    viewer.quality = quality;
    room.viewers.set(message.senderId, viewer);

    logger.debug(`Quality changed to ${quality} for viewer ${message.senderId} in stream ${message.streamId}`);
  }

  async processMessage(message: SignalingMessage): Promise<SignalingMessage | null> {
    switch (message.type) {
      case SignalingMessageType.OFFER:
        await this.handleOffer(message);
        return null;
      case SignalingMessageType.ANSWER:
        await this.handleAnswer(message);
        return null;
      case SignalingMessageType.ICE_CANDIDATE:
        await this.handleIceCandidate(message);
        return null;
      case SignalingMessageType.JOIN:
        return this.handleJoin(message);
      case SignalingMessageType.LEAVE:
        await this.handleLeave(message);
        return null;
      case SignalingMessageType.QUALITY_CHANGE:
        await this.handleQualityChange(message);
        return null;
      default:
        throw new ValidationError(`Unknown message type: ${message.type}`);
    }
  }

  async getPendingCandidates(streamId: string): Promise<SignalingMessage[]> {
    return pendingCandidates.get(streamId) || [];
  }

  async clearPendingCandidates(streamId: string): Promise<void> {
    pendingCandidates.delete(streamId);
  }

  async getRoomStats(streamId: string): Promise<{
    viewerCount: number;
    maxViewers: number;
    broadcaster: string;
    createdAt: Date;
  }> {
    const room = await this.getRoom(streamId);
    return {
      viewerCount: room.viewers.size,
      maxViewers: room.maxViewers,
      broadcaster: room.broadcaster,
      createdAt: room.createdAt
    };
  }

  async getAllRooms(): Promise<string[]> {
    return Array.from(rooms.keys());
  }

  createMessage(
    type: SignalingMessageType,
    streamId: string,
    senderId: string,
    payload: unknown
  ): SignalingMessage {
    return {
      type,
      streamId,
      senderId,
      payload,
      timestamp: Date.now()
    };
  }

  createErrorMessage(streamId: string, error: string): SignalingMessage {
    return {
      type: SignalingMessageType.ERROR,
      streamId,
      senderId: 'server',
      payload: { error },
      timestamp: Date.now()
    };
  }

  private validateMessage(message: SignalingMessage, expectedType: SignalingMessageType): void {
    if (message.type !== expectedType) {
      throw new ValidationError(`Expected message type ${expectedType}, got ${message.type}`);
    }

    if (!message.streamId) {
      throw new ValidationError('Stream ID is required');
    }

    if (!message.senderId) {
      throw new ValidationError('Sender ID is required');
    }
  }

  clear(): void {
    rooms.clear();
    pendingOffers.clear();
    pendingCandidates.clear();
  }
}

export const signalingService = new SignalingService();
