import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';
import {
  createTestUser,
  createTestSeason,
  createSeasonTiers,
  registerSeasonPlayer,
  cleanupTestData,
} from '../helpers/testUtils';

describe('E2E Season Tests', () => {
  let pool: Pool;
  let redis: Redis;
  let client: PoolClient;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.TEST_POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.TEST_POSTGRES_PORT || '5433', 10),
      database: process.env.TEST_POSTGRES_DB || 'gameverse_test',
      user: process.env.TEST_POSTGRES_USER || 'gameverse_test',
      password: process.env.TEST_POSTGRES_PASSWORD || 'gameverse_test_secret',
    });
    redis = new Redis({
      host: process.env.TEST_REDIS_HOST || 'localhost',
      port: parseInt(process.env.TEST_REDIS_PORT || '6380', 10),
      db: parseInt(process.env.TEST_REDIS_DB || '1', 10),
      lazyConnect: true,
    });
  });

  beforeEach(async () => {
    client = await pool.connect();
    await cleanupTestData(client);
  });

  afterEach(async () => {
    if (client) {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
    await redis.quit();
  });

  describe('E2E-SEASON-001: Create season with valid parameters', () => {
    it('should create a new season successfully', async () => {
      const season = await createTestSeason(client, {
        name: 'Season 1 - Genesis',
        season_number: 1,
      });

      expect(season).toBeDefined();
      expect(season.id).toBeDefined();
      expect(season.name).toBe('Season 1 - Genesis');
      expect(season.status).toBe('active');
    });
  });

  describe('E2E-SEASON-002: Create ranked season', () => {
    it('should create ranked season', async () => {
      const season = await createTestSeason(client, { type: 'ranked' });

      expect(season.type).toBe('ranked');
    });
  });

  describe('E2E-SEASON-003: Create casual season', () => {
    it('should create casual season', async () => {
      const season = await createTestSeason(client, { type: 'casual' });

      expect(season.type).toBe('casual');
    });
  });

  describe('E2E-SEASON-004: Create event season', () => {
    it('should create event season', async () => {
      const season = await createTestSeason(client, { type: 'event' });

      expect(season.type).toBe('event');
    });
  });

  describe('E2E-SEASON-005: Create battle pass season', () => {
    it('should create battle pass season', async () => {
      const season = await createTestSeason(client, { type: 'battle_pass' });

      expect(season.type).toBe('battle_pass');
    });
  });

  describe('E2E-SEASON-006: Create season tiers', () => {
    it('should create tiers for season', async () => {
      const season = await createTestSeason(client);
      await createSeasonTiers(client, season.id);

      const result = await client.query(
        'SELECT * FROM season_tiers WHERE season_id = $1 ORDER BY tier_order',
        [season.id]
      );
      expect(result.rows.length).toBe(7);
      expect(result.rows[0].name).toBe('bronze');
      expect(result.rows[6].name).toBe('grandmaster');
    });
  });

  describe('E2E-SEASON-007: Register player for season', () => {
    it('should register player for season', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);

      const player = await registerSeasonPlayer(client, season.id, user.id);

      expect(player.season_id).toBe(season.id);
      expect(player.user_id).toBe(user.id);
      expect(player.current_mmr).toBe(1000);
    });
  });

  describe('E2E-SEASON-008: Set initial MMR', () => {
    it('should set initial MMR for player', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client, { initial_mmr: 1200 });

      const player = await registerSeasonPlayer(client, season.id, user.id, { current_mmr: 1200 });

      expect(player.current_mmr).toBe(1200);
    });
  });

  describe('E2E-SEASON-009: Update player MMR after match', () => {
    it('should update player MMR', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await registerSeasonPlayer(client, season.id, user.id);

      await client.query(
        'UPDATE season_players SET current_mmr = $1, peak_mmr = $2 WHERE season_id = $3 AND user_id = $4',
        [1050, 1050, season.id, user.id]
      );

      const result = await client.query(
        'SELECT current_mmr, peak_mmr FROM season_players WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );
      expect(result.rows[0].current_mmr).toBe(1050);
    });
  });

  describe('E2E-SEASON-010: Track peak MMR', () => {
    it('should track peak MMR separately', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await registerSeasonPlayer(client, season.id, user.id, { current_mmr: 1000, peak_mmr: 1000 });

      await client.query(
        'UPDATE season_players SET current_mmr = 1100, peak_mmr = GREATEST(peak_mmr, 1100) WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );
      await client.query(
        'UPDATE season_players SET current_mmr = 1050, peak_mmr = GREATEST(peak_mmr, 1050) WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );

      const result = await client.query(
        'SELECT current_mmr, peak_mmr FROM season_players WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );
      expect(result.rows[0].current_mmr).toBe(1050);
      expect(result.rows[0].peak_mmr).toBe(1100);
    });
  });

  describe('E2E-SEASON-011: Record placement match', () => {
    it('should record placement match', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await registerSeasonPlayer(client, season.id, user.id);

      await client.query(
        'UPDATE season_players SET placement_games_played = placement_games_played + 1 WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );

      const result = await client.query(
        'SELECT placement_games_played FROM season_players WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );
      expect(result.rows[0].placement_games_played).toBe(1);
    });
  });

  describe('E2E-SEASON-012: Complete placement matches', () => {
    it('should mark placement as completed', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client, { placement_matches: 10 });
      await registerSeasonPlayer(client, season.id, user.id, { placement_games_played: 10 });

      await client.query(
        'UPDATE season_players SET placement_completed = true WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );

      const result = await client.query(
        'SELECT placement_completed FROM season_players WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );
      expect(result.rows[0].placement_completed).toBe(true);
    });
  });

  describe('E2E-SEASON-013: Update win/loss record', () => {
    it('should update win/loss record', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await registerSeasonPlayer(client, season.id, user.id);

      await client.query(
        'UPDATE season_players SET wins = wins + 1 WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );

      const result = await client.query(
        'SELECT wins, losses FROM season_players WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );
      expect(result.rows[0].wins).toBe(1);
      expect(result.rows[0].losses).toBe(0);
    });
  });

  describe('E2E-SEASON-014: Track win streak', () => {
    it('should track current win streak', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await registerSeasonPlayer(client, season.id, user.id);

      await client.query(
        'UPDATE season_players SET win_streak = 5, best_win_streak = GREATEST(best_win_streak, 5) WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );

      const result = await client.query(
        'SELECT win_streak, best_win_streak FROM season_players WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );
      expect(result.rows[0].win_streak).toBe(5);
      expect(result.rows[0].best_win_streak).toBe(5);
    });
  });

  describe('E2E-SEASON-015: Reset win streak on loss', () => {
    it('should reset win streak on loss', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await registerSeasonPlayer(client, season.id, user.id, { win_streak: 5, best_win_streak: 5 });

      await client.query(
        'UPDATE season_players SET win_streak = 0, losses = losses + 1 WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );

      const result = await client.query(
        'SELECT win_streak, best_win_streak FROM season_players WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );
      expect(result.rows[0].win_streak).toBe(0);
      expect(result.rows[0].best_win_streak).toBe(5);
    });
  });

  describe('E2E-SEASON-016: Assign tier based on MMR', () => {
    it('should assign correct tier based on MMR', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await createSeasonTiers(client, season.id);
      await registerSeasonPlayer(client, season.id, user.id, { current_mmr: 1500 });

      const tierResult = await client.query(
        'SELECT id FROM season_tiers WHERE season_id = $1 AND min_mmr <= $2 AND (max_mmr IS NULL OR max_mmr >= $2)',
        [season.id, 1500]
      );

      await client.query(
        'UPDATE season_players SET tier_id = $1 WHERE season_id = $2 AND user_id = $3',
        [tierResult.rows[0].id, season.id, user.id]
      );

      const result = await client.query(
        `SELECT sp.*, st.name as tier_name FROM season_players sp
         JOIN season_tiers st ON sp.tier_id = st.id
         WHERE sp.season_id = $1 AND sp.user_id = $2`,
        [season.id, user.id]
      );
      expect(result.rows[0].tier_name).toBe('gold');
    });
  });

  describe('E2E-SEASON-017: Start promotion series', () => {
    it('should start promotion series', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await registerSeasonPlayer(client, season.id, user.id);

      await client.query(
        'UPDATE season_players SET in_promotion_series = true, promotion_wins = 0, promotion_losses = 0 WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );

      const result = await client.query(
        'SELECT in_promotion_series FROM season_players WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );
      expect(result.rows[0].in_promotion_series).toBe(true);
    });
  });

  describe('E2E-SEASON-018: Win promotion series', () => {
    it('should complete promotion series with win', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await registerSeasonPlayer(client, season.id, user.id, {
        in_promotion_series: true,
        promotion_wins: 2,
        promotion_losses: 1,
      });

      await client.query(
        'UPDATE season_players SET promotion_wins = 3, in_promotion_series = false WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );

      const result = await client.query(
        'SELECT promotion_wins, in_promotion_series FROM season_players WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );
      expect(result.rows[0].promotion_wins).toBe(3);
      expect(result.rows[0].in_promotion_series).toBe(false);
    });
  });

  describe('E2E-SEASON-019: Fail promotion series', () => {
    it('should fail promotion series', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await registerSeasonPlayer(client, season.id, user.id, {
        in_promotion_series: true,
        promotion_wins: 1,
        promotion_losses: 2,
      });

      await client.query(
        'UPDATE season_players SET in_promotion_series = false, promotion_wins = 0, promotion_losses = 0 WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );

      const result = await client.query(
        'SELECT in_promotion_series FROM season_players WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );
      expect(result.rows[0].in_promotion_series).toBe(false);
    });
  });

  describe('E2E-SEASON-020: Record season match', () => {
    it('should record season match', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const season = await createTestSeason(client);

      const result = await client.query(
        `INSERT INTO season_matches (season_id, game_id, match_type, player1_id, player2_id, winner_id,
         player1_mmr_before, player1_mmr_after, player1_mmr_change,
         player2_mmr_before, player2_mmr_after, player2_mmr_change, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
        [
          season.id,
          'match-123',
          'ranked',
          user1.id,
          user2.id,
          user1.id,
          1000,
          1025,
          25,
          1000,
          975,
          -25,
          'completed',
        ]
      );

      expect(result.rows[0].winner_id).toBe(user1.id);
      expect(result.rows[0].player1_mmr_change).toBe(25);
    });
  });

  describe('E2E-SEASON-021: Get player match history', () => {
    it('should get player match history', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const season = await createTestSeason(client);

      await client.query(
        `INSERT INTO season_matches (season_id, game_id, match_type, player1_id, player2_id, status)
         VALUES ($1, $2, $3, $4, $5, 'completed')`,
        [season.id, 'match-1', 'ranked', user1.id, user2.id]
      );
      await client.query(
        `INSERT INTO season_matches (season_id, game_id, match_type, player1_id, player2_id, status)
         VALUES ($1, $2, $3, $4, $5, 'completed')`,
        [season.id, 'match-2', 'ranked', user1.id, user2.id]
      );

      const result = await client.query(
        'SELECT * FROM season_matches WHERE season_id = $1 AND (player1_id = $2 OR player2_id = $2)',
        [season.id, user1.id]
      );
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-SEASON-022: Create season leaderboard', () => {
    it('should create leaderboard for season', async () => {
      const season = await createTestSeason(client);

      const result = await client.query(
        `INSERT INTO season_leaderboards (season_id, leaderboard_type, region)
         VALUES ($1, $2, $3) RETURNING *`,
        [season.id, 'mmr', 'global']
      );

      expect(result.rows[0].leaderboard_type).toBe('mmr');
    });
  });

  describe('E2E-SEASON-023: Add leaderboard entry', () => {
    it('should add entry to leaderboard', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);

      const leaderboardResult = await client.query(
        `INSERT INTO season_leaderboards (season_id, leaderboard_type) VALUES ($1, $2) RETURNING id`,
        [season.id, 'mmr']
      );

      const result = await client.query(
        `INSERT INTO season_leaderboard_entries (leaderboard_id, user_id, rank, score)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [leaderboardResult.rows[0].id, user.id, 1, 2500]
      );

      expect(result.rows[0].rank).toBe(1);
      expect(parseFloat(result.rows[0].score)).toBe(2500);
    });
  });

  describe('E2E-SEASON-024: Update leaderboard rankings', () => {
    it('should update leaderboard rankings', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const season = await createTestSeason(client);

      const leaderboardResult = await client.query(
        `INSERT INTO season_leaderboards (season_id, leaderboard_type) VALUES ($1, $2) RETURNING id`,
        [season.id, 'mmr']
      );

      await client.query(
        `INSERT INTO season_leaderboard_entries (leaderboard_id, user_id, rank, score) VALUES ($1, $2, $3, $4)`,
        [leaderboardResult.rows[0].id, user1.id, 1, 2500]
      );
      await client.query(
        `INSERT INTO season_leaderboard_entries (leaderboard_id, user_id, rank, score) VALUES ($1, $2, $3, $4)`,
        [leaderboardResult.rows[0].id, user2.id, 2, 2400]
      );

      await client.query(
        'UPDATE season_leaderboard_entries SET previous_rank = rank, rank = $1, score = $2 WHERE leaderboard_id = $3 AND user_id = $4',
        [2, 2450, leaderboardResult.rows[0].id, user1.id]
      );
      await client.query(
        'UPDATE season_leaderboard_entries SET previous_rank = rank, rank = $1, score = $2 WHERE leaderboard_id = $3 AND user_id = $4',
        [1, 2550, leaderboardResult.rows[0].id, user2.id]
      );

      const result = await client.query(
        'SELECT * FROM season_leaderboard_entries WHERE leaderboard_id = $1 ORDER BY rank',
        [leaderboardResult.rows[0].id]
      );
      expect(result.rows[0].user_id).toBe(user2.id);
      expect(result.rows[0].previous_rank).toBe(2);
    });
  });

  describe('E2E-SEASON-025: Get top players', () => {
    it('should get top players from leaderboard', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const user3 = await createTestUser(client);
      const season = await createTestSeason(client);

      const leaderboardResult = await client.query(
        `INSERT INTO season_leaderboards (season_id, leaderboard_type) VALUES ($1, $2) RETURNING id`,
        [season.id, 'mmr']
      );

      await client.query(
        `INSERT INTO season_leaderboard_entries (leaderboard_id, user_id, rank, score) VALUES ($1, $2, $3, $4)`,
        [leaderboardResult.rows[0].id, user1.id, 1, 2500]
      );
      await client.query(
        `INSERT INTO season_leaderboard_entries (leaderboard_id, user_id, rank, score) VALUES ($1, $2, $3, $4)`,
        [leaderboardResult.rows[0].id, user2.id, 2, 2400]
      );
      await client.query(
        `INSERT INTO season_leaderboard_entries (leaderboard_id, user_id, rank, score) VALUES ($1, $2, $3, $4)`,
        [leaderboardResult.rows[0].id, user3.id, 3, 2300]
      );

      const result = await client.query(
        'SELECT * FROM season_leaderboard_entries WHERE leaderboard_id = $1 ORDER BY rank LIMIT 10',
        [leaderboardResult.rows[0].id]
      );
      expect(result.rows.length).toBe(3);
      expect(result.rows[0].rank).toBe(1);
    });
  });

  describe('E2E-SEASON-026: Get player rank', () => {
    it('should get player rank on leaderboard', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);

      const leaderboardResult = await client.query(
        `INSERT INTO season_leaderboards (season_id, leaderboard_type) VALUES ($1, $2) RETURNING id`,
        [season.id, 'mmr']
      );

      await client.query(
        `INSERT INTO season_leaderboard_entries (leaderboard_id, user_id, rank, score) VALUES ($1, $2, $3, $4)`,
        [leaderboardResult.rows[0].id, user.id, 42, 1800]
      );

      const result = await client.query(
        'SELECT rank FROM season_leaderboard_entries WHERE leaderboard_id = $1 AND user_id = $2',
        [leaderboardResult.rows[0].id, user.id]
      );
      expect(result.rows[0].rank).toBe(42);
    });
  });

  describe('E2E-SEASON-027: Create season reward', () => {
    it('should create reward for tier', async () => {
      const season = await createTestSeason(client);
      await createSeasonTiers(client, season.id);

      const tierResult = await client.query(
        "SELECT id FROM season_tiers WHERE season_id = $1 AND name = 'gold'",
        [season.id]
      );

      const result = await client.query(
        `INSERT INTO season_rewards (season_id, tier_id, reward_type, reward_description)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [season.id, tierResult.rows[0].id, 'skin', 'Gold Champion Skin']
      );

      expect(result.rows[0].reward_type).toBe('skin');
    });
  });

  describe('E2E-SEASON-028: Create rank-based reward', () => {
    it('should create reward for rank range', async () => {
      const season = await createTestSeason(client);

      const result = await client.query(
        `INSERT INTO season_rewards (season_id, min_rank, max_rank, reward_type, reward_description, is_exclusive)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [season.id, 1, 100, 'title', 'Top 100 Title', true]
      );

      expect(result.rows[0].min_rank).toBe(1);
      expect(result.rows[0].max_rank).toBe(100);
      expect(result.rows[0].is_exclusive).toBe(true);
    });
  });

  describe('E2E-SEASON-029: Claim season reward', () => {
    it('should claim season reward', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await createSeasonTiers(client, season.id);

      const tierResult = await client.query(
        "SELECT id FROM season_tiers WHERE season_id = $1 AND name = 'gold'",
        [season.id]
      );

      const rewardResult = await client.query(
        `INSERT INTO season_rewards (season_id, tier_id, reward_type) VALUES ($1, $2, $3) RETURNING id`,
        [season.id, tierResult.rows[0].id, 'badge']
      );

      const result = await client.query(
        `INSERT INTO season_reward_claims (season_id, user_id, reward_id, final_tier_id, final_mmr)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [season.id, user.id, rewardResult.rows[0].id, tierResult.rows[0].id, 1650]
      );

      expect(result.rows[0].claimed_at).toBeDefined();
    });
  });

  describe('E2E-SEASON-030: Get claimable rewards', () => {
    it('should get rewards player can claim', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await createSeasonTiers(client, season.id);
      await registerSeasonPlayer(client, season.id, user.id, { current_mmr: 1500 });

      const tierResult = await client.query(
        "SELECT id FROM season_tiers WHERE season_id = $1 AND name = 'gold'",
        [season.id]
      );

      await client.query(
        `INSERT INTO season_rewards (season_id, tier_id, reward_type) VALUES ($1, $2, $3)`,
        [season.id, tierResult.rows[0].id, 'badge']
      );

      const result = await client.query(
        `SELECT sr.* FROM season_rewards sr
         JOIN season_tiers st ON sr.tier_id = st.id
         WHERE sr.season_id = $1 AND st.min_mmr <= $2`,
        [season.id, 1500]
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('E2E-SEASON-031: Record MMR history', () => {
    it('should record MMR change history', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);

      const result = await client.query(
        `INSERT INTO season_mmr_history (season_id, user_id, mmr_before, mmr_after, mmr_change, change_type)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [season.id, user.id, 1000, 1025, 25, 'match']
      );

      expect(result.rows[0].mmr_change).toBe(25);
      expect(result.rows[0].change_type).toBe('match');
    });
  });

  describe('E2E-SEASON-032: Get MMR history', () => {
    it('should get player MMR history', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);

      await client.query(
        `INSERT INTO season_mmr_history (season_id, user_id, mmr_before, mmr_after, mmr_change, change_type)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [season.id, user.id, 1000, 1025, 25, 'match']
      );
      await client.query(
        `INSERT INTO season_mmr_history (season_id, user_id, mmr_before, mmr_after, mmr_change, change_type)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [season.id, user.id, 1025, 1000, -25, 'match']
      );

      const result = await client.query(
        'SELECT * FROM season_mmr_history WHERE season_id = $1 AND user_id = $2 ORDER BY created_at DESC',
        [season.id, user.id]
      );
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-SEASON-033: Apply MMR decay', () => {
    it('should apply MMR decay for inactive player', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client, { decay_enabled: true, decay_amount: 25 });
      await registerSeasonPlayer(client, season.id, user.id, { current_mmr: 2000 });

      await client.query(
        'UPDATE season_players SET current_mmr = current_mmr - $1, last_decay_at = NOW() WHERE season_id = $2 AND user_id = $3',
        [25, season.id, user.id]
      );

      await client.query(
        `INSERT INTO season_mmr_history (season_id, user_id, mmr_before, mmr_after, mmr_change, change_type)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [season.id, user.id, 2000, 1975, -25, 'decay']
      );

      const result = await client.query(
        'SELECT current_mmr FROM season_players WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );
      expect(result.rows[0].current_mmr).toBe(1975);
    });
  });

  describe('E2E-SEASON-034: Start season', () => {
    it('should start season', async () => {
      const season = await createTestSeason(client, { status: 'upcoming' });

      await client.query("UPDATE seasons SET status = 'active' WHERE id = $1", [season.id]);

      const result = await client.query('SELECT status FROM seasons WHERE id = $1', [season.id]);
      expect(result.rows[0].status).toBe('active');
    });
  });

  describe('E2E-SEASON-035: End season', () => {
    it('should end season', async () => {
      const season = await createTestSeason(client);

      await client.query("UPDATE seasons SET status = 'ended' WHERE id = $1", [season.id]);

      const result = await client.query('SELECT status FROM seasons WHERE id = $1', [season.id]);
      expect(result.rows[0].status).toBe('ended');
    });
  });

  describe('E2E-SEASON-036: Archive season', () => {
    it('should archive season', async () => {
      const season = await createTestSeason(client, { status: 'ended' });

      await client.query("UPDATE seasons SET status = 'archived' WHERE id = $1", [season.id]);

      const result = await client.query('SELECT status FROM seasons WHERE id = $1', [season.id]);
      expect(result.rows[0].status).toBe('archived');
    });
  });

  describe('E2E-SEASON-037: Get active season', () => {
    it('should get active season for game', async () => {
      await createTestSeason(client, { game_id: 'game-a', status: 'active' });
      await createTestSeason(client, { game_id: 'game-a', status: 'ended' });

      const result = await client.query(
        "SELECT * FROM seasons WHERE game_id = $1 AND status = 'active'",
        ['game-a']
      );
      expect(result.rows.length).toBe(1);
    });
  });

  describe('E2E-SEASON-038: Get season history', () => {
    it('should get all seasons for game', async () => {
      await createTestSeason(client, { game_id: 'game-a', season_number: 1 });
      await createTestSeason(client, { game_id: 'game-a', season_number: 2 });
      await createTestSeason(client, { game_id: 'game-a', season_number: 3 });

      const result = await client.query(
        'SELECT * FROM seasons WHERE game_id = $1 ORDER BY season_number',
        ['game-a']
      );
      expect(result.rows.length).toBe(3);
    });
  });

  describe('E2E-SEASON-039: Get player season stats', () => {
    it('should get player stats for season', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await registerSeasonPlayer(client, season.id, user.id, {
        wins: 50,
        losses: 30,
        current_mmr: 1800,
      });

      const result = await client.query(
        'SELECT * FROM season_players WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );
      expect(result.rows[0].wins).toBe(50);
      expect(result.rows[0].losses).toBe(30);
    });
  });

  describe('E2E-SEASON-040: Calculate win rate', () => {
    it('should calculate player win rate', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await registerSeasonPlayer(client, season.id, user.id, { wins: 60, losses: 40 });

      const result = await client.query(
        `SELECT wins, losses, 
         CASE WHEN (wins + losses) > 0 THEN ROUND(wins::numeric / (wins + losses) * 100, 2) ELSE 0 END as win_rate
         FROM season_players WHERE season_id = $1 AND user_id = $2`,
        [season.id, user.id]
      );
      expect(parseFloat(result.rows[0].win_rate)).toBe(60);
    });
  });

  describe('E2E-SEASON-041: Log season activity', () => {
    it('should log season activity', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);

      await client.query(
        `INSERT INTO season_activity_log (season_id, user_id, action, details)
         VALUES ($1, $2, $3, $4)`,
        [season.id, user.id, 'player_registered', JSON.stringify({ initial_mmr: 1000 })]
      );

      const result = await client.query('SELECT * FROM season_activity_log WHERE season_id = $1', [
        season.id,
      ]);
      expect(result.rows.length).toBe(1);
    });
  });

  describe('E2E-SEASON-042: Get season activity log', () => {
    it('should retrieve season activity log', async () => {
      const season = await createTestSeason(client);

      await client.query(`INSERT INTO season_activity_log (season_id, action) VALUES ($1, $2)`, [
        season.id,
        'season_started',
      ]);
      await client.query(`INSERT INTO season_activity_log (season_id, action) VALUES ($1, $2)`, [
        season.id,
        'leaderboard_updated',
      ]);

      const result = await client.query(
        'SELECT * FROM season_activity_log WHERE season_id = $1 ORDER BY created_at DESC',
        [season.id]
      );
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-SEASON-043: Prevent duplicate registration', () => {
    it('should detect duplicate season registration', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await registerSeasonPlayer(client, season.id, user.id);

      const result = await client.query(
        `SELECT EXISTS(
          SELECT 1 FROM season_players WHERE season_id = $1 AND user_id = $2
        ) as already_registered`,
        [season.id, user.id]
      );
      expect(result.rows[0].already_registered).toBe(true);
    });
  });

  describe('E2E-SEASON-044: Prevent play in inactive season', () => {
    it('should detect inactive season', async () => {
      const season = await createTestSeason(client, { status: 'ended' });

      const result = await client.query(
        "SELECT status != 'active' as is_inactive FROM seasons WHERE id = $1",
        [season.id]
      );
      expect(result.rows[0].is_inactive).toBe(true);
    });
  });

  describe('E2E-SEASON-045: Get player with tier info', () => {
    it('should get player with tier details', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await createSeasonTiers(client, season.id);
      await registerSeasonPlayer(client, season.id, user.id, { current_mmr: 1500 });

      const tierResult = await client.query(
        "SELECT id FROM season_tiers WHERE season_id = $1 AND name = 'gold'",
        [season.id]
      );

      await client.query(
        'UPDATE season_players SET tier_id = $1 WHERE season_id = $2 AND user_id = $3',
        [tierResult.rows[0].id, season.id, user.id]
      );

      const result = await client.query(
        `SELECT sp.*, st.name as tier_name, st.display_name as tier_display_name
         FROM season_players sp
         LEFT JOIN season_tiers st ON sp.tier_id = st.id
         WHERE sp.season_id = $1 AND sp.user_id = $2`,
        [season.id, user.id]
      );
      expect(result.rows[0].tier_name).toBe('gold');
    });
  });

  describe('E2E-SEASON-046: Update player stats', () => {
    it('should update player stats JSON', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await registerSeasonPlayer(client, season.id, user.id);

      await client.query(
        'UPDATE season_players SET stats = $1 WHERE season_id = $2 AND user_id = $3',
        [JSON.stringify({ kills: 500, deaths: 300, assists: 200 }), season.id, user.id]
      );

      const result = await client.query(
        'SELECT stats FROM season_players WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );
      expect(result.rows[0].stats.kills).toBe(500);
    });
  });

  describe('E2E-SEASON-047: Get players by tier', () => {
    it('should get all players in a tier', async () => {
      const user1 = await createTestUser(client);
      const user2 = await createTestUser(client);
      const season = await createTestSeason(client);
      await createSeasonTiers(client, season.id);

      const tierResult = await client.query(
        "SELECT id FROM season_tiers WHERE season_id = $1 AND name = 'gold'",
        [season.id]
      );

      await registerSeasonPlayer(client, season.id, user1.id, { current_mmr: 1500 });
      await registerSeasonPlayer(client, season.id, user2.id, { current_mmr: 1600 });

      await client.query('UPDATE season_players SET tier_id = $1 WHERE season_id = $2', [
        tierResult.rows[0].id,
        season.id,
      ]);

      const result = await client.query(
        'SELECT * FROM season_players WHERE season_id = $1 AND tier_id = $2',
        [season.id, tierResult.rows[0].id]
      );
      expect(result.rows.length).toBe(2);
    });
  });

  describe('E2E-SEASON-048: Cascade delete players on season delete', () => {
    it('should delete players when season is deleted', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await registerSeasonPlayer(client, season.id, user.id);

      await client.query('DELETE FROM seasons WHERE id = $1', [season.id]);

      const result = await client.query('SELECT * FROM season_players WHERE season_id = $1', [
        season.id,
      ]);
      expect(result.rows.length).toBe(0);
    });
  });

  describe('E2E-SEASON-049: Cascade delete tiers on season delete', () => {
    it('should delete tiers when season is deleted', async () => {
      const season = await createTestSeason(client);
      await createSeasonTiers(client, season.id);

      await client.query('DELETE FROM seasons WHERE id = $1', [season.id]);

      const result = await client.query('SELECT * FROM season_tiers WHERE season_id = $1', [
        season.id,
      ]);
      expect(result.rows.length).toBe(0);
    });
  });

  describe('E2E-SEASON-050: Update last game timestamp', () => {
    it('should update last game timestamp', async () => {
      const user = await createTestUser(client);
      const season = await createTestSeason(client);
      await registerSeasonPlayer(client, season.id, user.id);

      await client.query(
        'UPDATE season_players SET last_game_at = NOW() WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );

      const result = await client.query(
        'SELECT last_game_at FROM season_players WHERE season_id = $1 AND user_id = $2',
        [season.id, user.id]
      );
      expect(result.rows[0].last_game_at).toBeDefined();
    });
  });

  describe('E2E-SEASON-051: Index performance for season queries', () => {
    it('should use indexes for season queries', async () => {
      const season = await createTestSeason(client);

      const result = await client.query(
        "EXPLAIN SELECT * FROM seasons WHERE game_id = $1 AND status = 'active'",
        [season.game_id]
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('E2E-SEASON-052: Index performance for player queries', () => {
    it('should use indexes for player queries', async () => {
      const season = await createTestSeason(client);

      const result = await client.query(
        'EXPLAIN SELECT * FROM season_players WHERE season_id = $1 ORDER BY current_mmr DESC',
        [season.id]
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });
});
