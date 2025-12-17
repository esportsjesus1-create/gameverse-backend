-- Create lobbies table
CREATE TABLE IF NOT EXISTS lobbies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    host_id VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('public', 'private', 'ranked', 'custom')),
    game_mode VARCHAR(20) NOT NULL CHECK (game_mode IN ('solo', 'duo', 'squad', 'custom')),
    status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready_check', 'countdown', 'starting', 'in_game', 'closed')),
    max_players INTEGER NOT NULL DEFAULT 10,
    min_players INTEGER NOT NULL DEFAULT 2,
    invite_code VARCHAR(10) UNIQUE,
    settings JSONB NOT NULL DEFAULT '{}',
    ready_check_started_at TIMESTAMP WITH TIME ZONE,
    countdown_started_at TIMESTAMP WITH TIME ZONE,
    game_session_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create lobby_players table
CREATE TABLE IF NOT EXISTS lobby_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'ready', 'not_ready', 'disconnected')),
    team INTEGER,
    slot INTEGER NOT NULL,
    is_host BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ready_at TIMESTAMP WITH TIME ZONE,
    disconnected_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(lobby_id, user_id),
    UNIQUE(lobby_id, slot)
);

-- Create lobby_invites table
CREATE TABLE IF NOT EXISTS lobby_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
    inviter_id VARCHAR(255) NOT NULL,
    invitee_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_lobbies_status ON lobbies(status);
CREATE INDEX idx_lobbies_type ON lobbies(type);
CREATE INDEX idx_lobbies_host_id ON lobbies(host_id);
CREATE INDEX idx_lobbies_invite_code ON lobbies(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX idx_lobbies_created_at ON lobbies(created_at DESC);

CREATE INDEX idx_lobby_players_lobby_id ON lobby_players(lobby_id);
CREATE INDEX idx_lobby_players_user_id ON lobby_players(user_id);

CREATE INDEX idx_lobby_invites_lobby_id ON lobby_invites(lobby_id);
CREATE INDEX idx_lobby_invites_invitee_id ON lobby_invites(invitee_id);
CREATE INDEX idx_lobby_invites_status ON lobby_invites(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for lobbies
CREATE TRIGGER update_lobbies_updated_at
    BEFORE UPDATE ON lobbies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
