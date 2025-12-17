import { Pool, PoolConfig } from 'pg';
import { config } from './index';
import { logger } from '../utils/logger';

const poolConfig: PoolConfig = {
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.database,
  user: config.postgres.user,
  password: config.postgres.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
};

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

pool.on('connect', () => {
  logger.debug('New client connected to PostgreSQL');
});

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS quests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        required_level INTEGER DEFAULT 1,
        starts_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS quest_objectives (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        description TEXT,
        target_value INTEGER NOT NULL DEFAULT 1,
        target_id VARCHAR(255),
        order_index INTEGER DEFAULT 0,
        is_optional BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS quest_rewards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        value INTEGER NOT NULL,
        item_id VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_quests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'accepted',
        accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        claimed_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, quest_id)
      );

      CREATE TABLE IF NOT EXISTS user_quest_progress (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_quest_id UUID NOT NULL REFERENCES user_quests(id) ON DELETE CASCADE,
        objective_id UUID NOT NULL REFERENCES quest_objectives(id) ON DELETE CASCADE,
        current_value INTEGER DEFAULT 0,
        is_completed BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_quest_id, objective_id)
      );

      CREATE TABLE IF NOT EXISTS user_rewards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
        reward_id UUID NOT NULL REFERENCES quest_rewards(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        value INTEGER NOT NULL,
        item_id VARCHAR(255),
        metadata JSONB,
        claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_quests_type ON quests(type);
      CREATE INDEX IF NOT EXISTS idx_quests_status ON quests(status);
      CREATE INDEX IF NOT EXISTS idx_quests_expires_at ON quests(expires_at);
      CREATE INDEX IF NOT EXISTS idx_user_quests_user_id ON user_quests(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_quests_status ON user_quests(status);
      CREATE INDEX IF NOT EXISTS idx_user_rewards_user_id ON user_rewards(user_id);
    `);
    logger.info('Database initialized successfully');
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
  logger.info('Database connection pool closed');
}
