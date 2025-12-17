import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config';
import { initializeDatabase, closeDatabase } from './database/pool';
import { runMigrations } from './database/migrate';
import { redisService } from './services/redis.service';
import { countdownService } from './services/countdown.service';
import { createWebSocketServer } from './websocket/server';
import lobbyRoutes from './routes/lobby.routes';
import authRoutes from './routes/auth.routes';
import { LoggerService } from './services/logger.service';

const logger = new LoggerService('App');

const app = express();
const server = createServer(app);

app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials
}));
app.use(express.json());

app.use('/api/lobbies', lobbyRoutes);
app.use('/api/auth', authRoutes);

app.get('/api/health', async (_req, res) => {
  const redisHealthy = await redisService.ping();
  
  res.json({
    status: redisHealthy ? 'healthy' : 'degraded',
    service: config.serviceName,
    version: config.version,
    timestamp: new Date().toISOString(),
    checks: {
      redis: redisHealthy ? 'connected' : 'disconnected'
    }
  });
});

app.get('/api/ready', (_req, res) => {
  res.json({
    ready: true,
    service: config.serviceName,
    timestamp: new Date().toISOString()
  });
});

interface ErrorWithStatusCode extends Error {
  statusCode?: number;
}

app.use((err: ErrorWithStatusCode, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: config.nodeEnv === 'production' ? 'Internal server error' : err.message,
    timestamp: new Date().toISOString()
  });
});

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    timestamp: new Date().toISOString()
  });
});

async function startServer(): Promise<void> {
  try {
    logger.info('Starting server...');

    await initializeDatabase();
    logger.info('Database connection established');

    if (config.nodeEnv !== 'test') {
      await runMigrations();
      logger.info('Database migrations completed');
    }

    const redisHealthy = await redisService.ping();
    if (redisHealthy) {
      logger.info('Redis connection established');
    } else {
      logger.warn('Redis connection failed - some features may be unavailable');
    }

    createWebSocketServer(server);
    logger.info('WebSocket server initialized');

    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`WebSocket available at ws://localhost:${config.port}/ws`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });

  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

async function gracefulShutdown(): Promise<void> {
  logger.info('Shutting down gracefully...');

  countdownService.stopAll();

  server.close(() => {
    logger.info('HTTP server closed');
  });

  await redisService.close();
  await closeDatabase();

  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

if (require.main === module) {
  startServer();
}

export { app, server };
