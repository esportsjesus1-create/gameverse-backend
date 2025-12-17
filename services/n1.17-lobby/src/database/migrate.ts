import { pool } from './pool';
import { LoggerService } from '../services/logger.service';

const logger = new LoggerService('Migration');

const migrations = [
  {
    name: '001_create_lobbies_table',
    up: `
      CREATE TABLE IF NOT EXISTS lobbies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        host_id VARCHAR(255) NOT NULL,
        max_players INTEGER NOT NULL DEFAULT 10,
        min_players INTEGER NOT NULL DEFAULT 2,
        status VARCHAR(50) NOT NULL DEFAULT 'waiting',
        game_type VARCHAR(100) NOT NULL,
        countdown_duration INTEGER NOT NULL DEFAULT 10,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_lobbies_status ON lobbies(status);
      CREATE INDEX IF NOT EXISTS idx_lobbies_game_type ON lobbies(game_type);
      CREATE INDEX IF NOT EXISTS idx_lobbies_host_id ON lobbies(host_id);
    `,
    down: `DROP TABLE IF EXISTS lobbies;`
  },
  {
    name: '002_create_lobby_players_table',
    up: `
      CREATE TABLE IF NOT EXISTS lobby_players (
        lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
        player_id VARCHAR(255) NOT NULL,
        ready_status VARCHAR(50) NOT NULL DEFAULT 'not_ready',
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (lobby_id, player_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_lobby_players_player_id ON lobby_players(player_id);
      CREATE INDEX IF NOT EXISTS idx_lobby_players_ready_status ON lobby_players(ready_status);
    `,
    down: `DROP TABLE IF EXISTS lobby_players;`
  },
  {
    name: '003_create_migrations_table',
    up: `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
    down: `DROP TABLE IF EXISTS migrations;`
  }
];

async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    const { rows: executedMigrations } = await client.query(
      'SELECT name FROM migrations'
    );
    const executedNames = new Set(executedMigrations.map(m => m.name));
    
    for (const migration of migrations) {
      if (!executedNames.has(migration.name)) {
        logger.info(`Running migration: ${migration.name}`);
        await client.query(migration.up);
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migration.name]
        );
        logger.info(`Migration completed: ${migration.name}`);
      }
    }
    
    await client.query('COMMIT');
    logger.info('All migrations completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Migration failed', error as Error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed', error);
      process.exit(1);
    });
}

export { runMigrations, migrations };
