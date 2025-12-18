import { EventEmitter } from 'eventemitter3';
import {
  BaseMessage,
  MessageType,
  ConnectPayload,
  HeartbeatPayload,
  StateSyncPayload,
  StateUpdatePayload,
  AssetRequestPayload,
  RPCRequestPayload,
  EventPayload,
  SessionData,
  ConnectPayloadSchema,
  HeartbeatPayloadSchema,
  StateSyncPayloadSchema,
  StateUpdatePayloadSchema,
  AssetRequestPayloadSchema,
  RPCRequestPayloadSchema,
  EventPayloadSchema
} from '../types';
import { UnrealBridgeError, ErrorCode } from '../utils/errors';
import { MessageSerializer } from './serializer';
import pino from 'pino';

export interface MessageHandlerEvents {
  connect: (payload: ConnectPayload, message: BaseMessage, session?: SessionData) => void;
  disconnect: (message: BaseMessage, session?: SessionData) => void;
  heartbeat: (payload: HeartbeatPayload, message: BaseMessage, session?: SessionData) => void;
  stateSync: (payload: StateSyncPayload, message: BaseMessage, session?: SessionData) => void;
  stateUpdate: (payload: StateUpdatePayload, message: BaseMessage, session?: SessionData) => void;
  assetRequest: (payload: AssetRequestPayload, message: BaseMessage, session?: SessionData) => void;
  rpcRequest: (payload: RPCRequestPayload, message: BaseMessage, session?: SessionData) => void;
  event: (payload: EventPayload, message: BaseMessage, session?: SessionData) => void;
  error: (error: UnrealBridgeError, message?: BaseMessage, session?: SessionData) => void;
}

export class MessageHandler extends EventEmitter<MessageHandlerEvents> {
  private readonly serializer: MessageSerializer;
  private readonly logger: pino.Logger;

  constructor(serializer: MessageSerializer, logger: pino.Logger) {
    super();
    this.serializer = serializer;
    this.logger = logger;
  }

  async handleMessage(data: Buffer | string, session?: SessionData): Promise<void> {
    let message: BaseMessage;

    try {
      message = this.serializer.deserialize(data);
    } catch (error) {
      const bridgeError = new UnrealBridgeError(
        ErrorCode.INVALID_MESSAGE,
        `Failed to deserialize message: ${(error as Error).message}`,
        true
      );
      this.emit('error', bridgeError, undefined, session);
      return;
    }

    try {
      await this.routeMessage(message, session);
    } catch (error) {
      if (error instanceof UnrealBridgeError) {
        this.emit('error', error, message, session);
      } else {
        const bridgeError = new UnrealBridgeError(
          ErrorCode.UNKNOWN,
          `Unexpected error handling message: ${(error as Error).message}`,
          true
        );
        this.emit('error', bridgeError, message, session);
      }
    }
  }

  private async routeMessage(message: BaseMessage, session?: SessionData): Promise<void> {
    const { type } = message.header;

    this.logger.debug({ type, messageId: message.header.id }, 'Routing message');

    switch (type) {
      case 'CONNECT':
        this.handleConnect(message, session);
        break;
      case 'DISCONNECT':
        this.emit('disconnect', message, session);
        break;
      case 'HEARTBEAT':
        this.handleHeartbeat(message, session);
        break;
      case 'STATE_SYNC':
        this.handleStateSync(message, session);
        break;
      case 'STATE_UPDATE':
        this.handleStateUpdate(message, session);
        break;
      case 'ASSET_REQUEST':
        this.handleAssetRequest(message, session);
        break;
      case 'RPC_REQUEST':
        this.handleRPCRequest(message, session);
        break;
      case 'EVENT':
        this.handleEvent(message, session);
        break;
      case 'ACK':
        break;
      default:
        throw new UnrealBridgeError(
          ErrorCode.INVALID_MESSAGE,
          `Unknown message type: ${type}`,
          true
        );
    }
  }

  private handleConnect(message: BaseMessage, session?: SessionData): void {
    const result = ConnectPayloadSchema.safeParse(message.payload);
    if (!result.success) {
      throw new UnrealBridgeError(
        ErrorCode.INVALID_PAYLOAD,
        `Invalid connect payload: ${result.error.message}`,
        true,
        result.error.issues
      );
    }
    this.emit('connect', result.data, message, session);
  }

  private handleHeartbeat(message: BaseMessage, session?: SessionData): void {
    const result = HeartbeatPayloadSchema.safeParse(message.payload);
    if (!result.success) {
      throw new UnrealBridgeError(
        ErrorCode.INVALID_PAYLOAD,
        `Invalid heartbeat payload: ${result.error.message}`,
        true,
        result.error.issues
      );
    }
    this.emit('heartbeat', result.data, message, session);
  }

  private handleStateSync(message: BaseMessage, session?: SessionData): void {
    const result = StateSyncPayloadSchema.safeParse(message.payload);
    if (!result.success) {
      throw new UnrealBridgeError(
        ErrorCode.INVALID_PAYLOAD,
        `Invalid state sync payload: ${result.error.message}`,
        true,
        result.error.issues
      );
    }
    this.emit('stateSync', result.data, message, session);
  }

  private handleStateUpdate(message: BaseMessage, session?: SessionData): void {
    const result = StateUpdatePayloadSchema.safeParse(message.payload);
    if (!result.success) {
      throw new UnrealBridgeError(
        ErrorCode.INVALID_PAYLOAD,
        `Invalid state update payload: ${result.error.message}`,
        true,
        result.error.issues
      );
    }
    this.emit('stateUpdate', result.data, message, session);
  }

  private handleAssetRequest(message: BaseMessage, session?: SessionData): void {
    const result = AssetRequestPayloadSchema.safeParse(message.payload);
    if (!result.success) {
      throw new UnrealBridgeError(
        ErrorCode.INVALID_PAYLOAD,
        `Invalid asset request payload: ${result.error.message}`,
        true,
        result.error.issues
      );
    }
    this.emit('assetRequest', result.data, message, session);
  }

  private handleRPCRequest(message: BaseMessage, session?: SessionData): void {
    const result = RPCRequestPayloadSchema.safeParse(message.payload);
    if (!result.success) {
      throw new UnrealBridgeError(
        ErrorCode.INVALID_PAYLOAD,
        `Invalid RPC request payload: ${result.error.message}`,
        true,
        result.error.issues
      );
    }
    this.emit('rpcRequest', result.data, message, session);
  }

  private handleEvent(message: BaseMessage, session?: SessionData): void {
    const result = EventPayloadSchema.safeParse(message.payload);
    if (!result.success) {
      throw new UnrealBridgeError(
        ErrorCode.INVALID_PAYLOAD,
        `Invalid event payload: ${result.error.message}`,
        true,
        result.error.issues
      );
    }
    this.emit('event', result.data, message, session);
  }

  createResponse(
    type: MessageType,
    payload: unknown,
    correlationId?: string
  ): Buffer | string {
    const message = this.serializer.createMessage(type, payload, correlationId);
    return this.serializer.serialize(message);
  }
}
