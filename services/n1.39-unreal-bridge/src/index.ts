import { createServer, Server } from 'http';
import {
  UnrealBridgeConfig,
  BridgeMetrics,
  SessionData,
  BaseMessage
} from './types';
import {
  SessionManager,
  UnrealWebSocketServer,
  createRestApi
} from './gateway';
import { SyncManager } from './sync';
import { AssetManager } from './streaming';
import { RPCRegistry, PluginManager, EventBus } from './sdk';
import { StateStore } from './state';
import { createLogger, defaultLogger } from './utils/logger';
import pino from 'pino';

export * from './types';
export * from './gateway';
export * from './sync';
export * from './streaming';
export * from './sdk';
export * from './state';
export * from './protocol';
export * from './utils';

export interface UnrealBridgeOptions {
  config?: Partial<UnrealBridgeConfig>;
  logger?: pino.Logger;
}

const DEFAULT_CONFIG: UnrealBridgeConfig = {
  port: 8080,
  host: '0.0.0.0',
  wsPath: '/ws',
  apiPath: '/api',
  maxConnections: 1000,
  heartbeatInterval: 30000,
  heartbeatTimeout: 90000,
  reconnectWindow: 300000,
  maxMessageSize: 10 * 1024 * 1024,
  enableCompression: true,
  enableBinaryProtocol: true,
  authRequired: false,
  corsOrigins: ['*'],
  logLevel: 'info'
};

export class UnrealBridge {
  private readonly config: UnrealBridgeConfig;
  private readonly logger: pino.Logger;
  private readonly sessionManager: SessionManager;
  private readonly wsServer: UnrealWebSocketServer;
  private readonly syncManager: SyncManager;
  private readonly assetManager: AssetManager;
  private readonly rpcRegistry: RPCRegistry;
  private readonly pluginManager: PluginManager;
  private readonly eventBus: EventBus;
  private readonly stateStore: StateStore;
  private httpServer: Server | null = null;
  private startTime = 0;
  private metrics: BridgeMetrics;

  constructor(options: UnrealBridgeOptions = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.logger = options.logger || createLogger({ level: this.config.logLevel });

    this.sessionManager = new SessionManager(
      {
        maxSessions: this.config.maxConnections,
        sessionTTL: this.config.heartbeatTimeout * 2,
        reconnectWindow: this.config.reconnectWindow
      },
      this.logger
    );

    this.wsServer = new UnrealWebSocketServer(
      this.config,
      this.sessionManager,
      this.logger
    );

    this.syncManager = new SyncManager(
      {
        maxStates: 10000,
        snapshotInterval: 60000,
        snapshotTTL: 3600000,
        enableDeltaCompression: true
      },
      this.logger
    );

    this.assetManager = new AssetManager(
      {
        maxAssets: 1000,
        defaultChunkSize: 64 * 1024,
        maxConcurrentTransfers: 5,
        transferTimeout: 300000,
        cacheSize: 100
      },
      this.logger
    );

    this.rpcRegistry = new RPCRegistry(
      {
        defaultTimeout: 30000,
        maxConcurrentCalls: 100
      },
      this.logger
    );

    this.pluginManager = new PluginManager(this.rpcRegistry, this.logger);

    this.eventBus = new EventBus(
      {
        maxListeners: 1000,
        enableWildcard: true
      },
      this.logger
    );

    this.stateStore = new StateStore(
      {
        maxEntries: 10000,
        snapshotCapacity: 1000,
        enablePersistence: false,
        transactionTimeout: 30000
      },
      this.logger
    );

    this.metrics = this.createInitialMetrics();

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.wsServer.on('connection', (session: SessionData) => {
      this.metrics.totalConnections++;
      this.metrics.activeConnections = this.sessionManager.getActiveSessionCount();
      this.pluginManager.onConnect(session);
      this.eventBus.emit('client:connected', { sessionId: session.sessionId });
    });

    this.wsServer.on('disconnection', (session: SessionData) => {
      this.metrics.activeConnections = this.sessionManager.getActiveSessionCount();
      this.syncManager.unsubscribeAll(session.sessionId);
      this.assetManager.cancelAllTransfers(session.sessionId);
      this.pluginManager.onDisconnect(session);
      this.eventBus.emit('client:disconnected', { sessionId: session.sessionId });
    });

    this.wsServer.on('message', (message: BaseMessage, session: SessionData) => {
      this.metrics.messagesReceived++;
      this.pluginManager.onMessage(message, session);
    });

    this.wsServer.on('error', (error: Error, session?: SessionData) => {
      this.metrics.errorCount++;
      this.logger.error({ error, sessionId: session?.sessionId }, 'Bridge error');
    });

    const messageHandler = this.wsServer.getMessageHandler();

    messageHandler.on('stateSync', (payload, message, session) => {
      if (!session) return;
      this.handleStateSync(payload, message, session);
    });

    messageHandler.on('stateUpdate', (payload, message, session) => {
      if (!session) return;
      this.handleStateUpdate(payload, message, session);
    });

    messageHandler.on('assetRequest', (payload, message, session) => {
      if (!session) return;
      this.handleAssetRequest(payload, message, session);
    });

    messageHandler.on('rpcRequest', (payload, message, session) => {
      if (!session) return;
      this.handleRPCRequest(payload, message, session);
    });

    messageHandler.on('event', (payload, _message, session) => {
      this.handleEvent({
        eventType: payload.eventType,
        eventData: payload.eventData,
        broadcast: payload.broadcast,
        targetClients: payload.targetClients
      }, session);
    });
  }

