"""
公共工具：数据库连接池 + upsert 辅助函数 + Wind bridge 调用
"""
import sys
import json
import logging
import subprocess
from typing import Any

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool

from config import DB_DSN, BRIDGE_DIR

logger = logging.getLogger(__name__)

# ── 连接池（全局单例）──────────────────────────────────────
_pool: ThreadedConnectionPool | None = None


def get_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = ThreadedConnectionPool(minconn=1, maxconn=5, dsn=DB_DSN)
    return _pool


def get_conn():
    return get_pool().getconn()


def put_conn(conn):
    get_pool().putconn(conn)


# ── upsert 辅助 ────────────────────────────────────────────
def upsert(
    conn,
    table: str,
    rows: list[dict],
    conflict_cols: list[str],
    update_cols: list[str] | None = None,
) -> int:
    """
    批量 upsert。
    table          — 完整表名，如 'raw.daily_prices'
    rows           — list of dicts，key 为列名
    conflict_cols  — ON CONFLICT 列
    update_cols    — 冲突时更新的列；None 表示 DO NOTHING
    返回插入/更新行数。
    """
    if not rows:
        return 0

    cols = list(rows[0].keys())
    col_str = ", ".join(cols)
    val_tmpl = ", ".join(f"%({c})s" for c in cols)
    conflict_str = ", ".join(conflict_cols)

    if update_cols:
        update_str = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
        on_conflict = f"ON CONFLICT ({conflict_str}) DO UPDATE SET {update_str}"
    else:
        on_conflict = f"ON CONFLICT ({conflict_str}) DO NOTHING"

    sql = f"INSERT INTO {table} ({col_str}) VALUES ({val_tmpl}) {on_conflict}"

    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, sql, rows, page_size=500)
    conn.commit()
    return len(rows)


# ── Wind bridge 调用 ───────────────────────────────────────
def call_wind(function: str, params: dict) -> dict:
    """
    调用 wind_bridge.py，返回解析后的 JSON 结果。
    """
    payload = json.dumps({"function": function, "params": params})
    bridge_script = BRIDGE_DIR / "wind_bridge.py"

    result = subprocess.run(
        [sys.executable, str(bridge_script)],
        input=payload,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"wind_bridge exited {result.returncode}: {result.stderr.strip()}"
        )

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"wind_bridge returned invalid JSON: {e}\n{result.stdout[:500]}")

    if data.get("error"):
        raise RuntimeError(f"Wind API error: {data['error']}")

    return data
