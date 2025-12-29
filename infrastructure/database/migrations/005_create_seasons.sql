-- Migration: 005_create_seasons
-- Description: Create season-related tables with proper indexing
-- Created: 2024-01-01

-- UP
CREATE TABLE IF NOT EXISTS seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    game_id VARCHAR(100) NOT NULL,
    season_number INTEGER NOT NULL,
    type VARCHAR(30) DEFAULT 'ranked' CHECK (type IN ('ranked', 'casual', 'event', 'battle_pass')),
    status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'ended', 'archived')),
    tier_system VARCHAR(30) DEFAULT 'standard' CHECK (tier_system IN ('standard', 'elo', 'glicko', 'custom')),
    initial_mmr INTEGER DEFAULT 1000,
    mmr_k_factor INTEGER DEFAULT 32,
    placement_matches INTEGER DEFAULT 10,
    decay_enabled BOOLEAN DEFAULT false,
    decay_days INTEGER DEFAULT 14,
    decay_amount INTEGER DEFAULT 25,
    max_decay_tier VARCHAR(30),
    rewards_enabled BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS season_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    tier_order INTEGER NOT NULL,
    division_count INTEGER DEFAULT 4,
    min_mmr INTEGER NOT NULL,
    max_mmr INTEGER,
    icon_url TEXT,
    color VARCHAR(20),
    promotion_series BOOLEAN DEFAULT false,
    promotion_wins_required INTEGER DEFAULT 3,
    promotion_games INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(season_id, tier_order)
);

CREATE TABLE IF NOT EXISTS season_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_mmr INTEGER NOT NULL,
    peak_mmr INTEGER NOT NULL,
    tier_id UUID REFERENCES season_tiers(id) ON DELETE SET NULL,
    division INTEGER DEFAULT 4,
    league_points INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    win_streak INTEGER DEFAULT 0,
    best_win_streak INTEGER DEFAULT 0,
    placement_games_played INTEGER DEFAULT 0,
    placement_completed BOOLEAN DEFAULT false,
    in_promotion_series BOOLEAN DEFAULT false,
    promotion_wins INTEGER DEFAULT 0,
    promotion_losses INTEGER DEFAULT 0,
    last_game_at TIMESTAMP WITH TIME ZONE,
    last_decay_at TIMESTAMP WITH TIME ZONE,
    stats JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(season_id, user_id)
);

CREATE TABLE IF NOT EXISTS season_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    game_id VARCHAR(100) NOT NULL,
    match_type VARCHAR(30) DEFAULT 'ranked' CHECK (match_type IN ('ranked', 'placement', 'promotion', 'casual')),
    player1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player2_id UUID REFERENCES users(id) ON DELETE CASCADE,
    team1_ids UUID[],
    team2_ids UUID[],
    winner_id UUID,
    player1_mmr_before INTEGER,
    player1_mmr_after INTEGER,
    player1_mmr_change INTEGER,
    player2_mmr_before INTEGER,
    player2_mmr_after INTEGER,
    player2_mmr_change INTEGER,
    duration_seconds INTEGER,
    game_data JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'cancelled', 'abandoned')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS season_leaderboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    leaderboard_type VARCHAR(30) DEFAULT 'mmr' CHECK (leaderboard_type IN ('mmr', 'wins', 'win_rate', 'games_played', 'custom')),
    region VARCHAR(20) DEFAULT 'global',
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(season_id, leaderboard_type, region)
);

CREATE TABLE IF NOT EXISTS season_leaderboard_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leaderboard_id UUID NOT NULL REFERENCES season_leaderboards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    previous_rank INTEGER,
    score DECIMAL(18, 4) NOT NULL,
    tier_id UUID REFERENCES season_tiers(id) ON DELETE SET NULL,
    stats JSONB DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(leaderboard_id, user_id)
);

CREATE TABLE IF NOT EXISTS season_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    tier_id UUID REFERENCES season_tiers(id) ON DELETE SET NULL,
    min_rank INTEGER,
    max_rank INTEGER,
    reward_type VARCHAR(30) NOT NULL CHECK (reward_type IN ('currency', 'item', 'badge', 'title', 'skin', 'emote', 'border', 'custom')),
    reward_value DECIMAL(18, 8),
    reward_currency VARCHAR(10),
    reward_item_id VARCHAR(100),
    reward_description TEXT,
    reward_icon_url TEXT,
    is_exclusive BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS season_reward_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES season_rewards(id) ON DELETE CASCADE,
    final_tier_id UUID REFERENCES season_tiers(id) ON DELETE SET NULL,
    final_rank INTEGER,
    final_mmr INTEGER,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(season_id, user_id, reward_id)
);