  private handleStateSync(
    payload: { stateId: string; fullState: boolean },
    message: BaseMessage,
    session: SessionData
  ): void {
    const syncPayload = this.syncManager.createSyncPayload(payload.stateId, payload.fullState);
    
    if (syncPayload) {
      this.syncManager.subscribe(payload.stateId, session.sessionId);
      const response = this.wsServer.getSerializer().createMessage(
        'STATE_SYNC',
        syncPayload,
        message.header.id
      );
      this.wsServer.sendToSession(
        session.sessionId,
        this.wsServer.getSerializer().serialize(response)
      );
    }
  }

  private handleStateUpdate(
    payload: { stateId: string; version: number; operations: Array<{ op: string; path: string; value?: unknown; from?: string }> },
    message: BaseMessage,
    session: SessionData
  ): void {
    try {
      const entry = this.syncManager.applyOperations(payload.stateId, {
        stateId: payload.stateId,
        version: payload.version,
        delta: null,
        operations: payload.operations.map(op => ({
          op: op.op as 'add' | 'remove' | 'replace' | 'move' | 'copy',
          path: op.path,
          value: op.value,
          from: op.from
        }))
      });

      const subscribers = this.syncManager.getSubscribers(payload.stateId);
      const syncPayload = this.syncManager.createSyncPayload(payload.stateId);

      if (syncPayload) {
        const broadcast = this.wsServer.getSerializer().createMessage(
          'STATE_SYNC',
          syncPayload
        );
        this.wsServer.sendToClients(
          subscribers.filter(s => s !== session.sessionId),
          this.wsServer.getSerializer().serialize(broadcast)
        );
      }

      const ack = this.wsServer.getSerializer().createMessage(
        'ACK',
        { stateId: payload.stateId, version: entry.version },
        message.header.id
      );
      this.wsServer.sendToSession(
        session.sessionId,
        this.wsServer.getSerializer().serialize(ack)
      );
    } catch (error) {
      this.logger.error({ error, stateId: payload.stateId }, 'State update failed');
    }
  }

  private handleAssetRequest(
    payload: { assetId: string; assetType: string; priority: number; chunkSize?: number; resumeFrom?: number },
    message: BaseMessage,
    session: SessionData
  ): void {
    try {
      const manifest = this.assetManager.startTransfer(
        {
          assetId: payload.assetId,
          assetType: payload.assetType as 'texture' | 'mesh' | 'animation' | 'audio' | 'blueprint' | 'level' | 'material' | 'other',
          priority: payload.priority,
          chunkSize: payload.chunkSize,
          resumeFrom: payload.resumeFrom
        },
        session.sessionId
      );

      const ack = this.wsServer.getSerializer().createMessage(
        'ACK',
        { assetId: payload.assetId, manifest },
        message.header.id
      );
      this.wsServer.sendToSession(
        session.sessionId,
        this.wsServer.getSerializer().serialize(ack)
      );

      this.sendAssetChunks(payload.assetId, session.sessionId);
    } catch (error) {
      this.logger.error({ error, assetId: payload.assetId }, 'Asset request failed');
    }
  }

