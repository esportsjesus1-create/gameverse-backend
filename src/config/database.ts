import { Pool, PoolConfig, PoolClient, QueryResult } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../config/logger';

dotenv.config();

const isTest = process.env.NODE_ENV === 'test';

const poolConfig: PoolConfig = {
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
  max: parseInt(process.env.POSTGRES_POOL_SIZE || '20', 10),
  idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '2000', 10),
};

export const pool = new Pool(poolConfig);

pool.on('error', (err: Error) => {
  logger.error('Unexpected error on idle database client', { error: err.message });
});

pool.on('connect', () => {
  logger.info('New database client connected');
});

export interface DatabaseClient {
  query<T extends QueryResult>(text: string, params?: unknown[]): Promise<T>;
  release(): void;
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export async function query<T extends QueryResult>(text: string, params?: unknown[]): Promise<T> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  logger.debug('Executed query', { text, duration, rows: result.rowCount });
  return result as T;
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT 1');
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Database health check failed', { error });
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
  logger.info('Database connection pool closed');
}

export { PoolClient };
