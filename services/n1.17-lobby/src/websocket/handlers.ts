import { WebSocket } from 'ws';
import { 
  WebSocketMessage, 
  WebSocketEventType, 
  WebSocketClient,
  JoinLobbyRequest,
  SetReadyRequest
} from '../types';
import { lobbyService } from '../services/lobby.service';
import { countdownService } from '../services/countdown.service';
import { redisService } from '../services/redis.service';
import { LoggerService } from '../services/logger.service';

const logger = new LoggerService('WebSocketHandlers');

export class WebSocketHandlers {
  private clients: Map<WebSocket, WebSocketClient> = new Map();
  private lobbyClients: Map<string, Set<WebSocket>> = new Map();

  constructor() {
    countdownService.setCallbacks(
      this.handleCountdownTick.bind(this),
      this.handleCountdownComplete.bind(this),
      this.handleCountdownCancelled.bind(this)
    );
  }

  registerClient(ws: WebSocket, playerId: string): void {
    const client: WebSocketClient = {
      playerId,
      lobbyId: null,
      isAlive: true
    };
    this.clients.set(ws, client);
    logger.info('Client registered', { playerId });
  }

  unregisterClient(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (client) {
      if (client.lobbyId) {
        this.removeFromLobby(ws, client.lobbyId);
      }
      this.clients.delete(ws);
      logger.info('Client unregistered', { playerId: client.playerId });
    }
  }

  getClient(ws: WebSocket): WebSocketClient | undefined {
    return this.clients.get(ws);
  }

  private addToLobby(ws: WebSocket, lobbyId: string): void {
    if (!this.lobbyClients.has(lobbyId)) {
      this.lobbyClients.set(lobbyId, new Set());
    }
    this.lobbyClients.get(lobbyId)!.add(ws);
    
    const client = this.clients.get(ws);
    if (client) {
      client.lobbyId = lobbyId;
      redisService.addToLobbyConnections(lobbyId, client.playerId);
    }
  }

  private removeFromLobby(ws: WebSocket, lobbyId: string): void {
    const clients = this.lobbyClients.get(lobbyId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        this.lobbyClients.delete(lobbyId);
      }
    }
    
