import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { config } from './config';
import { logger } from './utils/logger';
import { RoomService } from './services/room.service';
import { StateSyncService } from './services/state-sync.service';
import { PermissionService } from './services/permission.service';
import { LifecycleService } from './services/lifecycle.service';
import { createRoomRouter } from './routes/room.routes';

async function main() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  const pool = new Pool({
    host: config.postgres.host,
    port: config.postgres.port,
    user: config.postgres.user,
    password: config.postgres.password,
    database: config.postgres.database,
  });

  const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  });

  try {
    await pool.query('SELECT 1');
    logger.info('PostgreSQL connected');
  } catch (error) {
    logger.error('PostgreSQL connection failed', { error });
    process.exit(1);
  }

  try {
    await redis.ping();
    logger.info('Redis connected');
  } catch (error) {
    logger.error('Redis connection failed', { error });
    process.exit(1);
  }

  const stateSyncService = new StateSyncService(redis);
  const permissionService = new PermissionService(pool);
  const roomService = new RoomService(pool, stateSyncService, permissionService);
  const lifecycleService = new LifecycleService(pool, roomService, stateSyncService);

  lifecycleService.start();

  const roomRouter = createRoomRouter(roomService, stateSyncService, permissionService, lifecycleService);
  app.use('/api/rooms', roomRouter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', service: 'room-instance', version: '1.38.0' });
  });

  app.get('/ready', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      await redis.ping();
      res.json({ status: 'ready' });
    } catch (error) {
      res.status(503).json({ status: 'not ready', error: (error as Error).message });
    }
  });

  const server = app.listen(config.server.port, () => {
    logger.info(`Room Instance Service started on port ${config.server.port}`, {
      nodeEnv: config.server.nodeEnv,
      port: config.server.port,
    });
  });

  const shutdown = async () => {
    logger.info('Shutting down...');
    lifecycleService.stop();
    await stateSyncService.disconnect();
    await pool.end();
    await redis.quit();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
