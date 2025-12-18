import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { WebSocketMessage, StoredEvent, StoredMetric, Alert } from '../types';
import { logger } from '../utils/logger';
import { getCurrentTimestamp } from '../utils/helpers';

export interface WebSocketClient {
  ws: WebSocket;
  id: string;
  subscriptions: Set<string>;
  connectedAt: number;
}

export class WebSocketHandler {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private clientIdCounter = 0;

  public initialize(server: Server, path = '/api/v1/monitoring/live'): void {
    this.wss = new WebSocketServer({ server, path });

    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = `client_${++this.clientIdCounter}`;
      const client: WebSocketClient = {
        ws,
        id: clientId,
        subscriptions: new Set(['all']),
        connectedAt: getCurrentTimestamp()
      };

      this.clients.set(clientId, client);
      logger.info('WebSocket client connected', { clientId });

      this.sendToClient(client, {
        type: 'status',
        payload: { connected: true, clientId },
        timestamp: getCurrentTimestamp()
      });

      ws.on('message', (data: Buffer) => {
        this.handleMessage(client, data);
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info('WebSocket client disconnected', { clientId });
      });

      ws.on('error', (error: Error) => {
        logger.error('WebSocket error', { clientId, error: error.message });
      });
    });

    logger.info('WebSocket server initialized', { path });
  }

  private handleMessage(client: WebSocketClient, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString()) as {
        action?: string;
        channels?: string[];
      };

      if (message.action === 'subscribe' && Array.isArray(message.channels)) {
        for (const channel of message.channels) {
          client.subscriptions.add(channel);
        }
        logger.debug('Client subscribed to channels', {
          clientId: client.id,
          channels: message.channels
        });
      } else if (message.action === 'unsubscribe' && Array.isArray(message.channels)) {
        for (const channel of message.channels) {
          client.subscriptions.delete(channel);
        }
        logger.debug('Client unsubscribed from channels', {
          clientId: client.id,
          channels: message.channels
        });
      }
    } catch (error) {
      logger.warn('Invalid WebSocket message', { clientId: client.id });
    }
  }

  private sendToClient(client: WebSocketClient, message: WebSocketMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  public broadcastEvent(event: StoredEvent): void {
    const message: WebSocketMessage = {
      type: 'event',
      payload: event,
      timestamp: getCurrentTimestamp()
    };

    this.broadcast(message, 'events');
  }

  public broadcastMetric(metric: StoredMetric): void {
    const message: WebSocketMessage = {
      type: 'metric',
      payload: metric,
      timestamp: getCurrentTimestamp()
    };

    this.broadcast(message, 'metrics');
  }

  public broadcastAlert(alert: Alert): void {
    const message: WebSocketMessage = {
      type: 'alert',
      payload: alert,
      timestamp: getCurrentTimestamp()
    };

    this.broadcast(message, 'alerts');
  }

  public broadcastStatus(status: unknown): void {
    const message: WebSocketMessage = {
      type: 'status',
      payload: status,
      timestamp: getCurrentTimestamp()
    };

    this.broadcast(message, 'status');
  }

  private broadcast(message: WebSocketMessage, channel: string): void {
    for (const client of this.clients.values()) {
      if (client.subscriptions.has('all') || client.subscriptions.has(channel)) {
        this.sendToClient(client, message);
      }
    }
  }

  public getConnectedClients(): number {
    return this.clients.size;
  }

  public getClientInfo(): Array<{
    id: string;
    subscriptions: string[];
    connectedAt: number;
  }> {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      subscriptions: Array.from(client.subscriptions),
      connectedAt: client.connectedAt
    }));
  }

  public disconnectClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    
    if (client === undefined) {
      return false;
    }

    client.ws.close();
    this.clients.delete(clientId);
    
    return true;
  }

  public close(): void {
    for (const client of this.clients.values()) {
      client.ws.close();
    }
    this.clients.clear();

    if (this.wss !== null) {
      this.wss.close();
      this.wss = null;
    }

    logger.info('WebSocket server closed');
  }
}

export const webSocketHandler = new WebSocketHandler();
