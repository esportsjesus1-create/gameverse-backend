import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';
import { getRedisClient, closeRedisConnection } from './config/redis';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger, EventType } from './utils/logger';
import { webSocketService } from './services/websocket.service';

const app: Application = express();
const server = createServer(app);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.headers['x-request-id']);
  next();
});

if (config.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

app.get('/health', async (_req, res) => {
  try {
    const redis = getRedisClient();
    const redisStatus = await redis.ping();
    const wsStats = webSocketService.getConnectionStats();

    logger.logHealthCheck('healthy', { redis: redisStatus, websocket: wsStats });

    res.json({
      status: 'healthy',
      service: 'gameverse-leaderboard',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      dependencies: {
        redis: redisStatus === 'PONG' ? 'healthy' : 'unhealthy',
        websocket: {
          connections: wsStats.totalConnections,
          subscriptions: wsStats.totalSubscriptions,
        },
      },
    });
  } catch (error) {
    logger.logHealthCheck('unhealthy', { error: (error as Error).message });

    res.status(503).json({
      status: 'unhealthy',
      service: 'gameverse-leaderboard',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
    });
  }
});

app.get('/ready', async (_req, res) => {
  try {
    const redis = getRedisClient();
    await redis.ping();

    res.json({
      status: 'ready',
      service: 'gameverse-leaderboard',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      service: 'gameverse-leaderboard',
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
    });
  }
});

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async (): Promise<void> => {
  try {
    const redis = getRedisClient();
    await redis.connect();
    logger.info(EventType.SERVICE_STARTED, 'Redis connection established');

    if (config.WEBSOCKET_ENABLED) {
      webSocketService.initialize(server);
      logger.info(EventType.SERVICE_STARTED, 'WebSocket service initialized');
    }

    server.listen(config.PORT, config.HOST, () => {
      logger.logServiceStarted(config.PORT);
      console.log(`Leaderboard service running on http://${config.HOST}:${config.PORT}`);
      console.log(`Health check: http://${config.HOST}:${config.PORT}/health`);
      console.log(`API base: http://${config.HOST}:${config.PORT}/api/v1/leaderboard`);
      if (config.WEBSOCKET_ENABLED) {
        console.log(`WebSocket: ws://${config.HOST}:${config.PORT}/api/v1/leaderboard/live`);
      }
    });
  } catch (error) {
    logger.error(EventType.SERVICE_STOPPED, 'Failed to start server', error as Error);
    process.exit(1);
  }
};

const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(EventType.SERVICE_STOPPED, `Received ${signal}, starting graceful shutdown`);

  webSocketService.shutdown();

  server.close(async () => {
    logger.info(EventType.SERVICE_STOPPED, 'HTTP server closed');

    await closeRedisConnection();

    logger.logServiceStopped('Graceful shutdown complete');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error(EventType.SERVICE_STOPPED, 'Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error: Error) => {
  logger.error(EventType.API_ERROR, 'Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error(EventType.API_ERROR, 'Unhandled rejection', reason as Error);
});

if (require.main === module) {
  startServer();
}

export { app, server, startServer };
export default app;
