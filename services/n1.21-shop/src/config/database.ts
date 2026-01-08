import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from './index';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await getPool().query<T>(text, params);
  const duration = Date.now() - start;
  logger.debug('Executed query', { text, duration, rows: result.rowCount });
  return result;
}

export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
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

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW()');
    logger.info('Database connection successful', { timestamp: result.rows[0] });
    return true;
  } catch (error) {
    logger.error('Database connection failed', error);
    return false;
  }
}
