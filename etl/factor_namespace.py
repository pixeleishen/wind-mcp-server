"""
Pre-built namespace for factor generation scripts.
Provides database helpers and common libraries.
"""
from base import get_conn, put_conn, upsert
import psycopg2
import numpy as np
import pandas as pd

def load_processed_data(conn, table: str, start_date: str = None, end_date: str = None) -> pd.DataFrame:
    """Load data from processed.* schema."""
    query = f"SELECT * FROM processed.{table}"
    conditions = []
    params = []

    if start_date:
        conditions.append("trade_date >= %s")
        params.append(start_date)
    if end_date:
        conditions.append("trade_date <= %s")
        params.append(end_date)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    return pd.read_sql(query, conn, params=params if params else None)

def save_factor_values(conn, factor_name: str, df: pd.DataFrame, asset_level: bool = True):
    """
    Save factor values to factors.values or factors.asset_values.

    df must have columns:
    - For asset-level: ['asset_code', 'trade_date', 'value']
    - For portfolio-level: ['trade_date', 'value']
    """
    if asset_level:
        table = "factors.asset_values"
        df['factor_name'] = factor_name
        rows = df[['factor_name', 'asset_code', 'trade_date', 'value']].to_dict('records')
        conflict_cols = ['factor_name', 'asset_code', 'trade_date']
    else:
        table = "factors.values"
        df['factor_name'] = factor_name
        rows = df[['factor_name', 'trade_date', 'value']].to_dict('records')
        conflict_cols = ['factor_name', 'trade_date']

    upsert(conn, table, rows, conflict_cols, ['value'])
    print(f"✓ Saved {len(rows)} rows to {table}")

def save_factor_metadata(conn, factor_name: str, description: str, python_code: str, source_paper: str = None):
    """Save factor metadata."""
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO factors.metadata (factor_name, description, python_code, source_paper)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (factor_name) DO UPDATE SET
                description = EXCLUDED.description,
                python_code = EXCLUDED.python_code,
                source_paper = EXCLUDED.source_paper,
                updated_at = NOW()
        """, (factor_name, description, python_code, source_paper))
    conn.commit()
    print(f"✓ Saved metadata for factor '{factor_name}'")

def build_namespace():
    """Build the execution namespace for factor scripts."""
    return {
        'get_conn': get_conn,
        'put_conn': put_conn,
        'upsert': upsert,
        'psycopg2': psycopg2,
        'np': np,
        'pd': pd,
        'load_processed_data': load_processed_data,
        'save_factor_values': save_factor_values,
        'save_factor_metadata': save_factor_metadata,
    }
