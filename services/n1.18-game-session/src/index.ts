import express from 'express';
import { config } from './config';
import { initializeDatabase, closePool } from './db/postgres';
import { closeRedis } from './db/redis';
import { errorHandler } from './middleware/errorHandler';
import sessionRoutes from './routes/sessionRoutes';

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: 'N1.18',
    module: 'game-session',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/sessions', sessionRoutes);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

async function start(): Promise<void> {
  try {
    await initializeDatabase();
    console.log('Database initialized');
    
    app.listen(config.port, () => {
      console.log(`GameVerse N1.18 game-session server running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  console.log('Shutting down...');
  await closePool();
  await closeRedis();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
