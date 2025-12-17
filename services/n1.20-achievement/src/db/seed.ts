import { pool } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import {
  AchievementType,
  AchievementCategory,
  AchievementRarity
} from '../types/achievement.types.js';

const sampleAchievements = [
  {
    name: 'First Steps',
    description: 'Complete your first game',
    points: 10,
    rarity: AchievementRarity.COMMON,
    type: AchievementType.SINGLE,
    category: AchievementCategory.GAMEPLAY,
    criteria: { type: 'count', target: 1 },
    isHidden: false
  },
  {
    name: 'Veteran Player',
    description: 'Play 100 games',
    points: 50,
    rarity: AchievementRarity.UNCOMMON,
    type: AchievementType.PROGRESSIVE,
    category: AchievementCategory.GAMEPLAY,
    criteria: { type: 'count', target: 100 },
    isHidden: false
  },
  {
    name: 'Social Butterfly',
    description: 'Add 10 friends',
    points: 25,
    rarity: AchievementRarity.COMMON,
    type: AchievementType.PROGRESSIVE,
    category: AchievementCategory.SOCIAL,
    criteria: { type: 'count', target: 10 },
    isHidden: false
  },
  {
    name: 'Collector',
    description: 'Collect items at different tiers',
    points: 100,
    rarity: AchievementRarity.RARE,
    type: AchievementType.TIERED,
    category: AchievementCategory.COLLECTION,
    criteria: { type: 'count', target: 100 },
    isHidden: false,
    tiers: [
      { level: 1, target: 10, points: 10, name: 'Bronze Collector' },
      { level: 2, target: 25, points: 25, name: 'Silver Collector' },
      { level: 3, target: 50, points: 50, name: 'Gold Collector' },
      { level: 4, target: 100, points: 100, name: 'Platinum Collector' }
    ]
  },
  {
    name: 'Explorer',
    description: 'Visit all game zones',
    points: 75,
    rarity: AchievementRarity.RARE,
    type: AchievementType.PROGRESSIVE,
    category: AchievementCategory.EXPLORATION,
    criteria: { type: 'count', target: 20 },
    isHidden: false
  },
  {
    name: 'Champion',
    description: 'Win a competitive tournament',
    points: 200,
    rarity: AchievementRarity.EPIC,
    type: AchievementType.SINGLE,
    category: AchievementCategory.COMPETITIVE,
    criteria: { type: 'boolean', target: 1 },
    isHidden: false
  },
  {
    name: 'Legend',
    description: 'Reach the top 100 leaderboard',
    points: 500,
    rarity: AchievementRarity.LEGENDARY,
    type: AchievementType.SINGLE,
    category: AchievementCategory.COMPETITIVE,
    criteria: { type: 'threshold', target: 100 },
    isHidden: false
  },
  {
    name: 'Secret Hunter',
    description: 'Find the hidden easter egg',
    points: 150,
    rarity: AchievementRarity.EPIC,
    type: AchievementType.SINGLE,
    category: AchievementCategory.SPECIAL,
    criteria: { type: 'boolean', target: 1 },
    isHidden: true
  },
  {
    name: 'Dedicated',
    description: 'Log in for 30 consecutive days',
    points: 100,
    rarity: AchievementRarity.RARE,
    type: AchievementType.PROGRESSIVE,
    category: AchievementCategory.SPECIAL,
    criteria: { type: 'count', target: 30 },
    isHidden: false
  },
  {
    name: 'Master Strategist',
    description: 'Win 50 games with different strategies',
    points: 150,
    rarity: AchievementRarity.EPIC,
    type: AchievementType.TIERED,
    category: AchievementCategory.GAMEPLAY,
    criteria: { type: 'count', target: 50 },
    isHidden: false,
    tiers: [
      { level: 1, target: 10, points: 25, name: 'Apprentice Strategist' },
      { level: 2, target: 25, points: 50, name: 'Skilled Strategist' },
      { level: 3, target: 50, points: 150, name: 'Master Strategist' }
    ]
  }
];

async function seed(): Promise<void> {
  const client = await pool.connect();
  
  try {
    console.info('Starting seed process...');
    
    const { rows } = await client.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM achievements'
    );
    
    if (parseInt(rows[0].count, 10) > 0) {
      console.info('Achievements already exist, skipping seed...');
      return;
    }

    await client.query('BEGIN');

    for (const achievement of sampleAchievements) {
      const id = uuidv4();
      const now = new Date();

      await client.query(
        `INSERT INTO achievements (id, name, description, points, rarity, type, category, criteria, is_hidden, tiers, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id,
          achievement.name,
          achievement.description,
          achievement.points,
          achievement.rarity,
          achievement.type,
          achievement.category,
          JSON.stringify(achievement.criteria),
          achievement.isHidden,
          achievement.tiers ? JSON.stringify(achievement.tiers) : null,
          now,
          now
        ]
      );

      console.info(`Created achievement: ${achievement.name}`);
    }

    await client.query('COMMIT');
    console.info(`Seeded ${sampleAchievements.length} achievements successfully`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

seed()
  .then(() => {
    console.info('Seed process finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
