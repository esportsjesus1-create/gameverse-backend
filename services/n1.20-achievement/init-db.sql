-- GameVerse Achievement Module Database Initialization
-- This script runs automatically when the PostgreSQL container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL,
    icon_url TEXT,
    points INTEGER NOT NULL DEFAULT 10,
    rarity VARCHAR(20) NOT NULL DEFAULT 'common',
    type VARCHAR(20) NOT NULL DEFAULT 'single',
    category VARCHAR(20) NOT NULL DEFAULT 'gameplay',
    criteria JSONB NOT NULL,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    tiers JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for achievements
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
CREATE INDEX IF NOT EXISTS idx_achievements_rarity ON achievements(rarity);
CREATE INDEX IF NOT EXISTS idx_achievements_type ON achievements(type);
CREATE INDEX IF NOT EXISTS idx_achievements_is_hidden ON achievements(is_hidden);

-- Create user_achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    progress INTEGER NOT NULL DEFAULT 0,
    current_tier INTEGER NOT NULL DEFAULT 0,
    unlocked BOOLEAN NOT NULL DEFAULT false,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- Create indexes for user_achievements
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked ON user_achievements(unlocked);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_unlocked ON user_achievements(user_id, unlocked);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message VARCHAR(1000) NOT NULL,
    data JSONB,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_is_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Create migrations table
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Insert initial migrations record
INSERT INTO migrations (name) VALUES 
    ('001_create_achievements_table'),
    ('002_create_user_achievements_table'),
    ('003_create_notifications_table'),
    ('004_create_migrations_table')
ON CONFLICT (name) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_achievements_updated_at ON achievements;
CREATE TRIGGER update_achievements_updated_at
    BEFORE UPDATE ON achievements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_achievements_updated_at ON user_achievements;
CREATE TRIGGER update_user_achievements_updated_at
    BEFORE UPDATE ON user_achievements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (for production, adjust as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO gameverse;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO gameverse;
