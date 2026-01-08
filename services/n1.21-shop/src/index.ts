import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateConfig } from './config';
import { testConnection, closePool } from './config/database';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import routes from './routes';

const app: Application = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'gameverse-shop',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', async (_req: Request, res: Response) => {
  try {
    const dbConnected = await testConnection();
    if (dbConnected) {
      res.json({
        status: 'ready',
        database: 'connected',
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        database: 'disconnected',
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      database: 'error',
    });
  }
});

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer(): Promise<void> {
  try {
    validateConfig();
    
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.warn('Database connection failed, but server will start anyway');
    }

    app.listen(config.port, () => {
      logger.info(`GameVerse Shop service started`, {
        port: config.port,
        environment: config.nodeEnv,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully`);
  
  try {
    await closePool();
    logger.info('Database connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
  startServer();
}

export { app };
