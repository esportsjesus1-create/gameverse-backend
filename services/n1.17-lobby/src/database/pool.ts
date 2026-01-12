import { Pool, PoolConfig } from 'pg';
import { config } from '../config';
import { LoggerService } from '../services/logger.service';

const logger = new LoggerService('DatabasePool');

const poolConfig: PoolConfig = {
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.database,
  user: config.postgres.user,
  password: config.postgres.password,
  max: config.postgres.maxConnections,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: config.postgres.ssl ? { rejectUnauthorized: false } : undefined
};

export const pool = new Pool(poolConfig);

pool.on('connect', () => {
  logger.debug('New client connected to database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

export async function initializeDatabase(): Promise<void> {
  try {
    const client = await pool.connect();
    logger.info('Database connection established');
    client.release();
  } catch (error) {
    logger.error('Failed to connect to database', error as Error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
  logger.info('Database connection pool closed');
}
