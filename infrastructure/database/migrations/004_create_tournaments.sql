-- Migration: 004_create_tournaments
-- Description: Create tournament-related tables with proper indexing
-- Created: 2024-01-01

-- UP
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    game_id VARCHAR(100) NOT NULL,
    game_mode VARCHAR(50) NOT NULL,
    organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) DEFAULT 'single_elimination' CHECK (type IN ('single_elimination', 'double_elimination', 'round_robin', 'swiss', 'custom')),
    format VARCHAR(30) DEFAULT 'solo' CHECK (format IN ('solo', 'duo', 'squad', 'team')),
    team_size INTEGER DEFAULT 1,
    min_participants INTEGER DEFAULT 2,
    max_participants INTEGER NOT NULL,
    current_participants INTEGER DEFAULT 0,
    entry_fee DECIMAL(18, 8) DEFAULT 0,
    entry_fee_currency VARCHAR(10) DEFAULT 'USD',
    prize_pool DECIMAL(18, 8) DEFAULT 0,
    prize_pool_currency VARCHAR(10) DEFAULT 'USD',
    prize_distribution JSONB DEFAULT '[]',
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled')),
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'invite_only')),
    region VARCHAR(20) DEFAULT 'global',
    rules TEXT,
    settings JSONB DEFAULT '{}',
    registration_start_at TIMESTAMP WITH TIME ZONE,
    registration_end_at TIMESTAMP WITH TIME ZONE,
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID,
    seed INTEGER,
    status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'active', 'eliminated', 'disqualified', 'withdrawn')),
    check_in_at TIMESTAMP WITH TIME ZONE,
    eliminated_at TIMESTAMP WITH TIME ZONE,
    final_placement INTEGER,
    stats JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS tournament_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    tag VARCHAR(10),
    captain_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    logo_url TEXT,
    seed INTEGER,
    status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'active', 'eliminated', 'disqualified', 'withdrawn')),
    final_placement INTEGER,
    stats JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('captain', 'co-captain', 'member', 'substitute')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS tournament_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    name VARCHAR(100),
    type VARCHAR(30) DEFAULT 'winners' CHECK (type IN ('winners', 'losers', 'grand_final', 'group_stage', 'swiss')),
    best_of INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    start_at TIMESTAMP WITH TIME ZONE,
    end_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tournament_id, round_number, type)
);

CREATE TABLE IF NOT EXISTS tournament_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round_id UUID NOT NULL REFERENCES tournament_rounds(id) ON DELETE CASCADE,
    match_number INTEGER NOT NULL,
    participant1_id UUID REFERENCES tournament_participants(id) ON DELETE SET NULL,
    participant2_id UUID REFERENCES tournament_participants(id) ON DELETE SET NULL,
    team1_id UUID REFERENCES tournament_teams(id) ON DELETE SET NULL,
    team2_id UUID REFERENCES tournament_teams(id) ON DELETE SET NULL,
    winner_id UUID,
    loser_id UUID,
    score1 INTEGER DEFAULT 0,
    score2 INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled', 'forfeit')),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    game_data JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_brackets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE UNIQUE,
    bracket_type VARCHAR(30) NOT NULL,
    bracket_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_prizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    placement INTEGER NOT NULL,
    prize_type VARCHAR(30) NOT NULL CHECK (prize_type IN ('currency', 'item', 'badge', 'title', 'custom')),
    prize_value DECIMAL(18, 8),
    prize_currency VARCHAR(10),
    prize_item_id VARCHAR(100),
    prize_description TEXT,
    claimed BOOLEAN DEFAULT false,
    claimed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    claimed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tournaments_organizer_id ON tournaments(organizer_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_game_id ON tournaments(game_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_start_at ON tournaments(start_at);
CREATE INDEX IF NOT EXISTS idx_tournaments_visibility ON tournaments(visibility);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament_id ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_user_id ON tournament_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_status ON tournament_participants(status);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament_id ON tournament_teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_captain_id ON tournament_teams(captain_id);
CREATE INDEX IF NOT EXISTS idx_tournament_team_members_team_id ON tournament_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_tournament_team_members_user_id ON tournament_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_rounds_tournament_id ON tournament_rounds(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_id ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_round_id ON tournament_matches(round_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_status ON tournament_matches(status);
CREATE INDEX IF NOT EXISTS idx_tournament_prizes_tournament_id ON tournament_prizes(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_activity_log_tournament_id ON tournament_activity_log(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_activity_log_created_at ON tournament_activity_log(created_at);

-- DOWN
DROP INDEX IF EXISTS idx_tournament_activity_log_created_at;
DROP INDEX IF EXISTS idx_tournament_activity_log_tournament_id;
DROP INDEX IF EXISTS idx_tournament_prizes_tournament_id;
DROP INDEX IF EXISTS idx_tournament_matches_status;
DROP INDEX IF EXISTS idx_tournament_matches_round_id;
DROP INDEX IF EXISTS idx_tournament_matches_tournament_id;
DROP INDEX IF EXISTS idx_tournament_rounds_tournament_id;
DROP INDEX IF EXISTS idx_tournament_team_members_user_id;
DROP INDEX IF EXISTS idx_tournament_team_members_team_id;
DROP INDEX IF EXISTS idx_tournament_teams_captain_id;
DROP INDEX IF EXISTS idx_tournament_teams_tournament_id;
DROP INDEX IF EXISTS idx_tournament_participants_status;
DROP INDEX IF EXISTS idx_tournament_participants_user_id;
DROP INDEX IF EXISTS idx_tournament_participants_tournament_id;
DROP INDEX IF EXISTS idx_tournaments_visibility;
DROP INDEX IF EXISTS idx_tournaments_start_at;
DROP INDEX IF EXISTS idx_tournaments_status;
DROP INDEX IF EXISTS idx_tournaments_game_id;
DROP INDEX IF EXISTS idx_tournaments_organizer_id;
DROP TABLE IF EXISTS tournament_activity_log;
DROP TABLE IF EXISTS tournament_prizes;
DROP TABLE IF EXISTS tournament_brackets;
DROP TABLE IF EXISTS tournament_matches;
DROP TABLE IF EXISTS tournament_rounds;
DROP TABLE IF EXISTS tournament_team_members;
DROP TABLE IF EXISTS tournament_teams;
DROP TABLE IF EXISTS tournament_participants;
DROP TABLE IF EXISTS tournaments;
