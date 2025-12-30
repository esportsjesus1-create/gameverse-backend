-- Migration: 002_create_parties
-- Description: Create party-related tables with proper indexing
-- Created: 2024-01-01

-- UP
CREATE TABLE IF NOT EXISTS parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    leader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    max_size INTEGER DEFAULT 4 CHECK (max_size >= 2 AND max_size <= 100),
    current_size INTEGER DEFAULT 1,
    is_private BOOLEAN DEFAULT false,
    password_hash VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'in_game', 'disbanded', 'full')),
    voice_channel_id UUID,
    game_mode VARCHAR(50),
    game_id VARCHAR(100),
    region VARCHAR(20) DEFAULT 'auto',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    disbanded_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS party_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('leader', 'co-leader', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_ready BOOLEAN DEFAULT false,
    is_muted BOOLEAN DEFAULT false,
    is_deafened BOOLEAN DEFAULT false,
    permissions JSONB DEFAULT '{}',
    UNIQUE(party_id, user_id)
);

CREATE TABLE IF NOT EXISTS party_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
    message TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS voice_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    max_participants INTEGER DEFAULT 10,
    bitrate INTEGER DEFAULT 64000,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(party_id)
);

CREATE TABLE IF NOT EXISTS voice_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES voice_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_muted BOOLEAN DEFAULT false,
    is_deafened BOOLEAN DEFAULT false,
    is_speaking BOOLEAN DEFAULT false,
    is_streaming BOOLEAN DEFAULT false,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS party_benefits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('xp_multiplier', 'loot_bonus', 'achievement_bonus', 'drop_rate_bonus', 'exclusive_reward', 'currency_bonus')),
    value DECIMAL(10, 4) NOT NULL,
    min_party_size INTEGER DEFAULT 2,
    max_party_size INTEGER,
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS party_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_parties_leader_id ON parties(leader_id);
CREATE INDEX IF NOT EXISTS idx_parties_status ON parties(status);
CREATE INDEX IF NOT EXISTS idx_parties_game_mode ON parties(game_mode);
CREATE INDEX IF NOT EXISTS idx_parties_created_at ON parties(created_at);
CREATE INDEX IF NOT EXISTS idx_party_members_party_id ON party_members(party_id);
CREATE INDEX IF NOT EXISTS idx_party_members_user_id ON party_members(user_id);
CREATE INDEX IF NOT EXISTS idx_party_invites_recipient_id ON party_invites(recipient_id);
CREATE INDEX IF NOT EXISTS idx_party_invites_party_id ON party_invites(party_id);
CREATE INDEX IF NOT EXISTS idx_party_invites_status ON party_invites(status);
CREATE INDEX IF NOT EXISTS idx_party_invites_expires_at ON party_invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_voice_participants_channel_id ON voice_participants(channel_id);
CREATE INDEX IF NOT EXISTS idx_voice_participants_user_id ON voice_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_party_activity_log_party_id ON party_activity_log(party_id);
CREATE INDEX IF NOT EXISTS idx_party_activity_log_created_at ON party_activity_log(created_at);

-- DOWN
DROP INDEX IF EXISTS idx_party_activity_log_created_at;
DROP INDEX IF EXISTS idx_party_activity_log_party_id;
DROP INDEX IF EXISTS idx_voice_participants_user_id;
DROP INDEX IF EXISTS idx_voice_participants_channel_id;
DROP INDEX IF EXISTS idx_party_invites_expires_at;
DROP INDEX IF EXISTS idx_party_invites_status;
DROP INDEX IF EXISTS idx_party_invites_party_id;
DROP INDEX IF EXISTS idx_party_invites_recipient_id;
DROP INDEX IF EXISTS idx_party_members_user_id;
DROP INDEX IF EXISTS idx_party_members_party_id;
DROP INDEX IF EXISTS idx_parties_created_at;
DROP INDEX IF EXISTS idx_parties_game_mode;
DROP INDEX IF EXISTS idx_parties_status;
DROP INDEX IF EXISTS idx_parties_leader_id;
DROP TABLE IF EXISTS party_activity_log;
DROP TABLE IF EXISTS party_benefits;
DROP TABLE IF EXISTS voice_participants;
DROP TABLE IF EXISTS voice_channels;
DROP TABLE IF EXISTS party_invites;
DROP TABLE IF EXISTS party_members;
DROP TABLE IF EXISTS parties;
