import { Pool } from 'pg';

let testPool: Pool | null = null;

export function getTestPool(): Pool {
  if (!testPool) {
    testPool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://gameverse:gameverse_secret@localhost:5433/gameverse_shop_test',
      max: 5,
    });
  }
  return testPool;
}

export async function setupTestDatabase(): Promise<void> {
  const pool = getTestPool();
  
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    DROP TABLE IF EXISTS inventory_history CASCADE;
    DROP TABLE IF EXISTS inventory CASCADE;
    DROP TABLE IF EXISTS bundle_items CASCADE;
    DROP TABLE IF EXISTS bundles CASCADE;
    DROP TABLE IF EXISTS items CASCADE;
    
    CREATE TABLE items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
      category VARCHAR(100),
      image_url VARCHAR(500),
      metadata JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE bundles (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
      discount_value DECIMAL(10, 2) NOT NULL CHECK (discount_value >= 0),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE bundle_items (
      bundle_id UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
      item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      PRIMARY KEY (bundle_id, item_id)
    );
    
    CREATE TABLE inventory (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      item_id UUID NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
      low_stock_threshold INTEGER NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT check_reserved_not_exceed_quantity CHECK (reserved_quantity <= quantity)
    );
    
    CREATE TABLE inventory_history (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('add', 'remove', 'reserve', 'release')),
      quantity_change INTEGER NOT NULL,
      previous_quantity INTEGER NOT NULL,
      new_quantity INTEGER NOT NULL,
      reason VARCHAR(500),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function cleanupTestDatabase(): Promise<void> {
  const pool = getTestPool();
  await pool.query(`
    TRUNCATE TABLE inventory_history CASCADE;
    TRUNCATE TABLE inventory CASCADE;
    TRUNCATE TABLE bundle_items CASCADE;
    TRUNCATE TABLE bundles CASCADE;
    TRUNCATE TABLE items CASCADE;
  `);
}

export async function closeTestPool(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

jest.setTimeout(30000);

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://gameverse:gameverse_secret@localhost:5433/gameverse_shop_test';
});

afterAll(async () => {
  await closeTestPool();
});
