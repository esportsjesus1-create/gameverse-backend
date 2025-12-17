import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase, getRedisClient, closeConnections } from './config/database';
import leaderboardRoutes from './routes/leaderboardRoutes';
import playerRoutes from './routes/playerRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/players', playerRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: 'N1.19',
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    name: 'GameVerse N1.19 Leaderboard API',
    version: 'N1.19',
    endpoints: {
      health: 'GET /health',
      players: {
        create: 'POST /api/players',
        get: 'GET /api/players/:id',
        update: 'PUT /api/players/:id',
        delete: 'DELETE /api/players/:id',
      },
      leaderboard: {
        submitScore: 'POST /api/leaderboard/scores',
        getLeaderboard: 'GET /api/leaderboard/:gameId?page=1&pageSize=10',
        getPlayerRank: 'GET /api/leaderboard/:gameId/player/:playerId',
        getPlayersNearby: 'GET /api/leaderboard/:gameId/player/:playerId/nearby?range=5',
        applyDecay: 'POST /api/leaderboard/:gameId/decay',
        syncLeaderboard: 'POST /api/leaderboard/:gameId/sync',
      },
    },
  });
});

const startServer = async (): Promise<void> => {
  try {
    console.log('Initializing database...');
    await initializeDatabase();
    
    console.log('Connecting to Redis...');
    await getRedisClient();
    
    app.listen(PORT, () => {
      console.log(`GameVerse N1.19 Leaderboard API running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await closeConnections();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await closeConnections();
  process.exit(0);
});

startServer();
