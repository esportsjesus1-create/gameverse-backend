-- GameVerse N1.4 Ledger - Double-Entry Accounting Schema
-- PostgreSQL Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Currencies table
CREATE TABLE currencies (
    code VARCHAR(3) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    decimal_places INTEGER NOT NULL DEFAULT 2,
    is_base_currency BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_decimal_places CHECK (decimal_places >= 0 AND decimal_places <= 8),
    CONSTRAINT chk_single_base_currency UNIQUE (is_base_currency) WHERE is_base_currency = TRUE
);

-- Exchange rates table
CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
    to_currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
    rate DECIMAL(20, 10) NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_positive_rate CHECK (rate > 0),
    CONSTRAINT chk_different_currencies CHECK (from_currency != to_currency),
    CONSTRAINT uq_exchange_rate_date UNIQUE (from_currency, to_currency, effective_date)
);

-- Accounts table (Chart of Accounts)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL,
    currency_code VARCHAR(3) NOT NULL REFERENCES currencies(code),
    parent_id UUID REFERENCES accounts(id),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    normal_balance VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_account_type CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    CONSTRAINT chk_normal_balance CHECK (normal_balance IN ('DEBIT', 'CREDIT'))
);

-- Transactions table (Journal Headers)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    reference VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    transaction_date DATE NOT NULL,
    posted_at TIMESTAMP WITH TIME ZONE,
    voided_at TIMESTAMP WITH TIME ZONE,
    void_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_transaction_status CHECK (status IN ('PENDING', 'POSTED', 'VOIDED'))
);

-- Transaction entries table (Journal Lines)
CREATE TABLE transaction_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id),
    entry_type VARCHAR(10) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    currency_code VARCHAR(3) NOT NULL REFERENCES currencies(code),
    base_currency_amount DECIMAL(20, 8) NOT NULL,
    exchange_rate DECIMAL(20, 10) NOT NULL DEFAULT 1,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_entry_type CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    CONSTRAINT chk_positive_amount CHECK (amount > 0),
    CONSTRAINT chk_positive_base_amount CHECK (base_currency_amount > 0),
    CONSTRAINT chk_positive_exchange_rate CHECK (exchange_rate > 0)
);

-- Balance snapshots table
CREATE TABLE balance_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    balance DECIMAL(20, 8) NOT NULL,
    currency_code VARCHAR(3) NOT NULL REFERENCES currencies(code),
    snapshot_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_snapshot_account_date UNIQUE (account_id, snapshot_date)
);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    user_id VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Reconciliation runs table
CREATE TABLE reconciliation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    total_accounts INTEGER NOT NULL DEFAULT 0,
    balanced_accounts INTEGER NOT NULL DEFAULT 0,
    imbalanced_accounts INTEGER NOT NULL DEFAULT 0,
    discrepancies JSONB DEFAULT '[]',
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_reconciliation_status CHECK (status IN ('PENDING', 'BALANCED', 'IMBALANCED'))
);

-- Indexes for performance
CREATE INDEX idx_accounts_type ON accounts(type);
CREATE INDEX idx_accounts_parent ON accounts(parent_id);
CREATE INDEX idx_accounts_currency ON accounts(currency_code);
CREATE INDEX idx_accounts_active ON accounts(is_active);

CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_created_by ON transactions(created_by);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

CREATE INDEX idx_entries_transaction ON transaction_entries(transaction_id);
CREATE INDEX idx_entries_account ON transaction_entries(account_id);
CREATE INDEX idx_entries_type ON transaction_entries(entry_type);

CREATE INDEX idx_snapshots_account ON balance_snapshots(account_id);
CREATE INDEX idx_snapshots_date ON balance_snapshots(snapshot_date);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

CREATE INDEX idx_exchange_rates_date ON exchange_rates(effective_date);
CREATE INDEX idx_exchange_rates_currencies ON exchange_rates(from_currency, to_currency);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_currencies_updated_at
    BEFORE UPDATE ON currencies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to validate transaction balance (debits must equal credits)
CREATE OR REPLACE FUNCTION validate_transaction_balance()
RETURNS TRIGGER AS $$
DECLARE
    total_debits DECIMAL(20, 8);
    total_credits DECIMAL(20, 8);
BEGIN
    SELECT 
        COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN base_currency_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN base_currency_amount ELSE 0 END), 0)
    INTO total_debits, total_credits
    FROM transaction_entries
    WHERE transaction_id = NEW.id;
    
    IF total_debits != total_credits THEN
        RAISE EXCEPTION 'Transaction is not balanced: debits (%) != credits (%)', total_debits, total_credits;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to validate balance when transaction is posted
CREATE TRIGGER validate_transaction_on_post
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    WHEN (OLD.status = 'PENDING' AND NEW.status = 'POSTED')
    EXECUTE FUNCTION validate_transaction_balance();

-- Insert default currencies
INSERT INTO currencies (code, name, symbol, decimal_places, is_base_currency) VALUES
    ('USD', 'US Dollar', '$', 2, TRUE),
    ('EUR', 'Euro', '€', 2, FALSE),
    ('GBP', 'British Pound', '£', 2, FALSE),
    ('JPY', 'Japanese Yen', '¥', 0, FALSE),
    ('CNY', 'Chinese Yuan', '¥', 2, FALSE),
    ('BTC', 'Bitcoin', '₿', 8, FALSE),
    ('ETH', 'Ethereum', 'Ξ', 8, FALSE);