  private sendAssetChunks(assetId: string, sessionId: string): void {
    const sendNextChunk = (): void => {
      const chunk = this.assetManager.getNextChunk(assetId, sessionId);
      
      if (chunk) {
        const message = this.wsServer.getSerializer().createMessage('ASSET_CHUNK', chunk);
        this.wsServer.sendToSession(sessionId, this.wsServer.getSerializer().serialize(message));
        
        setImmediate(sendNextChunk);
      } else {
        const complete = this.wsServer.getSerializer().createMessage('ASSET_COMPLETE', { assetId });
        this.wsServer.sendToSession(sessionId, this.wsServer.getSerializer().serialize(complete));
      }
    };

    sendNextChunk();
  }

  private async handleRPCRequest(
    payload: { method: string; params?: Record<string, unknown>; timeout?: number },
    message: BaseMessage,
    session: SessionData
  ): Promise<void> {
    const response = await this.rpcRegistry.executeMethod(
      payload,
      {
        clientId: session.clientId,
        sessionId: session.sessionId,
        clientInfo: session.clientInfo,
        metadata: session.metadata
      }
    );

    const rpcResponse = this.wsServer.getSerializer().createMessage(
      'RPC_RESPONSE',
      response,
      message.header.id
    );
    this.wsServer.sendToSession(
      session.sessionId,
      this.wsServer.getSerializer().serialize(rpcResponse)
    );
  }

  private handleEvent(
    payload: { eventType: string; eventData: unknown; broadcast: boolean; targetClients?: string[] },
    session?: SessionData
  ): void {
    this.eventBus.emit(payload.eventType, payload.eventData, {
      clientId: session?.clientId,
      sessionId: session?.sessionId
    });

    if (payload.broadcast) {
      const eventMessage = this.wsServer.getSerializer().createMessage('EVENT', payload);
      
      if (payload.targetClients && payload.targetClients.length > 0) {
        this.wsServer.sendToClients(
          payload.targetClients,
          this.wsServer.getSerializer().serialize(eventMessage)
        );
      } else {
        this.wsServer.broadcast(
          this.wsServer.getSerializer().serialize(eventMessage),
          session ? [session.sessionId] : []
        );
      }
    }
  }

  private createInitialMetrics(): BridgeMetrics {
    return {
      activeConnections: 0,
      totalConnections: 0,
      messagesReceived: 0,
      messagesSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      averageLatency: 0,
      errorCount: 0,
      uptime: 0
    };
  }

  async start(): Promise<void> {
    this.startTime = Date.now();

    this.rpcRegistry.registerBuiltinMethods();
    this.rpcRegistry.start();
    this.syncManager.start();
    this.assetManager.start();
    await this.pluginManager.initialize();

    const restApi = createRestApi(
      this.config,
      {
        sessionManager: this.sessionManager,
        getMetrics: () => this.getMetrics()
      },
      this.logger
    );

    this.httpServer = createServer(restApi);
    
    this.httpServer.listen(this.config.port, this.config.host, () => {
      this.logger.info(
        { port: this.config.port, host: this.config.host },
        'Unreal Bridge HTTP server started'
      );
    });

    this.wsServer.start();

    this.logger.info('Unreal Bridge started');
  }

  async stop(): Promise<void> {
    this.wsServer.stop();
    this.rpcRegistry.stop();
    this.syncManager.stop();
    this.assetManager.stop();
    await this.pluginManager.shutdown();

    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }

    this.logger.info('Unreal Bridge stopped');
  }

  getMetrics(): BridgeMetrics {
    return {
      ...this.metrics,
      activeConnections: this.sessionManager.getActiveSessionCount(),
      uptime: Date.now() - this.startTime
    };
  }

  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  getSyncManager(): SyncManager {
    return this.syncManager;
  }

  getAssetManager(): AssetManager {
    return this.assetManager;
  }

  getRPCRegistry(): RPCRegistry {
    return this.rpcRegistry;
  }

  getPluginManager(): PluginManager {
    return this.pluginManager;
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }

  getStateStore(): StateStore {
    return this.stateStore;
  }

  getConfig(): UnrealBridgeConfig {
    return { ...this.config };
  }
}

export default UnrealBridge;
