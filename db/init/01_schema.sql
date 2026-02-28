-- ============================================================
-- 量化研究平台 — 数据库初始化 DDL
-- PostgreSQL
-- ============================================================

-- Schema 分层
CREATE SCHEMA IF NOT EXISTS meta;
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS processed;
CREATE SCHEMA IF NOT EXISTS factors;

-- ============================================================
-- meta schema — 元数据层
-- ============================================================

CREATE TABLE IF NOT EXISTS meta.macro_scenarios (
    id              SERIAL PRIMARY KEY,
    scenario_name   TEXT NOT NULL UNIQUE,
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meta.indicators (
    id              SERIAL PRIMARY KEY,
    indicator_code  TEXT NOT NULL UNIQUE,
    indicator_name  TEXT,
    category        TEXT,
    is_change_val   BOOLEAN DEFAULT FALSE,
    calc_method     TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meta.assets (
    id              SERIAL PRIMARY KEY,
    asset_code      TEXT NOT NULL UNIQUE,
    asset_name      TEXT,
    asset_class     TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meta.correlation_mappings (
    id                      SERIAL PRIMARY KEY,
    scenario_id             INT REFERENCES meta.macro_scenarios(id),
    indicator_id            INT REFERENCES meta.indicators(id),
    asset_id                INT REFERENCES meta.assets(id),
    expected_relationship   TEXT,
    validation_model        TEXT,
    created_at              TIMESTAMPTZ DEFAULT now(),
    UNIQUE(scenario_id, indicator_id, asset_id)
);

CREATE TABLE IF NOT EXISTS meta.wind_query_templates (
    id                  SERIAL PRIMARY KEY,
    query_name          TEXT NOT NULL,
    wind_function       TEXT NOT NULL,
    wind_params         JSONB NOT NULL,
    data_type           TEXT NOT NULL,
    target_indicator_id INT REFERENCES meta.indicators(id),
    target_asset_id     INT REFERENCES meta.assets(id),
    update_frequency    TEXT,
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- raw schema — 原始数据层
-- ============================================================

CREATE TABLE IF NOT EXISTS raw.trading_calendar (
    trade_date DATE PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS raw.daily_prices (
    asset_id    INT  NOT NULL REFERENCES meta.assets(id),
    trade_date  DATE NOT NULL REFERENCES raw.trading_calendar(trade_date),
    open        DOUBLE PRECISION,
    high        DOUBLE PRECISION,
    low         DOUBLE PRECISION,
    close       DOUBLE PRECISION,
    volume      DOUBLE PRECISION,
    amount      DOUBLE PRECISION,
    pct_chg     DOUBLE PRECISION,
    adj_factor  DOUBLE PRECISION,
    PRIMARY KEY (asset_id, trade_date)
);

CREATE TABLE IF NOT EXISTS raw.indicator_series (
    indicator_id  INT  NOT NULL REFERENCES meta.indicators(id),
    trade_date    DATE NOT NULL,
    value         DOUBLE PRECISION,
    PRIMARY KEY (indicator_id, trade_date)
);

-- ============================================================
-- processed schema — 清洗后数据层
-- ============================================================

CREATE TABLE IF NOT EXISTS processed.cleaned_series (
    series_type   TEXT NOT NULL,
    source_id     INT  NOT NULL,
    trade_date    DATE NOT NULL,
    field_name    TEXT NOT NULL,
    value         DOUBLE PRECISION,
    PRIMARY KEY (series_type, source_id, trade_date, field_name)
);

-- ============================================================
-- factors schema — 因子层
-- ============================================================

CREATE TABLE IF NOT EXISTS factors.values (
    factor_name TEXT NOT NULL,
    factor_type TEXT,
    trade_date  DATE NOT NULL,
    value       DOUBLE PRECISION,
    PRIMARY KEY (factor_name, trade_date)
);

-- ============================================================
-- 索引优化
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_daily_prices_asset
    ON raw.daily_prices (asset_id, trade_date DESC);

CREATE INDEX IF NOT EXISTS idx_indicator_series_ind
    ON raw.indicator_series (indicator_id, trade_date DESC);

CREATE INDEX IF NOT EXISTS idx_cleaned_series_lookup
    ON processed.cleaned_series (series_type, source_id, trade_date DESC);

CREATE INDEX IF NOT EXISTS idx_factors_values_factor
    ON factors.values (factor_name, trade_date DESC);

CREATE INDEX IF NOT EXISTS idx_correlation_mappings_scenario
    ON meta.correlation_mappings (scenario_id);
