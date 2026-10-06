-- NeedPipsForPorsche Schema Initializer
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table Candles (Timescale Hypertable for XAUUSD & Pairs)
CREATE TABLE IF NOT EXISTS market_candles (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    open NUMERIC(12, 4) NOT NULL,
    high NUMERIC(12, 4) NOT NULL,
    low NUMERIC(12, 4) NOT NULL,
    close NUMERIC(12, 4) NOT NULL,
    volume NUMERIC(16, 4) NOT NULL,
    PRIMARY KEY (time, symbol, timeframe)
);

SELECT create_hypertable('market_candles', 'time', if_not_exists => TRUE);

-- Index for fast lookup on symbol and timeframe
CREATE INDEX IF NOT EXISTS idx_candles_lookup ON market_candles (symbol, timeframe, time DESC);

-- 2. Table Trading Skills / Strategy Rules
CREATE TABLE IF NOT EXISTS trading_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(100) NOT NULL,
    description TEXT,
    timeframes VARCHAR(50)[],
    rules_checklist JSONB NOT NULL,
    risk_reward_min NUMERIC(4, 2) DEFAULT 2.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default XAUUSD Skill
INSERT INTO trading_skills (title, description, timeframes, rules_checklist, risk_reward_min)
VALUES (
    'XAU/USD Liquidity Sweep & SMC Confirmation',
    'Strategy setup focusing on Asian/London session liquidity sweeps followed by CHoCH on 5m timeframe.',
    ARRAY['5m', '15m', '1h'],
    '[
        {"id": "rule_1", "text": "HTF Trend Alignment (1H/4H Market Structure)", "required": true},
        {"id": "rule_2", "text": "Liquidity Sweep on High/Low Session or Key Support/Resistance", "required": true},
        {"id": "rule_3", "text": "Change of Character (CHoCH) / MSS on 5m timeframe", "required": true},
        {"id": "rule_4", "text": "Entry on Fair Value Gap (FVG) or Order Block mitigation", "required": true},
        {"id": "rule_5", "text": "Risk to Reward Ratio >= 1:2.5", "required": true},
        {"id": "rule_6", "text": "High Impact News (CPI/NFP/FOMC) buffer > 30 minutes", "required": true}
    ]'::jsonb,
    2.5
) ON CONFLICT DO NOTHING;

-- 3. Table API Key Vault (AES-256-GCM Encrypted)
CREATE TABLE IF NOT EXISTS api_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    key_identifier VARCHAR(100) NOT NULL,
    encrypted_secret TEXT NOT NULL,
    iv VARCHAR(32) NOT NULL,
    tag VARCHAR(32) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3b. Table 20-Agent Council Key Slots (Centralized server vault for multi-device sync)
CREATE TABLE IF NOT EXISTS council_key_slots (
    id VARCHAR(50) PRIMARY KEY,
    label VARCHAR(100) NOT NULL,
    role_title VARCHAR(200),
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    encrypted_secret TEXT,
    iv VARCHAR(32),
    tag VARCHAR(32),
    enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table Trade Journal
CREATE TABLE IF NOT EXISTS trade_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID REFERENCES trading_skills(id),
    symbol VARCHAR(20) NOT NULL DEFAULT 'XAUUSD',
    direction VARCHAR(4) NOT NULL CHECK (direction IN ('BUY', 'SELL')),
    entry_price NUMERIC(12, 4) NOT NULL,
    exit_price NUMERIC(12, 4),
    stop_loss NUMERIC(12, 4) NOT NULL,
    take_profit NUMERIC(12, 4) NOT NULL,
    lot_size NUMERIC(8, 2) NOT NULL,
    pnl NUMERIC(12, 2),
    rules_compliance JSONB,
    chart_snapshot_url TEXT,
    notes TEXT,
    ai_validation_summary TEXT,
    status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);
