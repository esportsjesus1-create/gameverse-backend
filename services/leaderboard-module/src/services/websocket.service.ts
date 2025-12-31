import { Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { cacheService } from '../config/redis';
import { logger, EventType } from '../utils/logger';
import {
  WebSocketSubscription,
  WebSocketSubscriptionSchema,
} from '../types';
import { config } from '../config';

interface WebSocketClient {
  id: string;
  ws: WebSocket;
  playerId?: string;
  subscriptions: Set<string>;
  isAuthenticated: boolean;
  lastHeartbeat: Date;
  connectedAt: Date;
}

interface BroadcastMessage {
  type: 'RANK_CHANGE' | 'SCORE_UPDATE' | 'NEW_ENTRY' | 'ENTRY_REMOVED' | 'LEADERBOARD_RESET' | 'HEARTBEAT' | 'ERROR' | 'SUBSCRIBED' | 'UNSUBSCRIBED';
  leaderboardId?: string;
  playerId?: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private leaderboardSubscribers: Map<string, Set<string>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor() {
    logger.info(EventType.SERVICE_STARTED, 'WebSocket service created');
  }

  public initialize(server: HttpServer): void {
    if (this.isInitialized) {
      logger.warn(EventType.WEBSOCKET_ERROR, 'WebSocket service already initialized');
      return;
    }

    if (!config.WEBSOCKET_ENABLED) {
      logger.info(EventType.SERVICE_STARTED, 'WebSocket service disabled by configuration');
      return;
    }

    this.wss = new WebSocketServer({ server, path: '/api/v1/leaderboard/live' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error: Error) => {
      logger.error(EventType.WEBSOCKET_ERROR, 'WebSocket server error', error);
    });

    this.startHeartbeat();
    this.isInitialized = true;

    logger.info(EventType.SERVICE_STARTED, 'WebSocket service initialized');
  }

  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    for (const client of this.clients.values()) {
      client.ws.close(1001, 'Server shutting down');
    }

    this.clients.clear();
    this.leaderboardSubscribers.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.isInitialized = false;
    logger.info(EventType.SERVICE_STOPPED, 'WebSocket service shut down');
  }

  private handleConnection(ws: WebSocket, _req: { url?: string; headers: { [key: string]: string | string[] | undefined } }): void {
    const clientId = uuidv4();
    const now = new Date();

    const client: WebSocketClient = {
      id: clientId,
      ws,
      subscriptions: new Set(),
      isAuthenticated: false,
      lastHeartbeat: now,
      connectedAt: now,
    };

    this.clients.set(clientId, client);

    logger.logWebSocketConnected(clientId);

    ws.on('message', (data: Buffer) => {
      this.handleMessage(clientId, data);
    });

    ws.on('close', (code: number, reason: Buffer) => {
      this.handleDisconnection(clientId, code, reason.toString());
    });

    ws.on('error', (error: Error) => {
      logger.error(EventType.WEBSOCKET_ERROR, `WebSocket client error: ${clientId}`, error);
    });

    ws.on('pong', () => {
      const c = this.clients.get(clientId);
      if (c) {
        c.lastHeartbeat = new Date();
      }
    });

    this.sendToClient(clientId, {
      type: 'HEARTBEAT',
      data: { message: 'Connected to leaderboard live updates', clientId },
      timestamp: now,
    });
  }

  private handleMessage(clientId: string, data: Buffer): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'AUTH') {
        this.handleAuthentication(clientId, message.token);
        return;
      }

      if (message.action === 'SUBSCRIBE' || message.action === 'UNSUBSCRIBE') {
        const parsed = WebSocketSubscriptionSchema.safeParse(message);
        if (!parsed.success) {
          this.sendError(clientId, 'Invalid subscription message format');
          return;
        }
        this.handleSubscription(clientId, parsed.data);
        return;
      }

      if (message.type === 'PING') {
        client.lastHeartbeat = new Date();
        this.sendToClient(clientId, {
          type: 'HEARTBEAT',
          data: { pong: true },
          timestamp: new Date(),
        });
        return;
      }

      logger.debug(EventType.WEBSOCKET_MESSAGE_SENT, `Unknown message type from client ${clientId}`, undefined, { message });
    } catch (error) {
      logger.error(EventType.WEBSOCKET_ERROR, `Failed to parse message from client ${clientId}`, error as Error);
      this.sendError(clientId, 'Invalid message format');
    }
  }

  private handleAuthentication(clientId: string, token?: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (!token) {
      client.isAuthenticated = true;
      this.sendToClient(clientId, {
        type: 'SUBSCRIBED',
        data: { authenticated: true, anonymous: true },
        timestamp: new Date(),
      });
      return;
    }

    try {
      client.isAuthenticated = true;
      client.playerId = `player_${token.slice(0, 8)}`;

      this.sendToClient(clientId, {
        type: 'SUBSCRIBED',
        data: { authenticated: true, playerId: client.playerId },
        timestamp: new Date(),
      });

      logger.info(EventType.WEBSOCKET_CONNECTED, `Client ${clientId} authenticated as ${client.playerId}`);
    } catch (error) {
      this.sendError(clientId, 'Authentication failed');
      logger.error(EventType.WEBSOCKET_ERROR, `Authentication failed for client ${clientId}`, error as Error);
    }
  }

  private handleSubscription(clientId: string, subscription: WebSocketSubscription): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (subscription.action === 'SUBSCRIBE') {
      const totalSubscriptions = client.subscriptions.size + subscription.leaderboardIds.length;
      if (totalSubscriptions > config.WEBSOCKET_MAX_SUBSCRIPTIONS) {
        this.sendError(clientId, `Maximum subscription limit of ${config.WEBSOCKET_MAX_SUBSCRIPTIONS} exceeded`);
        return;
      }

      for (const leaderboardId of subscription.leaderboardIds) {
        client.subscriptions.add(leaderboardId);

        if (!this.leaderboardSubscribers.has(leaderboardId)) {
          this.leaderboardSubscribers.set(leaderboardId, new Set());
        }
        this.leaderboardSubscribers.get(leaderboardId)!.add(clientId);
      }

      logger.logWebSocketSubscribed(clientId, subscription.leaderboardIds);

      this.sendToClient(clientId, {
        type: 'SUBSCRIBED',
        data: {
          leaderboardIds: subscription.leaderboardIds,
          totalSubscriptions: client.subscriptions.size,
        },
        timestamp: new Date(),
      });
    } else {
      for (const leaderboardId of subscription.leaderboardIds) {
        client.subscriptions.delete(leaderboardId);
        this.leaderboardSubscribers.get(leaderboardId)?.delete(clientId);
      }

      logger.info(EventType.WEBSOCKET_UNSUBSCRIBED, `Client ${clientId} unsubscribed from ${subscription.leaderboardIds.length} leaderboards`);

      this.sendToClient(clientId, {
        type: 'UNSUBSCRIBED',
        data: {
          leaderboardIds: subscription.leaderboardIds,
          totalSubscriptions: client.subscriptions.size,
        },
        timestamp: new Date(),
      });
    }

    cacheService.setWebSocketSubscriptions(clientId, Array.from(client.subscriptions));
  }

  private handleDisconnection(clientId: string, code: number, reason: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    for (const leaderboardId of client.subscriptions) {
      this.leaderboardSubscribers.get(leaderboardId)?.delete(clientId);
    }

    this.clients.delete(clientId);
    cacheService.removeWebSocketSubscriptions(clientId);

    logger.logWebSocketDisconnected(clientId, `Code: ${code}, Reason: ${reason}`);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const timeout = config.WEBSOCKET_HEARTBEAT_INTERVAL * 2;

      for (const [clientId, client] of this.clients) {
        if (now.getTime() - client.lastHeartbeat.getTime() > timeout) {
          logger.warn(EventType.WEBSOCKET_DISCONNECTED, `Client ${clientId} timed out`);
          client.ws.terminate();
          this.handleDisconnection(clientId, 1006, 'Heartbeat timeout');
          continue;
        }

        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      }
    }, config.WEBSOCKET_HEARTBEAT_INTERVAL);
  }

  private sendToClient(clientId: string, message: BroadcastMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error(EventType.WEBSOCKET_ERROR, `Failed to send message to client ${clientId}`, error as Error);
    }
  }

  private sendError(clientId: string, errorMessage: string): void {
    this.sendToClient(clientId, {
      type: 'ERROR',
      data: { error: errorMessage },
      timestamp: new Date(),
    });
  }

  public broadcastRankChange(
    leaderboardId: string,
    playerId: string,
    oldRank: number,
    newRank: number,
    playerName: string,
    score: number
  ): void {
    const message: BroadcastMessage = {
      type: 'RANK_CHANGE',
      leaderboardId,
      playerId,
      data: {
        oldRank,
        newRank,
        change: oldRank - newRank,
        playerName,
        score,
      },
      timestamp: new Date(),
    };

    this.broadcastToLeaderboard(leaderboardId, message);
    logger.info(EventType.WEBSOCKET_MESSAGE_SENT, `Broadcast rank change for ${playerId} in ${leaderboardId}`);
  }

  public broadcastScoreUpdate(
    leaderboardId: string,
    playerId: string,
    oldScore: number,
    newScore: number,
    playerName: string,
    rank: number
  ): void {
    const message: BroadcastMessage = {
      type: 'SCORE_UPDATE',
      leaderboardId,
      playerId,
      data: {
        oldScore,
        newScore,
        scoreDelta: newScore - oldScore,
        playerName,
        rank,
      },
      timestamp: new Date(),
    };

    this.broadcastToLeaderboard(leaderboardId, message);
  }

  public broadcastNewEntry(
    leaderboardId: string,
    playerId: string,
    playerName: string,
    rank: number,
    score: number
  ): void {
    const message: BroadcastMessage = {
      type: 'NEW_ENTRY',
      leaderboardId,
      playerId,
      data: {
        playerName,
        rank,
        score,
      },
      timestamp: new Date(),
    };

    this.broadcastToLeaderboard(leaderboardId, message);
  }

  public broadcastEntryRemoved(
    leaderboardId: string,
    playerId: string,
    playerName: string,
    previousRank: number
  ): void {
    const message: BroadcastMessage = {
      type: 'ENTRY_REMOVED',
      leaderboardId,
      playerId,
      data: {
        playerName,
        previousRank,
      },
      timestamp: new Date(),
    };

    this.broadcastToLeaderboard(leaderboardId, message);
  }

  public broadcastLeaderboardReset(leaderboardId: string): void {
    const message: BroadcastMessage = {
      type: 'LEADERBOARD_RESET',
      leaderboardId,
      data: {
        message: 'Leaderboard has been reset',
      },
      timestamp: new Date(),
    };

    this.broadcastToLeaderboard(leaderboardId, message);
    logger.info(EventType.WEBSOCKET_MESSAGE_SENT, `Broadcast leaderboard reset for ${leaderboardId}`);
  }

  private broadcastToLeaderboard(leaderboardId: string, message: BroadcastMessage): void {
    const subscribers = this.leaderboardSubscribers.get(leaderboardId);
    if (!subscribers || subscribers.size === 0) return;

    for (const clientId of subscribers) {
      this.sendToClient(clientId, message);
    }
  }

  public broadcastToAll(message: BroadcastMessage): void {
    for (const clientId of this.clients.keys()) {
      this.sendToClient(clientId, message);
    }
  }

  public getConnectionStats(): {
    totalConnections: number;
    authenticatedConnections: number;
    totalSubscriptions: number;
    leaderboardsWithSubscribers: number;
  } {
    let authenticatedConnections = 0;
    let totalSubscriptions = 0;

    for (const client of this.clients.values()) {
      if (client.isAuthenticated) authenticatedConnections++;
      totalSubscriptions += client.subscriptions.size;
    }

    return {
      totalConnections: this.clients.size,
      authenticatedConnections,
      totalSubscriptions,
      leaderboardsWithSubscribers: this.leaderboardSubscribers.size,
    };
  }

  public getClientInfo(clientId: string): WebSocketClient | undefined {
    return this.clients.get(clientId);
  }

  public disconnectClient(clientId: string, reason = 'Disconnected by server'): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    client.ws.close(1000, reason);
    return true;
  }

  public isClientConnected(clientId: string): boolean {
    const client = this.clients.get(clientId);
    return client !== undefined && client.ws.readyState === WebSocket.OPEN;
  }
}

export const webSocketService = new WebSocketService();
export default webSocketService;
