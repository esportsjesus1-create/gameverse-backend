import { v4 as uuidv4 } from 'uuid';
import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';
import {
  User,
  Party,
  PartyMember,
  PartyInvite,
  Tournament,
  TournamentParticipant,
  Season,
  SeasonPlayer,
  Friendship,
  DirectMessage,
} from '../../../shared/types';

export interface TestContext {
  pool: Pool;
  redis: Redis;
  users: User[];
  parties: Party[];
  tournaments: Tournament[];
  seasons: Season[];
}

export async function createTestUser(
  client: PoolClient,
  overrides: Partial<User> = {}
): Promise<User> {
  const id = overrides.id || uuidv4();
  const username = overrides.username || `user_${id.substring(0, 8)}`;
  const email = overrides.email || `${username}@test.gameverse.com`;
  const displayName = overrides.display_name || `Test User ${id.substring(0, 8)}`;

  const result = await client.query(
    `INSERT INTO users (id, username, email, display_name, status, level, experience_points, premium_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      id,
      username,
      email,
      displayName,
      overrides.status || 'online',
      overrides.level || 1,
      overrides.experience_points || 0,
      overrides.premium_status || 'free',
    ]
  );

  return result.rows[0];
}

export async function createTestParty(
  client: PoolClient,
  leaderId: string,
  overrides: Partial<Party> = {}
): Promise<Party> {
  const id = overrides.id || uuidv4();

  const result = await client.query(
    `INSERT INTO parties (id, name, leader_id, max_size, current_size, is_private, status, game_mode, region)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      id,
      overrides.name || `Test Party ${id.substring(0, 8)}`,
      leaderId,
      overrides.max_size || 4,
      overrides.current_size || 1,
      overrides.is_private || false,
      overrides.status || 'active',
      overrides.game_mode || 'casual',
      overrides.region || 'auto',
    ]
  );

  await client.query(
    `INSERT INTO party_members (party_id, user_id, role, is_ready)
     VALUES ($1, $2, 'leader', false)`,
    [id, leaderId]
  );

  return result.rows[0];
}

export async function addPartyMember(
  client: PoolClient,
  partyId: string,
  userId: string,
  role: 'member' | 'co-leader' = 'member'
): Promise<PartyMember> {
  const result = await client.query(
    `INSERT INTO party_members (party_id, user_id, role, is_ready)
     VALUES ($1, $2, $3, false)
     RETURNING *`,
    [partyId, userId, role]
  );

  await client.query(`UPDATE parties SET current_size = current_size + 1 WHERE id = $1`, [partyId]);

  return result.rows[0];
}

export async function createPartyInvite(
  client: PoolClient,
  partyId: string,
  senderId: string,
  recipientId: string,
  overrides: Partial<PartyInvite> = {}
): Promise<PartyInvite> {
  const expiresAt = overrides.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000);

  const result = await client.query(
    `INSERT INTO party_invites (party_id, sender_id, recipient_id, status, message, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      partyId,
      senderId,
      recipientId,
      overrides.status || 'pending',
      overrides.message || null,
      expiresAt,
    ]
  );

  return result.rows[0];
}

export async function createTestTournament(
  client: PoolClient,
  organizerId: string,
  overrides: Partial<Tournament> = {}
): Promise<Tournament> {
  const id = overrides.id || uuidv4();
  const startAt = overrides.start_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const result = await client.query(
    `INSERT INTO tournaments (id, name, description, game_id, game_mode, organizer_id, type, format, 
     team_size, min_participants, max_participants, entry_fee, prize_pool, status, visibility, start_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING *`,
    [
      id,
      overrides.name || `Test Tournament ${id.substring(0, 8)}`,
      overrides.description || 'Test tournament description',
      overrides.game_id || 'test-game',
      overrides.game_mode || 'ranked',
      organizerId,
      overrides.type || 'single_elimination',
      overrides.format || 'solo',
      overrides.team_size || 1,
      overrides.min_participants || 2,
      overrides.max_participants || 16,
      overrides.entry_fee || 0,
      overrides.prize_pool || 0,
      overrides.status || 'registration_open',
      overrides.visibility || 'public',
      startAt,
    ]
  );

  return result.rows[0];
}

export async function registerTournamentParticipant(
  client: PoolClient,
  tournamentId: string,
  userId: string,
  overrides: Partial<TournamentParticipant> = {}
): Promise<TournamentParticipant> {
  const result = await client.query(
    `INSERT INTO tournament_participants (tournament_id, user_id, status, seed)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [tournamentId, userId, overrides.status || 'registered', overrides.seed || null]
  );

  await client.query(
    `UPDATE tournaments SET current_participants = current_participants + 1 WHERE id = $1`,
    [tournamentId]
  );

  return result.rows[0];
}

