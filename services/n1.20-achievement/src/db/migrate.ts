import { pool } from '../config/database.js';

const migrations = [
  {
    name: '001_create_achievements_table',
    up: `
      CREATE TABLE IF NOT EXISTS achievements (
        id UUID PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(500) NOT NULL,
        icon_url TEXT,
        points INTEGER NOT NULL DEFAULT 10,
        rarity VARCHAR(20) NOT NULL DEFAULT 'common',
        type VARCHAR(20) NOT NULL DEFAULT 'single',
        category VARCHAR(20) NOT NULL DEFAULT 'gameplay',
        criteria JSONB NOT NULL,
        is_hidden BOOLEAN NOT NULL DEFAULT false,
        tiers JSONB,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
      CREATE INDEX IF NOT EXISTS idx_achievements_rarity ON achievements(rarity);
      CREATE INDEX IF NOT EXISTS idx_achievements_type ON achievements(type);
      CREATE INDEX IF NOT EXISTS idx_achievements_is_hidden ON achievements(is_hidden);
    `
  },
  {
    name: '002_create_user_achievements_table',
    up: `
      CREATE TABLE IF NOT EXISTS user_achievements (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
        progress INTEGER NOT NULL DEFAULT 0,
        current_tier INTEGER NOT NULL DEFAULT 0,
        unlocked BOOLEAN NOT NULL DEFAULT false,
        unlocked_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, achievement_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
      CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked ON user_achievements(unlocked);
      CREATE INDEX IF NOT EXISTS idx_user_achievements_user_unlocked ON user_achievements(user_id, unlocked);
    `
  },
  {
    name: '003_create_notifications_table',
    up: `
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        message VARCHAR(1000) NOT NULL,
        data JSONB,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_is_read ON notifications(user_id, is_read);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
      CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
    `
  },
  {
    name: '004_create_migrations_table',
    up: `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `
  }
];

async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    const { rows: executedMigrations } = await client.query<{ name: string }>(
      'SELECT name FROM migrations ORDER BY id'
    );
    const executedNames = new Set(executedMigrations.map(m => m.name));

    for (const migration of migrations) {
      if (executedNames.has(migration.name)) {
        console.info(`Migration ${migration.name} already executed, skipping...`);
        continue;
      }

      console.info(`Running migration: ${migration.name}`);
      
      await client.query('BEGIN');
      try {
        await client.query(migration.up);
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migration.name]
        );
        await client.query('COMMIT');
        console.info(`Migration ${migration.name} completed successfully`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.info('All migrations completed successfully');
  } finally {
    client.release();
  }
}

runMigrations()
  .then(() => {
    console.info('Migration process finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
