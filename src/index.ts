import dotenv from 'dotenv';
dotenv.config();

import { startServer } from './app';
import { closeDatabase } from './config/database';
import { closeRedis } from './config/redis';

const PORT = parseInt(process.env.PORT || '3000', 10);

startServer(PORT);

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await closeDatabase();
  await closeRedis();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await closeDatabase();
  await closeRedis();
  process.exit(0);
});
