import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { config } from './config';
import { connectRedis, closeRedis, redisHealthCheck } from './config/redis';
import { closePool, healthCheck as dbHealthCheck } from './config/database';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';
import { ApiResponse } from './types';

const app = express();

app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

try {
  const swaggerDocument = YAML.load(path.join(__dirname, '../openapi.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch {
  logger.warn('OpenAPI spec not found, swagger UI disabled');
}

app.get('/health', async (_req, res) => {
  const dbHealthy = await dbHealthCheck();
  const redisHealthy = await redisHealthCheck();

  const status = dbHealthy && redisHealthy ? 'healthy' : 'unhealthy';
  const statusCode = status === 'healthy' ? 200 : 503;

  const response: ApiResponse<{ status: string; database: boolean; redis: boolean }> = {
    success: status === 'healthy',
    data: {
      status,
      database: dbHealthy,
      redis: redisHealthy,
    },
  };

  res.status(statusCode).json(response);
});

app.get('/ready', (_req, res) => {
  const response: ApiResponse<{ ready: boolean }> = {
    success: true,
    data: { ready: true },
  };
  res.json(response);
});

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer(): Promise<void> {
  try {
    await connectRedis();
    logger.info('Connected to Redis');

    const server = app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`API docs available at http://localhost:${config.port}/api-docs`);
    });

    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received, shutting down gracefully`);

      server.close(async () => {
        logger.info('HTTP server closed');

        await closeRedis();
        await closePool();

        logger.info('All connections closed');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export { app };
