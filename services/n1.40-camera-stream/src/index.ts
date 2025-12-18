import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { config } from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { signalingService } from './services/signaling.service';
import { viewerService } from './services/viewer.service';
import { SignalingMessage, SignalingMessageType } from './types';
import logger from './utils/logger';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'camera-stream', version: '1.0.0' });
});

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws/signaling' });

const clientStreams = new Map<WebSocket, { streamId: string; viewerId: string }>();

wss.on('connection', (ws: WebSocket) => {
  logger.info('WebSocket client connected');

  ws.on('message', async (data: Buffer) => {
    try {
      const message: SignalingMessage = JSON.parse(data.toString());
      logger.debug('Received signaling message:', { type: message.type, streamId: message.streamId });

      if (message.type === SignalingMessageType.JOIN) {
        const viewer = await viewerService.join(message.streamId, message.senderId);
        await signalingService.addViewerToRoom(message.streamId, viewer);
        clientStreams.set(ws, { streamId: message.streamId, viewerId: viewer.id });

        const webrtcConfig = signalingService.getWebRTCConfig();
        ws.send(JSON.stringify({
          type: 'config',
          payload: { viewerId: viewer.id, webrtcConfig }
        }));
      }

      const response = await signalingService.processMessage(message);
      
      if (response) {
        ws.send(JSON.stringify(response));
      }

      broadcastToRoom(message.streamId, message, ws);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('WebSocket message error:', { error: errorMessage });
      
      ws.send(JSON.stringify({
        type: SignalingMessageType.ERROR,
        payload: { error: errorMessage }
      }));
    }
  });

  ws.on('close', async () => {
    const clientInfo = clientStreams.get(ws);
    if (clientInfo) {
      try {
        await signalingService.removeViewerFromRoom(clientInfo.streamId, clientInfo.viewerId);
        await viewerService.leave(clientInfo.viewerId);
      } catch (error) {
        logger.warn('Error cleaning up viewer on disconnect:', { error });
      }
      clientStreams.delete(ws);
    }
    logger.info('WebSocket client disconnected');
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error:', { error: error.message });
  });
});

function broadcastToRoom(streamId: string, message: SignalingMessage, excludeWs?: WebSocket): void {
  wss.clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      const clientInfo = clientStreams.get(client);
      if (clientInfo && clientInfo.streamId === streamId) {
        client.send(JSON.stringify(message));
      }
    }
  });
}

setInterval(async () => {
  try {
    await viewerService.cleanupInactiveViewers(60000);
  } catch (error) {
    logger.error('Error cleaning up inactive viewers:', { error });
  }
}, 30000);

const PORT = config.server.port;

server.listen(PORT, () => {
  logger.info(`Camera-stream service running on port ${PORT}`);
  logger.info(`WebSocket signaling server running on ws://localhost:${PORT}/ws/signaling`);
});

export { app, server, wss };
