import { Pool } from 'pg';
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

async function reset(): Promise<void> {
  const client = await pool.connect();
  try {
    console.info('Dropping all tables...');

    await client.query(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    console.info('All tables dropped');

    await client.query(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT typname FROM pg_type WHERE typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) LOOP
          EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    console.info('All custom types dropped');
    console.info('Database reset complete');
  } catch (error) {
    console.error('Reset error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

reset().catch(console.error);

export { reset };
