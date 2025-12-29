import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
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

async function seedUsers(client: PoolClient): Promise<string[]> {
  const userIds: string[] = [];
  const users = [
    { username: 'player1', email: 'player1@gameverse.com', display_name: 'Player One', level: 50 },
    { username: 'player2', email: 'player2@gameverse.com', display_name: 'Player Two', level: 45 },
    {
      username: 'player3',
      email: 'player3@gameverse.com',
      display_name: 'Player Three',
      level: 30,
    },
    { username: 'player4', email: 'player4@gameverse.com', display_name: 'Player Four', level: 25 },
    { username: 'player5', email: 'player5@gameverse.com', display_name: 'Player Five', level: 60 },
    { username: 'admin', email: 'admin@gameverse.com', display_name: 'Admin User', level: 100 },
    { username: 'moderator', email: 'mod@gameverse.com', display_name: 'Moderator', level: 80 },
    { username: 'newbie', email: 'newbie@gameverse.com', display_name: 'New Player', level: 1 },
    { username: 'pro_gamer', email: 'pro@gameverse.com', display_name: 'Pro Gamer', level: 99 },
    { username: 'casual', email: 'casual@gameverse.com', display_name: 'Casual Player', level: 15 },
  ];

  for (const user of users) {
    const id = uuidv4();
    await client.query(
      `INSERT INTO users (id, username, email, display_name, level, status)
       VALUES ($1, $2, $3, $4, $5, 'online')
       ON CONFLICT (username) DO NOTHING`,
      [id, user.username, user.email, user.display_name, user.level]
    );
    userIds.push(id);
  }

  console.info(`Seeded ${users.length} users`);
  return userIds;
}

async function seedPartyBenefits(client: PoolClient): Promise<void> {
  const benefits = [
    {
      name: 'Duo XP Boost',
      description: 'Bonus XP for 2-player parties',
      type: 'xp_multiplier',
      value: 1.1,
      min_party_size: 2,
      max_party_size: 2,
    },
    {
      name: 'Squad XP Boost',
      description: 'Bonus XP for 3-4 player parties',
      type: 'xp_multiplier',
      value: 1.25,
      min_party_size: 3,
      max_party_size: 4,
    },
    {
      name: 'Raid XP Boost',
      description: 'Bonus XP for 5+ player parties',
      type: 'xp_multiplier',
      value: 1.5,
      min_party_size: 5,
      max_party_size: null,
    },
    {
      name: 'Party Loot Bonus',
      description: 'Increased loot drops for parties',
      type: 'loot_bonus',
      value: 0.15,
      min_party_size: 2,
      max_party_size: null,
    },
    {
      name: 'Achievement Hunter',
      description: 'Bonus achievement progress in parties',
      type: 'achievement_bonus',
      value: 0.2,
      min_party_size: 3,
      max_party_size: null,
    },
    {
      name: 'Lucky Drop',
      description: 'Increased rare drop rates',
      type: 'drop_rate_bonus',
      value: 0.1,
      min_party_size: 4,
      max_party_size: null,
    },
    {
      name: 'Currency Boost',
      description: 'Bonus currency for party play',
      type: 'currency_bonus',
      value: 0.05,
      min_party_size: 2,
      max_party_size: null,
    },
  ];

  for (const benefit of benefits) {
    await client.query(
      `INSERT INTO party_benefits (name, description, type, value, min_party_size, max_party_size, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT DO NOTHING`,
      [
        benefit.name,
        benefit.description,
        benefit.type,
        benefit.value,
        benefit.min_party_size,
        benefit.max_party_size,
      ]
    );
  }

  console.info(`Seeded ${benefits.length} party benefits`);
}