CREATE TABLE IF NOT EXISTS season_mmr_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id UUID REFERENCES season_matches(id) ON DELETE SET NULL,
    mmr_before INTEGER NOT NULL,
    mmr_after INTEGER NOT NULL,
    mmr_change INTEGER NOT NULL,
    change_type VARCHAR(30) NOT NULL CHECK (change_type IN ('match', 'placement', 'promotion', 'decay', 'adjustment')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS season_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seasons_game_id ON seasons(game_id);
CREATE INDEX IF NOT EXISTS idx_seasons_status ON seasons(status);
CREATE INDEX IF NOT EXISTS idx_seasons_start_at ON seasons(start_at);
CREATE INDEX IF NOT EXISTS idx_seasons_end_at ON seasons(end_at);
CREATE INDEX IF NOT EXISTS idx_season_tiers_season_id ON season_tiers(season_id);
CREATE INDEX IF NOT EXISTS idx_season_players_season_id ON season_players(season_id);
CREATE INDEX IF NOT EXISTS idx_season_players_user_id ON season_players(user_id);
CREATE INDEX IF NOT EXISTS idx_season_players_current_mmr ON season_players(current_mmr DESC);
CREATE INDEX IF NOT EXISTS idx_season_players_tier_id ON season_players(tier_id);
CREATE INDEX IF NOT EXISTS idx_season_matches_season_id ON season_matches(season_id);
CREATE INDEX IF NOT EXISTS idx_season_matches_player1_id ON season_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_season_matches_player2_id ON season_matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_season_matches_completed_at ON season_matches(completed_at);
CREATE INDEX IF NOT EXISTS idx_season_leaderboards_season_id ON season_leaderboards(season_id);
CREATE INDEX IF NOT EXISTS idx_season_leaderboard_entries_leaderboard_id ON season_leaderboard_entries(leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_season_leaderboard_entries_rank ON season_leaderboard_entries(rank);
CREATE INDEX IF NOT EXISTS idx_season_rewards_season_id ON season_rewards(season_id);
CREATE INDEX IF NOT EXISTS idx_season_rewards_tier_id ON season_rewards(tier_id);
CREATE INDEX IF NOT EXISTS idx_season_reward_claims_season_id ON season_reward_claims(season_id);
CREATE INDEX IF NOT EXISTS idx_season_reward_claims_user_id ON season_reward_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_season_mmr_history_season_id ON season_mmr_history(season_id);
CREATE INDEX IF NOT EXISTS idx_season_mmr_history_user_id ON season_mmr_history(user_id);
CREATE INDEX IF NOT EXISTS idx_season_mmr_history_created_at ON season_mmr_history(created_at);
CREATE INDEX IF NOT EXISTS idx_season_activity_log_season_id ON season_activity_log(season_id);
CREATE INDEX IF NOT EXISTS idx_season_activity_log_created_at ON season_activity_log(created_at);

-- DOWN
DROP INDEX IF EXISTS idx_season_activity_log_created_at;
DROP INDEX IF EXISTS idx_season_activity_log_season_id;
DROP INDEX IF EXISTS idx_season_mmr_history_created_at;
DROP INDEX IF EXISTS idx_season_mmr_history_user_id;
DROP INDEX IF EXISTS idx_season_mmr_history_season_id;
DROP INDEX IF EXISTS idx_season_reward_claims_user_id;
DROP INDEX IF EXISTS idx_season_reward_claims_season_id;
DROP INDEX IF EXISTS idx_season_rewards_tier_id;
DROP INDEX IF EXISTS idx_season_rewards_season_id;
DROP INDEX IF EXISTS idx_season_leaderboard_entries_rank;
DROP INDEX IF EXISTS idx_season_leaderboard_entries_leaderboard_id;
DROP INDEX IF EXISTS idx_season_leaderboards_season_id;
DROP INDEX IF EXISTS idx_season_matches_completed_at;
DROP INDEX IF EXISTS idx_season_matches_player2_id;
DROP INDEX IF EXISTS idx_season_matches_player1_id;
DROP INDEX IF EXISTS idx_season_matches_season_id;
DROP INDEX IF EXISTS idx_season_players_tier_id;
DROP INDEX IF EXISTS idx_season_players_current_mmr;
DROP INDEX IF EXISTS idx_season_players_user_id;
DROP INDEX IF EXISTS idx_season_players_season_id;
DROP INDEX IF EXISTS idx_season_tiers_season_id;
DROP INDEX IF EXISTS idx_seasons_end_at;
DROP INDEX IF EXISTS idx_seasons_start_at;
DROP INDEX IF EXISTS idx_seasons_status;
DROP INDEX IF EXISTS idx_seasons_game_id;
DROP TABLE IF EXISTS season_activity_log;
DROP TABLE IF EXISTS season_mmr_history;
DROP TABLE IF EXISTS season_reward_claims;
DROP TABLE IF EXISTS season_rewards;
DROP TABLE IF EXISTS season_leaderboard_entries;
DROP TABLE IF EXISTS season_leaderboards;
DROP TABLE IF EXISTS season_matches;
DROP TABLE IF EXISTS season_players;
DROP TABLE IF EXISTS season_tiers;
DROP TABLE IF EXISTS seasons;
