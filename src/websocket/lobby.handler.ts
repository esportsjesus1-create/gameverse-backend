import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { lobbyService } from '../services/lobby.service';
import { WebSocketMessage, WebSocketMessageType, LobbyError } from '../types';
import { config } from '../config';

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  lobbyId?: string;
  isAlive: boolean;
  lastPing: number;
}

const clients: Map<string, ClientConnection> = new Map();
const lobbyClients: Map<string, Set<string>> = new Map();

export class LobbyWebSocketHandler {
  private wss: WebSocket.Server;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(wss: WebSocket.Server) {
    this.wss = wss;
    this.startPingInterval();
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      clients.forEach((client, odbyId) => {
        if (!client.isAlive) {
          this.handleDisconnect(client.userId);
          client.ws.terminate();
          clients.delete(client.userId);
          return;
        }
        client.isAlive = false;
        client.ws.ping();
      });
    }, config.websocket.pingInterval);
  }

  handleConnection(ws: WebSocket, userId: string): void {
    const connection: ClientConnection = {
      ws,
      userId,
      isAlive: true,
      lastPing: Date.now(),
    };

    clients.set(userId, connection);

    ws.on('pong', () => {
      connection.isAlive = true;
      connection.lastPing = Date.now();
    });

    ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(userId, data.toString());
    });

    ws.on('close', () => {
      this.handleDisconnect(userId);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
    });
  }

  private async handleMessage(userId: string, data: string): Promise<void> {
    const client = clients.get(userId);
    if (!client) return;

    try {
      const message: WebSocketMessage = JSON.parse(data);
      
      switch (message.type) {
        case 'lobby:join':
          await this.handleJoinLobby(userId, message);
          break;
        case 'lobby:leave':
          await this.handleLeaveLobby(userId);
          break;
        case 'lobby:ready':
          await this.handleReady(userId, true);
          break;
        case 'lobby:unready':
          await this.handleReady(userId, false);
          break;
        case 'lobby:kick':
          await this.handleKick(userId, message);
          break;
        case 'lobby:settings':
          await this.handleSettings(userId, message);
          break;
        case 'lobby:start':
          await this.handleStartGame(userId);
          break;
        case 'lobby:chat':
          await this.handleChat(userId, message);
          break;
        case 'ping':
          this.sendToClient(userId, { type: 'pong', payload: null, timestamp: Date.now() });
          break;
        default:
          this.sendError(userId, 'Unknown message type');
      }
    } catch (error) {
      if (error instanceof LobbyError) {
        this.sendError(userId, error.message, error.code);
      } else {
        this.sendError(userId, 'Internal server error');
      }
    }
  }

  private async handleJoinLobby(userId: string, message: WebSocketMessage): Promise<void> {
    const payload = message.payload as { lobbyId: string; username: string; inviteCode?: string };
    
    const { lobby, player } = await lobbyService.joinLobby({
      lobbyId: payload.lobbyId,
      userId,
      username: payload.username,
      inviteCode: payload.inviteCode,
    });

    const client = clients.get(userId);
    if (client) {
      client.lobbyId = lobby.id;
    }

    this.addClientToLobby(userId, lobby.id);

    this.sendToClient(userId, {
      type: 'lobby:update',
      payload: { lobby, player },
      timestamp: Date.now(),
    });

    this.broadcastToLobby(lobby.id, {
      type: 'lobby:player_joined',
      payload: { player, playerCount: lobby.players.length },
      timestamp: Date.now(),
    }, userId);
  }

  private async handleLeaveLobby(userId: string): Promise<void> {
    const client = clients.get(userId);
    if (!client?.lobbyId) return;

    const lobbyId = client.lobbyId;
    const lobby = await lobbyService.leaveLobby(lobbyId, userId);

    this.removeClientFromLobby(userId, lobbyId);
    client.lobbyId = undefined;

    if (lobby) {
      this.broadcastToLobby(lobbyId, {
        type: 'lobby:player_left',
        payload: { userId, playerCount: lobby.players.length, newHostId: lobby.hostId },
        timestamp: Date.now(),
      });
    }
  }

  private async handleReady(userId: string, ready: boolean): Promise<void> {
    const client = clients.get(userId);
    if (!client?.lobbyId) {
      this.sendError(userId, 'Not in a lobby');
      return;
    }

    const lobby = await lobbyService.setPlayerReady(client.lobbyId, userId, ready);

    this.broadcastToLobby(client.lobbyId, {
      type: ready ? 'lobby:player_ready' : 'lobby:player_unready',
      payload: { userId },
      timestamp: Date.now(),
    });

    const { allReady } = await lobbyService.checkReadyStatus(client.lobbyId);
    if (allReady && lobby.status === 'ready_check') {
      await this.startCountdown(client.lobbyId);
    }
  }

  private async handleKick(userId: string, message: WebSocketMessage): Promise<void> {
    const client = clients.get(userId);
    if (!client?.lobbyId) {
      this.sendError(userId, 'Not in a lobby');
      return;
    }

    const payload = message.payload as { targetUserId: string };
    const lobby = await lobbyService.kickPlayer(client.lobbyId, userId, payload.targetUserId);

    const targetClient = clients.get(payload.targetUserId);
    if (targetClient) {
      this.sendToClient(payload.targetUserId, {
        type: 'lobby:error',
        payload: { code: 'KICKED', message: 'You have been kicked from the lobby' },
        timestamp: Date.now(),
      });
      this.removeClientFromLobby(payload.targetUserId, client.lobbyId);
      targetClient.lobbyId = undefined;
    }

    this.broadcastToLobby(client.lobbyId, {
      type: 'lobby:player_left',
      payload: { userId: payload.targetUserId, kicked: true, playerCount: lobby.players.length },
      timestamp: Date.now(),
    });
  }

  private async handleSettings(userId: string, message: WebSocketMessage): Promise<void> {
    const client = clients.get(userId);
    if (!client?.lobbyId) {
      this.sendError(userId, 'Not in a lobby');
      return;
    }

    const payload = message.payload as Record<string, unknown>;
    const lobby = await lobbyService.updateSettings(client.lobbyId, userId, payload);

    this.broadcastToLobby(client.lobbyId, {
      type: 'lobby:update',
      payload: { settings: lobby.settings },
      timestamp: Date.now(),
    });
  }

  private async handleStartGame(userId: string): Promise<void> {
    const client = clients.get(userId);
    if (!client?.lobbyId) {
      this.sendError(userId, 'Not in a lobby');
      return;
    }

    const lobby = await lobbyService.startReadyCheck(client.lobbyId, userId);

    this.broadcastToLobby(client.lobbyId, {
      type: 'lobby:ready_check',
      payload: { timeout: lobby.settings.readyCheckTimeout },
      timestamp: Date.now(),
    });

    setTimeout(async () => {
      const currentLobby = await lobbyService.getLobbyById(client.lobbyId!);
      if (currentLobby?.status === 'ready_check') {
        const notReady = currentLobby.players.filter(p => p.status === 'not_ready');
        if (notReady.length > 0) {
          currentLobby.status = 'waiting';
          this.broadcastToLobby(client.lobbyId!, {
            type: 'lobby:update',
            payload: { status: 'waiting', notReadyPlayers: notReady.map(p => p.userId) },
            timestamp: Date.now(),
          });
        }
      }
    }, lobby.settings.readyCheckTimeout);
  }

  private async startCountdown(lobbyId: string): Promise<void> {
    const lobby = await lobbyService.startCountdown(lobbyId);

    this.broadcastToLobby(lobbyId, {
      type: 'lobby:countdown',
      payload: { duration: lobby.settings.countdownDuration },
      timestamp: Date.now(),
    });

    setTimeout(async () => {
      const currentLobby = await lobbyService.getLobbyById(lobbyId);
      if (currentLobby?.status === 'countdown') {
        const gameSessionId = uuidv4();
        await lobbyService.startGame(lobbyId, gameSessionId);

        this.broadcastToLobby(lobbyId, {
          type: 'lobby:game_starting',
          payload: { gameSessionId },
          timestamp: Date.now(),
        });
      }
    }, lobby.settings.countdownDuration);
  }

  private async handleChat(userId: string, message: WebSocketMessage): Promise<void> {
    const client = clients.get(userId);
    if (!client?.lobbyId) {
      this.sendError(userId, 'Not in a lobby');
      return;
    }

    const payload = message.payload as { text: string };
    
    this.broadcastToLobby(client.lobbyId, {
      type: 'lobby:chat',
      payload: { userId, text: payload.text, timestamp: Date.now() },
      timestamp: Date.now(),
    });
  }

  private async handleDisconnect(userId: string): Promise<void> {
    const client = clients.get(userId);
    if (client?.lobbyId) {
      await lobbyService.handleDisconnect(userId);
      
      this.broadcastToLobby(client.lobbyId, {
        type: 'lobby:player_left',
        payload: { userId, disconnected: true },
        timestamp: Date.now(),
      }, userId);

      this.removeClientFromLobby(userId, client.lobbyId);
    }
    clients.delete(userId);
  }

  private addClientToLobby(userId: string, lobbyId: string): void {
    if (!lobbyClients.has(lobbyId)) {
      lobbyClients.set(lobbyId, new Set());
    }
    lobbyClients.get(lobbyId)!.add(userId);
  }

  private removeClientFromLobby(userId: string, lobbyId: string): void {
    const lobbyClientSet = lobbyClients.get(lobbyId);
    if (lobbyClientSet) {
      lobbyClientSet.delete(userId);
      if (lobbyClientSet.size === 0) {
        lobbyClients.delete(lobbyId);
      }
    }
  }

  private sendToClient(userId: string, message: WebSocketMessage): void {
    const client = clients.get(userId);
    if (client?.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  private broadcastToLobby(lobbyId: string, message: WebSocketMessage, excludeUserId?: string): void {
    const lobbyClientSet = lobbyClients.get(lobbyId);
    if (!lobbyClientSet) return;

    lobbyClientSet.forEach(userId => {
      if (userId !== excludeUserId) {
        this.sendToClient(userId, message);
      }
    });
  }

  private sendError(userId: string, message: string, code: string = 'ERROR'): void {
    this.sendToClient(userId, {
      type: 'lobby:error',
      payload: { code, message },
      timestamp: Date.now(),
    });
  }

  shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    clients.forEach(client => client.ws.close());
    clients.clear();
    lobbyClients.clear();
  }
}
