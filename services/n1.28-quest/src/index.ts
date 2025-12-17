import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config';
import { initializeDatabase, closeDatabase } from './config/database';
import { closeRedis } from './config/redis';
import { schedulerService } from './services/scheduler.service';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { logger } from './utils/logger';

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (config.server.nodeEnv !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim())
    }
  }));
}

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer(): Promise<void> {
  try {
    await initializeDatabase();
    logger.info('Database initialized');

    if (config.server.nodeEnv !== 'test') {
      schedulerService.start();
    }

    app.listen(config.server.port, config.server.host, () => {
      logger.info(`Quest service running on ${config.server.host}:${config.server.port}`);
      logger.info(`Environment: ${config.server.nodeEnv}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function gracefulShutdown(): Promise<void> {
  logger.info('Shutting down gracefully...');
  schedulerService.stop();
  await closeDatabase();
  await closeRedis();
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

if (require.main === module) {
  startServer();
}

export { app };
