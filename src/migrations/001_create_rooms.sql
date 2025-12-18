-- GameVerse N1.38 Room Instance Module
-- Migration: Create rooms and related tables

-- Create enum types
DO $$ BEGIN
    CREATE TYPE room_status AS ENUM ('creating', 'active', 'paused', 'closing', 'closed', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE room_visibility AS ENUM ('public', 'private', 'friends_only');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE room_type AS ENUM ('lobby', 'game', 'social', 'event', 'custom');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE player_role AS ENUM ('owner', 'admin', 'moderator', 'member', 'guest');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE permission_action AS ENUM ('join', 'leave', 'invite', 'kick', 'ban', 'mute', 'update_settings', 'update_state', 'delete');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE instance_status AS ENUM ('starting', 'running', 'stopping', 'stopped');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type room_type NOT NULL DEFAULT 'lobby',
    status room_status NOT NULL DEFAULT 'creating',
    visibility room_visibility NOT NULL DEFAULT 'public',
    owner_id VARCHAR(255) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 50,
    current_player_count INTEGER NOT NULL DEFAULT 0,
    settings JSONB NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    password VARCHAR(255),
    instance_id UUID,
    parent_room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE
);

-- Room players table
CREATE TABLE IF NOT EXISTS room_players (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    role player_role NOT NULL DEFAULT 'member',
    is_spectator BOOLEAN NOT NULL DEFAULT FALSE,
    position JSONB,
    rotation JSONB,
    custom_data JSONB,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    disconnected_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(room_id, user_id)
);

-- Room permissions table
CREATE TABLE IF NOT EXISTS room_permissions (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    role player_role NOT NULL,
    action permission_action NOT NULL,
    allowed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(room_id, role, action)
);

-- Room events table
CREATE TABLE IF NOT EXISTS room_events (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    player_id VARCHAR(255),
    data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Room instances table
CREATE TABLE IF NOT EXISTS room_instances (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    server_id VARCHAR(255) NOT NULL,
    region VARCHAR(50) NOT NULL,
    status instance_status NOT NULL DEFAULT 'starting',
    connection_url VARCHAR(500) NOT NULL,
    player_count INTEGER NOT NULL DEFAULT 0,
    max_players INTEGER NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    stopped_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- Indexes for rooms
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(type);
CREATE INDEX IF NOT EXISTS idx_rooms_visibility ON rooms(visibility);
CREATE INDEX IF NOT EXISTS idx_rooms_owner_id ON rooms(owner_id);
CREATE INDEX IF NOT EXISTS idx_rooms_last_activity ON rooms(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_rooms_tags ON rooms USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_rooms_name_search ON rooms USING GIN(to_tsvector('english', name));

-- Indexes for room_players
CREATE INDEX IF NOT EXISTS idx_room_players_room_id ON room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_user_id ON room_players(user_id);
CREATE INDEX IF NOT EXISTS idx_room_players_role ON room_players(role);

-- Indexes for room_permissions
CREATE INDEX IF NOT EXISTS idx_room_permissions_room_id ON room_permissions(room_id);
CREATE INDEX IF NOT EXISTS idx_room_permissions_role ON room_permissions(role);

-- Indexes for room_events
CREATE INDEX IF NOT EXISTS idx_room_events_room_id ON room_events(room_id);
CREATE INDEX IF NOT EXISTS idx_room_events_type ON room_events(type);
CREATE INDEX IF NOT EXISTS idx_room_events_timestamp ON room_events(timestamp);

-- Indexes for room_instances
CREATE INDEX IF NOT EXISTS idx_room_instances_room_id ON room_instances(room_id);
CREATE INDEX IF NOT EXISTS idx_room_instances_server_id ON room_instances(server_id);
CREATE INDEX IF NOT EXISTS idx_room_instances_status ON room_instances(status);
CREATE INDEX IF NOT EXISTS idx_room_instances_region ON room_instances(region);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms;
CREATE TRIGGER update_rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_room_permissions_updated_at ON room_permissions;
CREATE TRIGGER update_room_permissions_updated_at
    BEFORE UPDATE ON room_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
