import { Pool, PoolConfig } from 'pg';
import { config } from './index.js';

const poolConfig: PoolConfig = {
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  max: config.database.maxConnections,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false
};

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const result = await pool.query(text, params);
  return (result.rows[0] as T) ?? null;
}

export async function execute(text: string, params?: unknown[]): Promise<number> {
  const result = await pool.query(text, params);
  return result.rowCount ?? 0;
}

export async function transaction<T>(
  callback: (client: {
    query: <R>(text: string, params?: unknown[]) => Promise<R[]>;
    queryOne: <R>(text: string, params?: unknown[]) => Promise<R | null>;
    execute: (text: string, params?: unknown[]) => Promise<number>;
  }) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback({
      query: async <R>(text: string, params?: unknown[]): Promise<R[]> => {
        const res = await client.query(text, params);
        return res.rows as R[];
      },
      queryOne: async <R>(text: string, params?: unknown[]): Promise<R | null> => {
        const res = await client.query(text, params);
        return (res.rows[0] as R) ?? null;
      },
      execute: async (text: string, params?: unknown[]): Promise<number> => {
        const res = await client.query(text, params);
        return res.rowCount ?? 0;
      }
    });
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
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
