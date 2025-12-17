-- Create tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    game_mode VARCHAR(50) NOT NULL,
    format VARCHAR(30) NOT NULL CHECK (format IN ('single_elimination', 'double_elimination', 'round_robin', 'swiss')),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'registration', 'seeding', 'in_progress', 'completed', 'cancelled')),
    max_participants INTEGER NOT NULL,
    min_participants INTEGER NOT NULL DEFAULT 2,
    entry_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
    prize_pool JSONB NOT NULL DEFAULT '{}',
    rules TEXT,
    settings JSONB NOT NULL DEFAULT '{}',
    registration_starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    registration_ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create participants table
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    team_id VARCHAR(255),
    team_name VARCHAR(100),
    seed INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'eliminated', 'winner', 'disqualified')),
    checked_in_at TIMESTAMP WITH TIME ZONE,
    eliminated_at TIMESTAMP WITH TIME ZONE,
    final_placement INTEGER,
    registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(tournament_id, user_id)
);

-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round INTEGER NOT NULL,
    match_number INTEGER NOT NULL,
    bracket_position VARCHAR(20) NOT NULL,
    participant1_id UUID REFERENCES participants(id),
    participant2_id UUID REFERENCES participants(id),
    winner_id UUID REFERENCES participants(id),
    loser_id UUID REFERENCES participants(id),
    score1 INTEGER,
    score2 INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'bye')),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    next_match_id UUID REFERENCES matches(id),
    loser_next_match_id UUID REFERENCES matches(id)
);

-- Create indexes
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournaments_starts_at ON tournaments(starts_at);
CREATE INDEX idx_tournaments_created_by ON tournaments(created_by);

CREATE INDEX idx_participants_tournament_id ON participants(tournament_id);
CREATE INDEX idx_participants_user_id ON participants(user_id);
CREATE INDEX idx_participants_status ON participants(status);

CREATE INDEX idx_matches_tournament_id ON matches(tournament_id);
CREATE INDEX idx_matches_round ON matches(tournament_id, round);
CREATE INDEX idx_matches_status ON matches(status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tournaments_updated_at
    BEFORE UPDATE ON tournaments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
