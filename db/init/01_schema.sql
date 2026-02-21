-- ============================================================
-- 量化研究平台 — 数据库初始化 DDL
-- PostgreSQL
-- ============================================================

-- ============================================================
-- Schema 分层
-- raw.*       Wind 原始数据（只写入，不修改）
-- processed.* 清洗/加工后数据（因子计算的输入）
-- factors.*   因子值（因子模型的输出）
-- ============================================================
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS processed;
CREATE SCHEMA IF NOT EXISTS factors;

-- ============================================================
-- 交易日历（tdays 结果）
-- ============================================================
CREATE TABLE IF NOT EXISTS raw.trading_calendar (
    trade_date DATE PRIMARY KEY
);

-- ============================================================
-- 资产主表
-- ============================================================
CREATE TABLE IF NOT EXISTS raw.assets (
    code        TEXT PRIMARY KEY,   -- e.g. 000001.SZ
    name        TEXT,
    asset_type  TEXT                -- stock / index / fund / future
);

-- ============================================================
-- 日度行情（wsd 结果）
-- ============================================================
CREATE TABLE IF NOT EXISTS raw.daily_prices (
    code        TEXT    NOT NULL REFERENCES raw.assets(code),
    trade_date  DATE    NOT NULL REFERENCES raw.trading_calendar(trade_date),
    open        FLOAT,
    high        FLOAT,
    low         FLOAT,
    close       FLOAT,
    volume      FLOAT,
    amount      FLOAT,
    pct_chg     FLOAT,
    adj_factor  FLOAT,
    PRIMARY KEY (code, trade_date)
);

-- ============================================================
-- 快照指标（wss 结果，无时间轴 → forward-fill 到全部交易日）
-- ============================================================
CREATE TABLE IF NOT EXISTS raw.daily_fundamentals (
    code        TEXT    NOT NULL REFERENCES raw.assets(code),
    trade_date  DATE    NOT NULL REFERENCES raw.trading_calendar(trade_date),
    pe_ttm      FLOAT,
    pb_mrq      FLOAT,
    ps_ttm      FLOAT,
    pcf_ttm     FLOAT,
    mkt_cap     FLOAT,
    float_cap   FLOAT,
    roe_ttm     FLOAT,
    roa_ttm     FLOAT,
    PRIMARY KEY (code, trade_date)
);

-- ============================================================
-- 宏观经济指标（edb 结果）
-- ============================================================
CREATE TABLE IF NOT EXISTS raw.macro_indicators (
    indicator_code  TEXT    NOT NULL,
    indicator_name  TEXT,
    trade_date      DATE    NOT NULL,
    value           FLOAT,
    PRIMARY KEY (indicator_code, trade_date)
);

-- ============================================================
-- 因子值表（factors schema）
-- ============================================================
CREATE TABLE IF NOT EXISTS factors.values (
    factor_name TEXT    NOT NULL,
    code        TEXT    NOT NULL,
    trade_date  DATE    NOT NULL,
    value       FLOAT,
    PRIMARY KEY (factor_name, code, trade_date)
);

-- ============================================================
-- 索引优化
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_daily_prices_code
    ON raw.daily_prices (code, trade_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_fundamentals_code
    ON raw.daily_fundamentals (code, trade_date DESC);

CREATE INDEX IF NOT EXISTS idx_macro_indicators_code
    ON raw.macro_indicators (indicator_code, trade_date DESC);

CREATE INDEX IF NOT EXISTS idx_factors_values_factor
    ON factors.values (factor_name, trade_date DESC);

CREATE INDEX IF NOT EXISTS idx_factors_values_code
    ON factors.values (code, trade_date DESC);
