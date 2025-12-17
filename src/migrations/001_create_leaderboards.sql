-- Create leaderboards table
CREATE TABLE IF NOT EXISTS leaderboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('global', 'seasonal', 'weekly', 'daily', 'custom')),
    category VARCHAR(20) NOT NULL CHECK (category IN ('score', 'kills', 'wins', 'playtime', 'achievements', 'custom')),
    game_mode VARCHAR(50),
    season_id VARCHAR(100),
    decay_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create leaderboard_entries table
CREATE TABLE IF NOT EXISTS leaderboard_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leaderboard_id UUID NOT NULL REFERENCES leaderboards(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    score DOUBLE PRECISION NOT NULL DEFAULT 0,
    metadata JSONB,
    last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(leaderboard_id, user_id)
);

-- Create leaderboard_snapshots table
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leaderboard_id UUID NOT NULL REFERENCES leaderboards(id) ON DELETE CASCADE,
    entries JSONB NOT NULL,
    total_players INTEGER NOT NULL,
    snapshot_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_leaderboards_type ON leaderboards(type);
CREATE INDEX idx_leaderboards_category ON leaderboards(category);
CREATE INDEX idx_leaderboards_is_active ON leaderboards(is_active);
CREATE INDEX idx_leaderboards_season_id ON leaderboards(season_id) WHERE season_id IS NOT NULL;

CREATE INDEX idx_leaderboard_entries_leaderboard_id ON leaderboard_entries(leaderboard_id);
CREATE INDEX idx_leaderboard_entries_user_id ON leaderboard_entries(user_id);
CREATE INDEX idx_leaderboard_entries_score ON leaderboard_entries(leaderboard_id, score DESC);

CREATE INDEX idx_leaderboard_snapshots_leaderboard_id ON leaderboard_snapshots(leaderboard_id);
CREATE INDEX idx_leaderboard_snapshots_snapshot_at ON leaderboard_snapshots(snapshot_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leaderboards_updated_at
    BEFORE UPDATE ON leaderboards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leaderboard_entries_last_updated_at
    BEFORE UPDATE ON leaderboard_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