    const client = this.clients.get(ws);
    if (client) {
      client.lobbyId = null;
      redisService.removeFromLobbyConnections(lobbyId, client.playerId);
    }
  }

  broadcastToLobby(lobbyId: string, message: WebSocketMessage, excludeWs?: WebSocket): void {
    const clients = this.lobbyClients.get(lobbyId);
    if (!clients) return;

    const messageStr = JSON.stringify(message);
    for (const ws of clients) {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    }
  }

  sendToClient(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  async handleMessage(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) {
      this.sendError(ws, 'Client not registered');
      return;
    }

    try {
      switch (message.type) {
        case WebSocketEventType.JOIN_LOBBY:
          await this.handleJoinLobby(ws, client, message.payload as JoinLobbyRequest & { lobbyId: string });
          break;
        case WebSocketEventType.LEAVE_LOBBY:
          await this.handleLeaveLobby(ws, client);
          break;
        case WebSocketEventType.READY_STATUS_CHANGED:
          await this.handleReadyStatusChange(ws, client, message.payload as SetReadyRequest);
          break;
        case WebSocketEventType.PING:
          this.handlePing(ws);
          break;
        default:
          this.sendError(ws, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Error handling message', error as Error, { playerId: client.playerId });
      this.sendError(ws, (error as Error).message);
    }
  }

  private async handleJoinLobby(
    ws: WebSocket, 
    client: WebSocketClient, 
    payload: JoinLobbyRequest & { lobbyId: string }
  ): Promise<void> {
    const { lobbyId } = payload;

    if (client.lobbyId) {
      await this.handleLeaveLobby(ws, client);
    }

    const lobby = await lobbyService.joinLobby(lobbyId, client.playerId);
    this.addToLobby(ws, lobbyId);

    this.sendToClient(ws, {
      type: WebSocketEventType.JOIN_LOBBY,
      payload: { success: true, lobby },
      lobbyId,
      playerId: client.playerId,
      timestamp: new Date().toISOString()
    });

    this.broadcastToLobby(lobbyId, {
      type: WebSocketEventType.PLAYER_JOINED,
      payload: { playerId: client.playerId, lobby },
      lobbyId,
      timestamp: new Date().toISOString()
    }, ws);

    logger.info('Player joined lobby via WebSocket', { lobbyId, playerId: client.playerId });
  }

  private async handleLeaveLobby(ws: WebSocket, client: WebSocketClient): Promise<void> {
    if (!client.lobbyId) {
      this.sendError(ws, 'Not in a lobby');
      return;
    }

    const lobbyId = client.lobbyId;
    
    if (countdownService.isCountdownActive(lobbyId)) {
      await countdownService.cancelCountdown(lobbyId);
    }

    const lobby = await lobbyService.leaveLobby(lobbyId, client.playerId);
    this.removeFromLobby(ws, lobbyId);

    this.sendToClient(ws, {
      type: WebSocketEventType.LEAVE_LOBBY,
      payload: { success: true },
      lobbyId,
      playerId: client.playerId,
      timestamp: new Date().toISOString()
    });

    if (lobby) {
      this.broadcastToLobby(lobbyId, {
        type: WebSocketEventType.PLAYER_LEFT,
        payload: { playerId: client.playerId, lobby },
        lobbyId,
        timestamp: new Date().toISOString()
      });
    } else {
      this.broadcastToLobby(lobbyId, {
        type: WebSocketEventType.LOBBY_CLOSED,
        payload: { reason: 'Host left and lobby was deleted' },
        lobbyId,
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Player left lobby via WebSocket', { lobbyId, playerId: client.playerId });
  }

  private async handleReadyStatusChange(
    ws: WebSocket, 
    client: WebSocketClient, 
    payload: SetReadyRequest
  ): Promise<void> {
    if (!client.lobbyId) {
      this.sendError(ws, 'Not in a lobby');
      return;
    }

    const { ready } = payload;
    const lobbyId = client.lobbyId;

    if (!ready && countdownService.isCountdownActive(lobbyId)) {
      await countdownService.cancelCountdown(lobbyId);
    }

    const { player, allReady } = await lobbyService.setPlayerReady(lobbyId, client.playerId, ready);

    this.broadcastToLobby(lobbyId, {
      type: WebSocketEventType.READY_STATUS_CHANGED,
      payload: { playerId: client.playerId, ready: player.readyStatus === 'ready' },
      lobbyId,
      timestamp: new Date().toISOString()
    });

    if (allReady) {
      const lobby = await lobbyService.getLobbyById(lobbyId);
      if (lobby) {
        this.broadcastToLobby(lobbyId, {
          type: WebSocketEventType.ALL_PLAYERS_READY,
          payload: { lobby },
          lobbyId,
          timestamp: new Date().toISOString()
        });

        await countdownService.startCountdown(lobbyId, lobby.countdownDuration);
        
        this.broadcastToLobby(lobbyId, {
          type: WebSocketEventType.COUNTDOWN_STARTED,
          payload: { duration: lobby.countdownDuration },
          lobbyId,
          timestamp: new Date().toISOString()
        });
      }
    }

    logger.info('Ready status changed', { lobbyId, playerId: client.playerId, ready });
  }

  private handlePing(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (client) {
      client.isAlive = true;
    }
    this.sendToClient(ws, {
      type: WebSocketEventType.PONG,
      payload: {},
      timestamp: new Date().toISOString()
    });
  }

  private handleCountdownTick(lobbyId: string, remaining: number): void {
    this.broadcastToLobby(lobbyId, {
      type: WebSocketEventType.COUNTDOWN_TICK,
      payload: { remaining },
      lobbyId,
      timestamp: new Date().toISOString()
    });
  }

  private handleCountdownComplete(lobbyId: string): void {
    this.broadcastToLobby(lobbyId, {
      type: WebSocketEventType.GAME_STARTING,
      payload: { lobbyId },
      lobbyId,
      timestamp: new Date().toISOString()
    });
    logger.info('Game starting', { lobbyId });
  }

  private handleCountdownCancelled(lobbyId: string): void {
    this.broadcastToLobby(lobbyId, {
      type: WebSocketEventType.COUNTDOWN_CANCELLED,
      payload: { reason: 'A player unreadied' },
      lobbyId,
      timestamp: new Date().toISOString()
    });
  }

  private sendError(ws: WebSocket, message: string): void {
    this.sendToClient(ws, {
      type: WebSocketEventType.ERROR,
      payload: { error: message },
      timestamp: new Date().toISOString()
    });
  }

  heartbeat(): void {
    for (const [ws, client] of this.clients) {
      if (!client.isAlive) {
        logger.info('Client heartbeat timeout', { playerId: client.playerId });
        ws.terminate();
        this.unregisterClient(ws);
        continue;
      }
      client.isAlive = false;
      ws.ping();
    }
  }
}

export const wsHandlers = new WebSocketHandlers();
