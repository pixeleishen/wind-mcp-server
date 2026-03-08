-- ============================================================
-- Factor Production Schema Extension
-- ============================================================

-- Store factor metadata and generated Python code
CREATE TABLE IF NOT EXISTS factors.metadata (
    factor_name TEXT PRIMARY KEY,
    description TEXT,
    source_paper TEXT,
    python_code TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factors_metadata_created
    ON factors.metadata (created_at DESC);

-- Store asset-level factor values
CREATE TABLE IF NOT EXISTS factors.asset_values (
    factor_name TEXT NOT NULL,
    asset_code TEXT NOT NULL,
    trade_date DATE NOT NULL,
    value DOUBLE PRECISION,
    PRIMARY KEY (factor_name, asset_code, trade_date)
);

CREATE INDEX IF NOT EXISTS idx_factors_asset_values_lookup
    ON factors.asset_values (factor_name, trade_date DESC);
