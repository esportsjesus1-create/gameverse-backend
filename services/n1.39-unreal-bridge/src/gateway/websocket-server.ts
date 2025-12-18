import { WebSocketServer, WebSocket, RawData } from 'ws';
import { IncomingMessage } from 'http';
import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  UnrealBridgeConfig,
  SessionData,
  BaseMessage,
  ConnectPayload,
  HeartbeatPayload
} from '../types';
import { SessionManager } from './session-manager';
import { MessageHandler } from '../protocol/handler';
import { MessageSerializer } from '../protocol/serializer';
import { UnrealBridgeError, createErrorPayload } from '../utils/errors';
import pino from 'pino';

export interface WebSocketServerEvents {
  connection: (session: SessionData, ws: WebSocket) => void;
  disconnection: (session: SessionData) => void;
  message: (message: BaseMessage, session: SessionData) => void;
  error: (error: Error, session?: SessionData) => void;
}

interface ClientConnection {
  ws: WebSocket;
  sessionId: string;
  isAlive: boolean;
}

export class UnrealWebSocketServer extends EventEmitter<WebSocketServerEvents> {
  private wss: WebSocketServer | null = null;
  private readonly config: UnrealBridgeConfig;
  private readonly sessionManager: SessionManager;
  private readonly messageHandler: MessageHandler;
  private readonly serializer: MessageSerializer;
  private readonly logger: pino.Logger;
  private readonly connections: Map<string, ClientConnection>;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    config: UnrealBridgeConfig,
    sessionManager: SessionManager,
    logger: pino.Logger
  ) {
    super();
    this.config = config;
    this.sessionManager = sessionManager;
    this.logger = logger;
    this.connections = new Map();
    this.serializer = new MessageSerializer({
      useBinary: config.enableBinaryProtocol,
      includeChecksum: true
    });
    this.messageHandler = new MessageHandler(this.serializer, logger);
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    this.messageHandler.on('connect', (payload, message, session) => {
      this.handleConnect(payload, message, session);
    });

    this.messageHandler.on('disconnect', (_message, session) => {
      if (session) {
        this.handleDisconnect(session.sessionId);
      }
    });

    this.messageHandler.on('heartbeat', (payload, message, session) => {
      this.handleHeartbeat(payload, message, session);
    });

    this.messageHandler.on('error', (error, message, session) => {
      this.handleError(error, message, session);
    });
  }

  start(): void {
    this.wss = new WebSocketServer({
      port: this.config.port,
      host: this.config.host,
      path: this.config.wsPath,
      maxPayload: this.config.maxMessageSize,
      perMessageDeflate: this.config.enableCompression
    });

    this.wss.on('connection', (ws, req) => this.onConnection(ws, req));
    this.wss.on('error', (error) => this.emit('error', error));

    this.startHeartbeatCheck();
    this.startCleanupInterval();

    this.logger.info(
      { port: this.config.port, path: this.config.wsPath },
      'WebSocket server started'
    );
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    for (const [sessionId, connection] of this.connections) {
      connection.ws.close(1001, 'Server shutting down');
      this.connections.delete(sessionId);
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.logger.info('WebSocket server stopped');
  }

  private onConnection(ws: WebSocket, req: IncomingMessage): void {
    const tempSessionId = uuidv4();
    
    this.logger.debug(
      { tempSessionId, remoteAddress: req.socket.remoteAddress },
      'New WebSocket connection'
    );

    const connection: ClientConnection = {
      ws,
      sessionId: tempSessionId,
      isAlive: true
    };

    this.connections.set(tempSessionId, connection);

    ws.on('message', (data: RawData) => this.onMessage(data, tempSessionId));
    ws.on('close', (code, reason) => this.onClose(tempSessionId, code, reason.toString()));
    ws.on('error', (error) => this.onError(tempSessionId, error));
    ws.on('pong', () => this.onPong(tempSessionId));
  }

  private async onMessage(data: RawData, connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const session = this.sessionManager.getSession(connection.sessionId);
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);

    try {
      await this.messageHandler.handleMessage(buffer, session);
    } catch (error) {
      this.logger.error({ error, connectionId }, 'Error handling message');
    }
  }

  private onClose(connectionId: string, code: number, reason: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    this.logger.info({ connectionId, code, reason }, 'WebSocket connection closed');

    const session = this.sessionManager.getSession(connection.sessionId);
    if (session) {
      this.sessionManager.updateSessionState(session.sessionId, 'DISCONNECTED');
      this.emit('disconnection', session);
    }

    this.connections.delete(connectionId);
  }

  private onError(connectionId: string, error: Error): void {
    const connection = this.connections.get(connectionId);
    const session = connection
      ? this.sessionManager.getSession(connection.sessionId)
      : undefined;

    this.logger.error({ connectionId, error }, 'WebSocket error');
    this.emit('error', error, session);
  }

  private onPong(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isAlive = true;
    }
  }

  private handleConnect(
    payload: ConnectPayload,
    message: BaseMessage,
    _existingSession?: SessionData
  ): void {
    let session: SessionData;

    if (payload.reconnectToken) {
      try {
        session = this.sessionManager.reconnectSession(
          payload.reconnectToken,
          payload.clientInfo
        );
      } catch {
        session = this.sessionManager.createSession(payload.clientInfo);
      }
    } else {
      session = this.sessionManager.createSession(payload.clientInfo);
    }

    const tempConnection = this.findConnectionByTempId(message.header.clientId);
    if (tempConnection) {
      tempConnection.sessionId = session.sessionId;
      this.connections.delete(message.header.clientId || '');
      this.connections.set(session.sessionId, tempConnection);
    }

    this.sessionManager.updateSessionState(session.sessionId, 'CONNECTED');

    const response = this.serializer.createMessage(
      'ACK',
      {
        sessionId: session.sessionId,
        reconnectToken: session.reconnectToken,
        serverTime: Date.now()
      },
      message.header.id
    );

    this.sendToSession(session.sessionId, this.serializer.serialize(response));
    this.emit('connection', session, tempConnection?.ws as WebSocket);
  }

  private handleHeartbeat(
    payload: HeartbeatPayload,
    message: BaseMessage,
    session?: SessionData
  ): void {
    if (!session) return;

    const serverTimestamp = Date.now();
    const latency = serverTimestamp - payload.clientTimestamp;

    this.sessionManager.updateHeartbeat(session.sessionId, latency);

    const response = this.serializer.createMessage(
      'HEARTBEAT',
      {
        clientTimestamp: payload.clientTimestamp,
        serverTimestamp,
        latency
      },
      message.header.id
    );

    this.sendToSession(session.sessionId, this.serializer.serialize(response));
  }

  private handleError(
    error: UnrealBridgeError,
    message?: BaseMessage,
    session?: SessionData
  ): void {
    const errorPayload = createErrorPayload(error);
    const response = this.serializer.createMessage(
      'ERROR',
      errorPayload,
      message?.header.id
    );

    if (session) {
      this.sendToSession(session.sessionId, this.serializer.serialize(response));
    }

    this.emit('error', error, session);
  }

  private handleDisconnect(sessionId: string): void {
    const session = this.sessionManager.getSession(sessionId);
    if (session) {
      this.sessionManager.updateSessionState(sessionId, 'DISCONNECTING');
    }

    const connection = this.connections.get(sessionId);
    if (connection) {
      connection.ws.close(1000, 'Client requested disconnect');
    }
  }

  private findConnectionByTempId(tempId?: string): ClientConnection | undefined {
    if (!tempId) return undefined;
    return this.connections.get(tempId);
  }

  sendToSession(sessionId: string, data: Buffer | string): boolean {
    const connection = this.connections.get(sessionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    connection.ws.send(data);
    return true;
  }

  broadcast(data: Buffer | string, excludeSessionIds?: string[]): number {
    let sentCount = 0;
    const excludeSet = new Set(excludeSessionIds || []);

    for (const [sessionId, connection] of this.connections) {
      if (excludeSet.has(sessionId)) continue;
      if (connection.ws.readyState !== WebSocket.OPEN) continue;

      connection.ws.send(data);
      sentCount++;
    }

    return sentCount;
  }

  sendToClients(sessionIds: string[], data: Buffer | string): number {
    let sentCount = 0;

    for (const sessionId of sessionIds) {
      if (this.sendToSession(sessionId, data)) {
        sentCount++;
      }
    }

    return sentCount;
  }

  private startHeartbeatCheck(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [sessionId, connection] of this.connections) {
        if (!connection.isAlive) {
          this.logger.warn({ sessionId }, 'Connection heartbeat timeout');
          connection.ws.terminate();
          this.connections.delete(sessionId);
          continue;
        }

        connection.isAlive = false;
        connection.ws.ping();
      }
    }, this.config.heartbeatInterval);
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const cleaned = this.sessionManager.cleanupStaleSessions(
        this.config.heartbeatTimeout
      );
      if (cleaned > 0) {
        this.logger.info({ cleaned }, 'Cleaned up stale sessions');
      }
    }, this.config.heartbeatTimeout);
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getMessageHandler(): MessageHandler {
    return this.messageHandler;
  }

  getSerializer(): MessageSerializer {
    return this.serializer;
  }
}
