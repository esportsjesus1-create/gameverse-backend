import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const isTest = process.env.NODE_ENV === 'test';

const poolConfig = {
  host: isTest ? process.env.TEST_POSTGRES_HOST : process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(
    isTest ? process.env.TEST_POSTGRES_PORT || '5433' : process.env.POSTGRES_PORT || '5432',
    10
  ),
  database: isTest ? process.env.TEST_POSTGRES_DB : process.env.POSTGRES_DB || 'gameverse',
  user: isTest ? process.env.TEST_POSTGRES_USER : process.env.POSTGRES_USER || 'gameverse',
  password: isTest
    ? process.env.TEST_POSTGRES_PASSWORD
    : process.env.POSTGRES_PASSWORD || 'gameverse',
  max: 5,
};

const pool = new Pool(poolConfig);

interface Migration {
  id: number;
  name: string;
  executed_at: Date;
}

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getExecutedMigrations(client: PoolClient): Promise<string[]> {
  const result = await client.query<Migration>('SELECT name FROM migrations ORDER BY id');
  return result.rows.map((row) => row.name);
}

async function getMigrationFiles(): Promise<string[]> {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir);
  return files
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => {
      const numA = parseInt(a.split('_')[0], 10);
      const numB = parseInt(b.split('_')[0], 10);
      return numA - numB;
    });
}

function parseMigration(content: string): { up: string; down: string } {
  const upMatch = content.match(/-- UP\n([\s\S]*?)(?=-- DOWN|$)/);
  const downMatch = content.match(/-- DOWN\n([\s\S]*?)$/);

  return {
    up: upMatch ? upMatch[1].trim() : content,
    down: downMatch ? downMatch[1].trim() : '',
  };
}

async function runMigrationUp(client: PoolClient, filename: string): Promise<void> {
  const migrationsDir = path.join(__dirname, 'migrations');
  const filePath = path.join(migrationsDir, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  const { up } = parseMigration(content);

  console.info(`Running migration: ${filename}`);

  await client.query('BEGIN');
  try {
    await client.query(up);
    await client.query('INSERT INTO migrations (name) VALUES ($1)', [filename]);
    await client.query('COMMIT');
    console.info(`Migration completed: ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function runMigrationDown(client: PoolClient, filename: string): Promise<void> {
  const migrationsDir = path.join(__dirname, 'migrations');
  const filePath = path.join(migrationsDir, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  const { down } = parseMigration(content);

  if (!down) {
    console.warn(`No DOWN migration found for: ${filename}`);
    return;
  }

  console.info(`Rolling back migration: ${filename}`);

  await client.query('BEGIN');
  try {
    await client.query(down);
    await client.query('DELETE FROM migrations WHERE name = $1', [filename]);
    await client.query('COMMIT');
    console.info(`Rollback completed: ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function migrateUp(steps?: number): Promise<void> {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const executedMigrations = await getExecutedMigrations(client);
    const migrationFiles = await getMigrationFiles();

    const pendingMigrations = migrationFiles.filter((file) => !executedMigrations.includes(file));

    if (pendingMigrations.length === 0) {
      console.info('No pending migrations');
      return;
    }

    const migrationsToRun = steps ? pendingMigrations.slice(0, steps) : pendingMigrations;

    for (const migration of migrationsToRun) {
      await runMigrationUp(client, migration);
    }

    console.info(`Completed ${migrationsToRun.length} migration(s)`);
  } finally {
    client.release();
  }
}

async function migrateDown(steps = 1): Promise<void> {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const executedMigrations = await getExecutedMigrations(client);

    if (executedMigrations.length === 0) {
      console.info('No migrations to rollback');
      return;
    }

    const migrationsToRollback = executedMigrations.slice(-steps).reverse();

    for (const migration of migrationsToRollback) {
      await runMigrationDown(client, migration);
    }

    console.info(`Rolled back ${migrationsToRollback.length} migration(s)`);
  } finally {
    client.release();
  }
}

async function migrateStatus(): Promise<void> {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const executedMigrations = await getExecutedMigrations(client);
    const migrationFiles = await getMigrationFiles();

    console.info('\nMigration Status:');
    console.info('=================\n');

    for (const file of migrationFiles) {
      const status = executedMigrations.includes(file) ? '[x]' : '[ ]';
      console.info(`${status} ${file}`);
    }

    const pending = migrationFiles.filter((f) => !executedMigrations.includes(f));
    console.info(
      `\nTotal: ${migrationFiles.length}, Executed: ${executedMigrations.length}, Pending: ${pending.length}`
    );
  } finally {
    client.release();
  }
}

async function migrateReset(): Promise<void> {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const executedMigrations = await getExecutedMigrations(client);

    for (const migration of [...executedMigrations].reverse()) {
      await runMigrationDown(client, migration);
    }

    console.info('All migrations rolled back');
  } finally {
    client.release();
  }
}

async function migrateFresh(): Promise<void> {
  await migrateReset();
  await migrateUp();
  console.info('Database reset and all migrations applied');
}

async function main(): Promise<void> {
  const command = process.argv[2] || 'up';
  const steps = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;

  try {
    switch (command) {
      case 'up':
        await migrateUp(steps);
        break;
      case 'down':
        await migrateDown(steps || 1);
        break;
      case 'status':
        await migrateStatus();
        break;
      case 'reset':
        await migrateReset();
        break;
      case 'fresh':
        await migrateFresh();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.info('Available commands: up, down, status, reset, fresh');
        process.exit(1);
    }
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

export {
  migrateUp,
  migrateDown,
  migrateStatus,
  migrateReset,
  migrateFresh,
  ensureMigrationsTable,
  getExecutedMigrations,
  getMigrationFiles,
};
