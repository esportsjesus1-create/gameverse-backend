import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { parse } from 'url';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { wsHandlers } from './handlers';
import { WebSocketMessage } from '../types';
import { LoggerService } from '../services/logger.service';

const logger = new LoggerService('WebSocketServer');

interface TokenPayload {
  playerId: string;
  iat?: number;
  exp?: number;
}

export function createWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws'
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const playerId = authenticateConnection(req);
    
    if (!playerId) {
      logger.warn('WebSocket connection rejected - authentication failed');
      ws.close(4001, 'Authentication failed');
      return;
    }

    wsHandlers.registerClient(ws, playerId);
    logger.info('WebSocket connection established', { playerId });

    ws.on('message', (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        wsHandlers.handleMessage(ws, message);
      } catch (error) {
        logger.error('Failed to parse WebSocket message', error as Error);
        ws.send(JSON.stringify({
          type: 'error',
          payload: { error: 'Invalid message format' },
          timestamp: new Date().toISOString()
        }));
      }
    });

    ws.on('close', () => {
      wsHandlers.unregisterClient(ws);
      logger.info('WebSocket connection closed', { playerId });
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error', error, { playerId });
    });

    ws.on('pong', () => {
      const client = wsHandlers.getClient(ws);
      if (client) {
        client.isAlive = true;
      }
    });
  });

  const heartbeatInterval = setInterval(() => {
    wsHandlers.heartbeat();
  }, config.lobby.heartbeatInterval);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  logger.info('WebSocket server initialized');
  return wss;
}

function authenticateConnection(req: IncomingMessage): string | null {
  try {
    const { query } = parse(req.url || '', true);
    const token = query.token as string;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const headerToken = authHeader.substring(7);
        return verifyToken(headerToken);
      }
      return null;
    }

    return verifyToken(token);
  } catch (error) {
    logger.error('Authentication error', error as Error);
    return null;
  }
}

function verifyToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;
    return decoded.playerId;
  } catch {
    return null;
  }
}

export function generateToken(playerId: string): string {
  return jwt.sign({ playerId }, config.jwt.secret, { 
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn']
  });
}
