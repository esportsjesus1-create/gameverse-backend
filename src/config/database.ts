import { Pool } from 'pg';
import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'gameverse',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

let redisClient: RedisClientType;

export const getRedisClient = async (): Promise<RedisClientType> => {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    redisClient.on('error', (err) => console.error('Redis Client Error', err));
    await redisClient.connect();
  }
  return redisClient;
};

export const getPgPool = (): Pool => {
  return pgPool;
};

export const initializeDatabase = async (): Promise<void> => {
  const client = await pgPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS players (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        game_id VARCHAR(255) NOT NULL,
        raw_score BIGINT NOT NULL,
        decayed_score DOUBLE PRECISION NOT NULL,
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_decay_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(player_id, game_id)
      );

      CREATE INDEX IF NOT EXISTS idx_scores_game_id ON scores(game_id);
      CREATE INDEX IF NOT EXISTS idx_scores_decayed_score ON scores(decayed_score DESC);
      CREATE INDEX IF NOT EXISTS idx_scores_player_game ON scores(player_id, game_id);
    `);
    console.log('Database tables initialized successfully');
  } finally {
    client.release();
  }
};

export const closeConnections = async (): Promise<void> => {
  await pgPool.end();
  if (redisClient) {
    await redisClient.quit();
  }
};
