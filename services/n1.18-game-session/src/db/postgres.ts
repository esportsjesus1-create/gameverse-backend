import { Pool, PoolClient } from 'pg';
import { config } from '../config';

export const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.database,
  user: config.postgres.user,
  password: config.postgres.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const result = await pool.query(text, params);
  return (result.rows[0] as T) || null;
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export async function initializeDatabase(): Promise<void> {
  const client = await getClient();
  
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_type VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        started_at TIMESTAMP,
        paused_at TIMESTAMP,
        ended_at TIMESTAMP,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_game_sessions_game_type ON game_sessions(game_type);
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS session_players (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
        player_id VARCHAR(100) NOT NULL,
        player_name VARCHAR(255) NOT NULL,
        team_id VARCHAR(100),
        connection_status VARCHAR(20) NOT NULL DEFAULT 'connected',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        left_at TIMESTAMP,
        UNIQUE(session_id, player_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_session_players_session ON session_players(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_players_player ON session_players(player_id);
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS player_stats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
        player_id VARCHAR(100) NOT NULL,
        kills INTEGER DEFAULT 0,
        deaths INTEGER DEFAULT 0,
        assists INTEGER DEFAULT 0,
        damage_dealt INTEGER DEFAULT 0,
        damage_received INTEGER DEFAULT 0,
        objectives_completed INTEGER DEFAULT 0,
        score INTEGER DEFAULT 0,
        custom_stats JSONB DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, player_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_player_stats_session ON player_stats(session_id);
      CREATE INDEX IF NOT EXISTS idx_player_stats_player ON player_stats(player_id);
    `);
    
    console.log('Database tables initialized successfully');
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
