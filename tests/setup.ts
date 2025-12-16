import { Pool } from 'pg';
import { setPool, closePool } from '../src/db/pool';

let testPool: Pool | null = null;

export async function setupTestDatabase(): Promise<void> {
  testPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'gameverse_ledger_test',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });
  
  setPool(testPool);
  
  await testPool.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    DROP TABLE IF EXISTS reconciliation_runs CASCADE;
    DROP TABLE IF EXISTS audit_logs CASCADE;
    DROP TABLE IF EXISTS balance_snapshots CASCADE;
    DROP TABLE IF EXISTS transaction_entries CASCADE;
    DROP TABLE IF EXISTS transactions CASCADE;
    DROP TABLE IF EXISTS accounts CASCADE;
    DROP TABLE IF EXISTS exchange_rates CASCADE;
    DROP TABLE IF EXISTS currencies CASCADE;
  `);
  
  await testPool.query(`
    CREATE TABLE currencies (
      code VARCHAR(3) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      symbol VARCHAR(10) NOT NULL,
      decimal_places INTEGER NOT NULL DEFAULT 2,
      is_base_currency BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    
    CREATE TABLE exchange_rates (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      from_currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
      to_currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
      rate DECIMAL(20, 10) NOT NULL,
      effective_date DATE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_exchange_rate_date UNIQUE (from_currency, to_currency, effective_date)
    );
    
    CREATE TABLE accounts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL,
      currency_code VARCHAR(3) NOT NULL REFERENCES currencies(code),
      parent_id UUID REFERENCES accounts(id),
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      normal_balance VARCHAR(10) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    
    CREATE TABLE transactions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      idempotency_key VARCHAR(255) NOT NULL UNIQUE,
      reference VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      transaction_date DATE NOT NULL,
      posted_at TIMESTAMP WITH TIME ZONE,
      voided_at TIMESTAMP WITH TIME ZONE,
      void_reason TEXT,
      metadata JSONB DEFAULT '{}',
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    
    CREATE TABLE transaction_entries (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      account_id UUID NOT NULL REFERENCES accounts(id),
      entry_type VARCHAR(10) NOT NULL,
      amount DECIMAL(20, 8) NOT NULL,
      currency_code VARCHAR(3) NOT NULL REFERENCES currencies(code),
      base_currency_amount DECIMAL(20, 8) NOT NULL,
      exchange_rate DECIMAL(20, 10) NOT NULL DEFAULT 1,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    
    CREATE TABLE balance_snapshots (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      account_id UUID NOT NULL REFERENCES accounts(id),
      balance DECIMAL(20, 8) NOT NULL,
      currency_code VARCHAR(3) NOT NULL REFERENCES currencies(code),
      snapshot_date DATE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_snapshot_account_date UNIQUE (account_id, snapshot_date)
    );
    
    CREATE TABLE audit_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      entity_type VARCHAR(50) NOT NULL,
      entity_id UUID NOT NULL,
      action VARCHAR(50) NOT NULL,
      old_value JSONB,
      new_value JSONB,
      user_id VARCHAR(255) NOT NULL,
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    
    CREATE TABLE reconciliation_runs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      run_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      total_accounts INTEGER NOT NULL DEFAULT 0,
      balanced_accounts INTEGER NOT NULL DEFAULT 0,
      imbalanced_accounts INTEGER NOT NULL DEFAULT 0,
      discrepancies JSONB DEFAULT '[]',
      completed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    
    INSERT INTO currencies (code, name, symbol, decimal_places, is_base_currency) VALUES
      ('USD', 'US Dollar', '$', 2, TRUE),
      ('EUR', 'Euro', '€', 2, FALSE),
      ('GBP', 'British Pound', '£', 2, FALSE);
  `);
}

export async function cleanupTestDatabase(): Promise<void> {
  if (testPool) {
    await testPool.query(`
      DELETE FROM reconciliation_runs;
      DELETE FROM audit_logs;
      DELETE FROM balance_snapshots;
      DELETE FROM transaction_entries;
      DELETE FROM transactions;
      DELETE FROM accounts;
      DELETE FROM exchange_rates;
    `);
  }
}

export async function teardownTestDatabase(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

beforeAll(async () => {
  if (process.env.SKIP_DB_SETUP !== 'true') {
    try {
      await setupTestDatabase();
    } catch (error) {
      console.log('Database setup skipped or failed - tests will use mocks');
    }
  }
});

afterAll(async () => {
  if (process.env.SKIP_DB_SETUP !== 'true') {
    try {
      await teardownTestDatabase();
    } catch (error) {
      console.log('Database teardown skipped');
    }
  }
});
