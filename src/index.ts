import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config';
import lobbyRoutes from './routes/lobby.routes';
import { LobbyWebSocketHandler } from './websocket/lobby.handler';
import { LobbyError } from './types';

const app = express();
const server = http.createServer(app);

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/lobbies', lobbyRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: config.serviceName,
    timestamp: new Date().toISOString(),
  });
});

app.use((err: Error & { statusCode?: number; code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof LobbyError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

const wss = new WebSocket.Server({ server, path: '/ws' });
const wsHandler = new LobbyWebSocketHandler(wss);

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    ws.close(4001, 'Missing userId parameter');
    return;
  }

  wsHandler.handleConnection(ws, userId);
});

server.listen(config.port, () => {
  console.log(`Lobby service running on port ${config.port}`);
  console.log(`WebSocket server running on ws://localhost:${config.port}/ws`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  wsHandler.shutdown();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, server, wss };
