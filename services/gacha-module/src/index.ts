import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { initializeDatabase } from './config/database';
import { initializeRedis } from './config/redis';
import routes from './routes';
import {
  errorHandler,
  notFoundHandler,
  generalRateLimiter,
} from './middleware';
import logger from './utils/logger';

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(generalRateLimiter);

app.use('/api/v1', routes);

app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      service: 'gacha-module',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async (): Promise<void> => {
  try {
    logger.info('Initializing database connection...');
    await initializeDatabase();
    logger.info('Database connected successfully');

    logger.info('Initializing Redis connection...');
    const redis = initializeRedis();
    await redis.connect();
    logger.info('Redis connected successfully');

    app.listen(config.server.port, () => {
      logger.info(`Gacha module server running on port ${config.server.port}`);
      logger.info(`Environment: ${config.server.nodeEnv}`);
      logger.info(`API available at http://localhost:${config.server.port}/api/v1`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

if (require.main === module) {
  startServer();
}

export { app, startServer };