async function seedSeasonTiers(client: PoolClient, seasonId: string): Promise<void> {
  const tiers = [
    {
      name: 'bronze',
      display_name: 'Bronze',
      tier_order: 1,
      min_mmr: 0,
      max_mmr: 1199,
      color: '#CD7F32',
    },
    {
      name: 'silver',
      display_name: 'Silver',
      tier_order: 2,
      min_mmr: 1200,
      max_mmr: 1499,
      color: '#C0C0C0',
    },
    {
      name: 'gold',
      display_name: 'Gold',
      tier_order: 3,
      min_mmr: 1500,
      max_mmr: 1799,
      color: '#FFD700',
    },
    {
      name: 'platinum',
      display_name: 'Platinum',
      tier_order: 4,
      min_mmr: 1800,
      max_mmr: 2099,
      color: '#E5E4E2',
    },
    {
      name: 'diamond',
      display_name: 'Diamond',
      tier_order: 5,
      min_mmr: 2100,
      max_mmr: 2399,
      color: '#B9F2FF',
    },
    {
      name: 'master',
      display_name: 'Master',
      tier_order: 6,
      min_mmr: 2400,
      max_mmr: 2699,
      color: '#9932CC',
    },
    {
      name: 'grandmaster',
      display_name: 'Grandmaster',
      tier_order: 7,
      min_mmr: 2700,
      max_mmr: null,
      color: '#FF4500',
    },
  ];

  for (const tier of tiers) {
    await client.query(
      `INSERT INTO season_tiers (season_id, name, display_name, tier_order, min_mmr, max_mmr, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        seasonId,
        tier.name,
        tier.display_name,
        tier.tier_order,
        tier.min_mmr,
        tier.max_mmr,
        tier.color,
      ]
    );
  }

  console.info(`Seeded ${tiers.length} season tiers`);
}

async function seedSeason(client: PoolClient): Promise<string> {
  const seasonId = uuidv4();
  const startAt = new Date();
  const endAt = new Date();
  endAt.setMonth(endAt.getMonth() + 3);

  await client.query(
    `INSERT INTO seasons (id, name, description, game_id, season_number, type, status, start_at, end_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT DO NOTHING`,
    [
      seasonId,
      'Season 1 - Genesis',
      'The first competitive season of GameVerse',
      'gameverse-main',
      1,
      'ranked',
      'active',
      startAt,
      endAt,
    ]
  );

  await seedSeasonTiers(client, seasonId);

  console.info('Seeded season');
  return seasonId;
}

async function seedSeasonRewards(client: PoolClient, seasonId: string): Promise<void> {
  const result = await client.query('SELECT id, name FROM season_tiers WHERE season_id = $1', [
    seasonId,
  ]);
  const tiers = result.rows;

  const rewards = [
    { tier_name: 'bronze', reward_type: 'badge', reward_description: 'Bronze Season Badge' },
    { tier_name: 'silver', reward_type: 'badge', reward_description: 'Silver Season Badge' },
    { tier_name: 'gold', reward_type: 'skin', reward_description: 'Gold Champion Skin' },
    { tier_name: 'platinum', reward_type: 'skin', reward_description: 'Platinum Elite Skin' },
    { tier_name: 'diamond', reward_type: 'border', reward_description: 'Diamond Profile Border' },
    { tier_name: 'master', reward_type: 'title', reward_description: 'Master Title' },
    {
      tier_name: 'grandmaster',
      reward_type: 'emote',
      reward_description: 'Grandmaster Exclusive Emote',
      is_exclusive: true,
    },
  ];

  for (const reward of rewards) {
    const tier = tiers.find((t: { name: string }) => t.name === reward.tier_name);
    if (tier) {
      await client.query(
        `INSERT INTO season_rewards (season_id, tier_id, reward_type, reward_description, is_exclusive)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [
          seasonId,
          tier.id,
          reward.reward_type,
          reward.reward_description,
          reward.is_exclusive || false,
        ]
      );
    }
  }

  console.info(`Seeded ${rewards.length} season rewards`);
}

async function seed(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userIds = await seedUsers(client);
    await seedPartyBenefits(client);
    const seasonId = await seedSeason(client);
    await seedSeasonRewards(client, seasonId);

    await client.query('COMMIT');
    console.info('\nSeeding completed successfully');
    console.info(`Created ${userIds.length} users`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);

export { seed, seedUsers, seedPartyBenefits, seedSeason, seedSeasonTiers, seedSeasonRewards };
