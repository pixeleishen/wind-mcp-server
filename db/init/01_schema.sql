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
-- processed schema — 标准化特征流（Long Format）
-- ============================================================
--
-- 设计原则（来自 docus/data_process.md）：
--   · 关注"变化量"而非"绝对量"，transformed_value 存差分/增速/收益率等
--   · Long Format：同一 target_id 同一天可有多行，由 transform_method 区分
--   · transform_method 作为联合主键的一部分，无需改表结构即可扩展新特征
--   · scenario_tag 不入本层，留给沙盒层运行时 JOIN macro_scenarios
--
-- target_type: 'asset' | 'indicator'  —— 区分来源表
-- target_id  : 对应 meta.assets.id 或 meta.indicators.id
--
CREATE TABLE IF NOT EXISTS processed.feature_series (
    obs_date            DATE    NOT NULL,               -- 统一观察日期 YYYY-MM-DD
    target_type         TEXT    NOT NULL,               -- 'asset' | 'indicator'
    target_id           INT     NOT NULL,               -- FK → meta.assets.id 或 meta.indicators.id
    raw_value           DOUBLE PRECISION,               -- 清洗后的原始绝对量（保留备查）
    transformed_value   DOUBLE PRECISION,               -- 核心特征值：变化量/增速/收益率等
    transform_method    TEXT    NOT NULL,               -- 'daily_return'|'YoY'|'MoM'|'volatility_20d'|...
    PRIMARY KEY (obs_date, target_type, target_id, transform_method)
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

CREATE INDEX IF NOT EXISTS idx_feature_series_target
    ON processed.feature_series (target_type, target_id, obs_date DESC);

CREATE INDEX IF NOT EXISTS idx_feature_series_method
    ON processed.feature_series (transform_method, obs_date DESC);

CREATE INDEX IF NOT EXISTS idx_factors_values_factor
    ON factors.values (factor_name, trade_date DESC);

CREATE INDEX IF NOT EXISTS idx_correlation_mappings_scenario
    ON meta.correlation_mappings (scenario_id);
