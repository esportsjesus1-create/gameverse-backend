import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

async function migrate(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    const migrationsDir = join(__dirname, '../../migrations');
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const executedResult = await pool.query<{ name: string }>(
      'SELECT name FROM migrations'
    );
    const executed = new Set(executedResult.rows.map((r) => r.name));

    for (const file of files) {
      if (executed.has(file)) {
        console.log(`Skipping ${file} (already executed)`);
        continue;
      }

      console.log(`Executing ${file}...`);
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');

      const upMigration = sql.split('-- Down Migration')[0];

      await pool.query(upMigration);
      await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
      console.log(`Completed ${file}`);
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
