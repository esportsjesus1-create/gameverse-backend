import { readFileSync } from 'fs';
import { join } from 'path';
import { query } from './pool';

export async function runMigrations(): Promise<void> {
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  for (const statement of statements) {
    try {
      await query(statement);
    } catch (error) {
      if (error instanceof Error && !error.message.includes('already exists')) {
        throw error;
      }
    }
  }
  
  console.log('Migrations completed successfully');
}

export async function dropAllTables(): Promise<void> {
  const tables = [
    'reconciliation_runs',
    'audit_logs',
    'balance_snapshots',
    'transaction_entries',
    'transactions',
    'accounts',
    'exchange_rates',
    'currencies',
  ];
  
  for (const table of tables) {
    await query(`DROP TABLE IF EXISTS ${table} CASCADE`);
  }
  
  await query('DROP FUNCTION IF EXISTS update_updated_at_column CASCADE');
  await query('DROP FUNCTION IF EXISTS validate_transaction_balance CASCADE');
  
  console.log('All tables dropped successfully');
}
