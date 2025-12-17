import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from './config';
import { initializeDatabase, closeDatabase } from './config/database';
import { getRedisClient, closeRedis } from './config/redis';
import gachaRoutes from './routes/gacha.routes';
import { errorHandler } from './middleware';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests, please try again later' },
});
app.use(limiter);

app.use('/gacha', gachaRoutes);

app.use(errorHandler);

const startServer = async (): Promise<void> => {
  try {
    await initializeDatabase();
    console.log('Database connected successfully');

    getRedisClient();
    console.log('Redis client initialized');

    app.listen(config.server.port, () => {
      console.log(`Gacha service running on port ${config.server.port}`);
      console.log(`Environment: ${config.server.nodeEnv}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

const gracefulShutdown = async (): Promise<void> => {
  console.log('Shutting down gracefully...');

  try {
    await closeDatabase();
    console.log('Database connection closed');

    await closeRedis();
    console.log('Redis connection closed');

    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

startServer().catch(console.error);

export { app };
