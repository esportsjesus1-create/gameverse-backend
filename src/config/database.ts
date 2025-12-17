import { Pool, PoolConfig, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const poolConfig: PoolConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'gameverse',
  user: process.env.POSTGRES_USER || 'gameverse',
  password: process.env.POSTGRES_PASSWORD || 'gameverse',
  max: parseInt(process.env.POSTGRES_POOL_SIZE || '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const pool = new Pool(poolConfig);

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        avatar_url TEXT,
        status VARCHAR(20) DEFAULT 'offline',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS parties (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        leader_id UUID NOT NULL REFERENCES users(id),
        max_size INTEGER DEFAULT 4,
        is_private BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'active',
        voice_channel_id UUID,
        game_mode VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS party_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        role VARCHAR(20) DEFAULT 'member',
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_ready BOOLEAN DEFAULT false,
        is_muted BOOLEAN DEFAULT false,
        UNIQUE(party_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS party_invites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES users(id),
        recipient_id UUID NOT NULL REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'pending',
        message TEXT,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        responded_at TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE IF NOT EXISTS voice_channels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        max_participants INTEGER DEFAULT 10,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(party_id)
      );

      CREATE TABLE IF NOT EXISTS voice_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        channel_id UUID NOT NULL REFERENCES voice_channels(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        is_muted BOOLEAN DEFAULT false,
        is_deafened BOOLEAN DEFAULT false,
        is_speaking BOOLEAN DEFAULT false,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(channel_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS party_benefits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL,
        value DECIMAL(10, 4) NOT NULL,
        min_party_size INTEGER DEFAULT 2,
        max_party_size INTEGER,
        is_active BOOLEAN DEFAULT true
      );

      CREATE INDEX IF NOT EXISTS idx_party_members_party_id ON party_members(party_id);
      CREATE INDEX IF NOT EXISTS idx_party_members_user_id ON party_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_party_invites_recipient_id ON party_invites(recipient_id);
      CREATE INDEX IF NOT EXISTS idx_party_invites_party_id ON party_invites(party_id);
      CREATE INDEX IF NOT EXISTS idx_party_invites_status ON party_invites(status);
      CREATE INDEX IF NOT EXISTS idx_voice_participants_channel_id ON voice_participants(channel_id);
      CREATE INDEX IF NOT EXISTS idx_voice_participants_user_id ON voice_participants(user_id);
    `);

    await seedBenefits(client);
    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

async function seedBenefits(client: PoolClient): Promise<void> {
  const existingBenefits = await client.query('SELECT COUNT(*) FROM party_benefits');
  if (parseInt(existingBenefits.rows[0].count, 10) > 0) {
    return;
  }

  const benefits = [
    { name: 'Duo XP Boost', description: 'Bonus XP for 2-player parties', type: 'xp_multiplier', value: 1.1, min_party_size: 2, max_party_size: 2 },
    { name: 'Squad XP Boost', description: 'Bonus XP for 3-4 player parties', type: 'xp_multiplier', value: 1.25, min_party_size: 3, max_party_size: 4 },
    { name: 'Raid XP Boost', description: 'Bonus XP for 5+ player parties', type: 'xp_multiplier', value: 1.5, min_party_size: 5, max_party_size: null },
    { name: 'Party Loot Bonus', description: 'Increased loot drops for parties', type: 'loot_bonus', value: 0.15, min_party_size: 2, max_party_size: null },
    { name: 'Achievement Hunter', description: 'Bonus achievement progress in parties', type: 'achievement_bonus', value: 0.2, min_party_size: 3, max_party_size: null },
    { name: 'Lucky Drop', description: 'Increased rare drop rates', type: 'drop_rate_bonus', value: 0.1, min_party_size: 4, max_party_size: null },
    { name: 'Party Exclusive Skin', description: 'Unlock exclusive party skin', type: 'exclusive_reward', value: 1, min_party_size: 5, max_party_size: null },
  ];

  for (const benefit of benefits) {
    await client.query(
      `INSERT INTO party_benefits (name, description, type, value, min_party_size, max_party_size, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [benefit.name, benefit.description, benefit.type, benefit.value, benefit.min_party_size, benefit.max_party_size]
    );
  }
  console.log('Party benefits seeded successfully');
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
