-- Create game_sessions table
CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lobby_id UUID NOT NULL,
    game_mode VARCHAR(20) NOT NULL CHECK (game_mode IN ('solo', 'duo', 'squad', 'custom')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'completed', 'cancelled', 'abandoned')),
    settings JSONB NOT NULL DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    paused_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER DEFAULT 0,
    winner_id VARCHAR(255),
    winner_team INTEGER,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create session_players table
CREATE TABLE IF NOT EXISTS session_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    team INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'reconnecting', 'left', 'kicked')),
    reconnection_token TEXT,
    reconnection_expiry TIMESTAMP WITH TIME ZONE,
    stats JSONB NOT NULL DEFAULT '{}',
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    disconnected_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(session_id, user_id)
);

-- Create session_events table
CREATE TABLE IF NOT EXISTS session_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    player_id VARCHAR(255),
    data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_game_sessions_status ON game_sessions(status);
CREATE INDEX idx_game_sessions_lobby_id ON game_sessions(lobby_id);
CREATE INDEX idx_game_sessions_started_at ON game_sessions(started_at DESC);
CREATE INDEX idx_game_sessions_created_at ON game_sessions(created_at DESC);

CREATE INDEX idx_session_players_session_id ON session_players(session_id);
CREATE INDEX idx_session_players_user_id ON session_players(user_id);
CREATE INDEX idx_session_players_status ON session_players(status);

CREATE INDEX idx_session_events_session_id ON session_events(session_id);
CREATE INDEX idx_session_events_type ON session_events(type);
CREATE INDEX idx_session_events_timestamp ON session_events(timestamp DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_game_sessions_updated_at
    BEFORE UPDATE ON game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
