import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { getRedisClient, closeRedisConnection } from './config/redis';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

const app: Application = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (config.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'gameverse-season',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', (_req, res) => {
  const redis = getRedisClient();
  redis.ping()
    .then(() => {
      res.json({
        status: 'ready',
        redis: 'connected',
      });
    })
    .catch(() => {
      res.status(503).json({
        status: 'not ready',
        redis: 'disconnected',
      });
    });
});

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = (): void => {
  try {
    getRedisClient();
    logger.info('Redis connection initialized');

    app.listen(config.PORT, config.HOST, () => {
      logger.info(`Server running on http://${config.HOST}:${config.PORT}`);
      logger.info(`Environment: ${config.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

const gracefulShutdown = (): void => {
  logger.info('Shutting down gracefully...');
  closeRedisConnection()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

if (require.main === module) {
  startServer();
}

export { app };
