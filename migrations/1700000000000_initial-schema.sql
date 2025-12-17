-- Up Migration

-- Create enum types
CREATE TYPE kyc_status AS ENUM ('none', 'pending', 'verified', 'rejected', 'expired');
CREATE TYPE blockchain_chain AS ENUM ('ethereum', 'polygon', 'solana', 'avalanche', 'binance', 'arbitrum', 'optimism', 'base');

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(30) NOT NULL UNIQUE,
    display_name VARCHAR(100),
    avatar_url TEXT,
    bio VARCHAR(500),
    email_verified BOOLEAN NOT NULL DEFAULT false,
    email_verification_token UUID,
    email_verification_expires TIMESTAMP WITH TIME ZONE,
    kyc_status kyc_status NOT NULL DEFAULT 'none',
    kyc_verified_at TIMESTAMP WITH TIME ZONE,
    kyc_provider VARCHAR(100),
    kyc_reference VARCHAR(255),
    preferences JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    anonymized_at TIMESTAMP WITH TIME ZONE
);

-- Create blockchain_addresses table
CREATE TABLE blockchain_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chain blockchain_chain NOT NULL,
    address VARCHAR(255) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMP WITH TIME ZONE,
    label VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(chain, address)
);

-- Create kyc_history table
CREATE TABLE kyc_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status kyc_status NOT NULL,
    provider VARCHAR(100),
    reference VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for users table
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email_verification_token ON users(email_verification_token) WHERE email_verification_token IS NOT NULL;
CREATE INDEX idx_users_kyc_status ON users(kyc_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- Create indexes for blockchain_addresses table
CREATE INDEX idx_blockchain_addresses_user_id ON blockchain_addresses(user_id);
CREATE INDEX idx_blockchain_addresses_chain_address ON blockchain_addresses(chain, address);
CREATE INDEX idx_blockchain_addresses_is_primary ON blockchain_addresses(user_id, is_primary) WHERE is_primary = true;

-- Create indexes for kyc_history table
CREATE INDEX idx_kyc_history_user_id ON kyc_history(user_id);
CREATE INDEX idx_kyc_history_created_at ON kyc_history(user_id, created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blockchain_addresses_updated_at
    BEFORE UPDATE ON blockchain_addresses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Down Migration
-- DROP TRIGGER IF EXISTS update_blockchain_addresses_updated_at ON blockchain_addresses;
-- DROP TRIGGER IF EXISTS update_users_updated_at ON users;
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP TABLE IF EXISTS kyc_history;
-- DROP TABLE IF EXISTS blockchain_addresses;
-- DROP TABLE IF EXISTS users;
-- DROP TYPE IF EXISTS blockchain_chain;
-- DROP TYPE IF EXISTS kyc_status;