export async function createTestSeason(
  client: PoolClient,
  overrides: Partial<Season> = {}
): Promise<Season> {
  const id = overrides.id || uuidv4();
  const startAt = overrides.start_at || new Date();
  const endAt = overrides.end_at || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const result = await client.query(
    `INSERT INTO seasons (id, name, description, game_id, season_number, type, status, 
     tier_system, initial_mmr, mmr_k_factor, placement_matches, decay_enabled, start_at, end_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      id,
      overrides.name || `Test Season ${id.substring(0, 8)}`,
      overrides.description || 'Test season description',
      overrides.game_id || 'test-game',
      overrides.season_number || 1,
      overrides.type || 'ranked',
      overrides.status || 'active',
      overrides.tier_system || 'standard',
      overrides.initial_mmr || 1000,
      overrides.mmr_k_factor || 32,
      overrides.placement_matches || 10,
      overrides.decay_enabled || false,
      startAt,
      endAt,
    ]
  );

  return result.rows[0];
}

export async function createSeasonTiers(client: PoolClient, seasonId: string): Promise<void> {
  const tiers = [
    { name: 'bronze', display_name: 'Bronze', tier_order: 1, min_mmr: 0, max_mmr: 1199 },
    { name: 'silver', display_name: 'Silver', tier_order: 2, min_mmr: 1200, max_mmr: 1499 },
    { name: 'gold', display_name: 'Gold', tier_order: 3, min_mmr: 1500, max_mmr: 1799 },
    { name: 'platinum', display_name: 'Platinum', tier_order: 4, min_mmr: 1800, max_mmr: 2099 },
    { name: 'diamond', display_name: 'Diamond', tier_order: 5, min_mmr: 2100, max_mmr: 2399 },
    { name: 'master', display_name: 'Master', tier_order: 6, min_mmr: 2400, max_mmr: 2699 },
    {
      name: 'grandmaster',
      display_name: 'Grandmaster',
      tier_order: 7,
      min_mmr: 2700,
      max_mmr: null,
    },
  ];

  for (const tier of tiers) {
    await client.query(
      `INSERT INTO season_tiers (season_id, name, display_name, tier_order, min_mmr, max_mmr)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [seasonId, tier.name, tier.display_name, tier.tier_order, tier.min_mmr, tier.max_mmr]
    );
  }
}

export async function registerSeasonPlayer(
  client: PoolClient,
  seasonId: string,
  userId: string,
  overrides: Partial<SeasonPlayer> = {}
): Promise<SeasonPlayer> {
  const result = await client.query(
    `INSERT INTO season_players (season_id, user_id, current_mmr, peak_mmr, wins, losses, 
     placement_games_played, placement_completed, win_streak, best_win_streak,
     in_promotion_series, promotion_wins, promotion_losses)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      seasonId,
      userId,
      overrides.current_mmr ?? 1000,
      overrides.peak_mmr ?? overrides.current_mmr ?? 1000,
      overrides.wins ?? 0,
      overrides.losses ?? 0,
      overrides.placement_games_played ?? 0,
      overrides.placement_completed ?? false,
      overrides.win_streak ?? 0,
      overrides.best_win_streak ?? 0,
      overrides.in_promotion_series ?? false,
      overrides.promotion_wins ?? 0,
      overrides.promotion_losses ?? 0,
    ]
  );

  return result.rows[0];
}

export async function createFriendship(
  client: PoolClient,
  userId: string,
  friendId: string,
  status: 'pending' | 'accepted' | 'blocked' = 'accepted'
): Promise<Friendship> {
  const result = await client.query(
    `INSERT INTO friendships (user_id, friend_id, status, accepted_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, friendId, status, status === 'accepted' ? new Date() : null]
  );

  return result.rows[0];
}

export async function createDirectMessage(
  client: PoolClient,
  senderId: string,
  recipientId: string,
  content: string,
  overrides: Partial<DirectMessage> = {}
): Promise<DirectMessage> {
  const result = await client.query(
    `INSERT INTO direct_messages (sender_id, recipient_id, content, content_type, is_read)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [senderId, recipientId, content, overrides.content_type || 'text', overrides.is_read || false]
  );

  return result.rows[0];
}

export async function cleanupTestData(client: PoolClient): Promise<void> {
  const tables = [
    'season_activity_log',
    'season_mmr_history',
    'season_reward_claims',
    'season_rewards',
    'season_leaderboard_entries',
    'season_leaderboards',
    'season_matches',
    'season_players',
    'season_tiers',
    'seasons',
    'tournament_activity_log',
    'tournament_prizes',
    'tournament_brackets',
    'tournament_matches',
    'tournament_rounds',
    'tournament_team_members',
    'tournament_teams',
    'tournament_participants',
    'tournaments',
    'user_activity',
    'reports',
    'user_settings',
    'user_presence',
    'message_reactions',
    'direct_messages',
    'blocked_users',
    'friend_requests',
    'friendships',
    'party_activity_log',
    'party_benefits',
    'voice_participants',
    'voice_channels',
    'party_invites',
    'party_members',
    'parties',
    'users',
  ];

  for (const table of tables) {
    await client.query(`TRUNCATE TABLE ${table} CASCADE`).catch(() => {});
  }
}

export function generateTestId(): string {
  return uuidv4();
}

export function generateTestUsername(): string {
  return `test_user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

export function generateTestEmail(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substring(7)}@test.gameverse.com`;
}

export async function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function expectToBeWithinRange(value: number, min: number, max: number): void {
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
}

export function expectDateToBeRecent(date: Date, maxAgeMs = 5000): void {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  expect(diff).toBeLessThan(maxAgeMs);
  expect(diff).toBeGreaterThanOrEqual(0);
}
