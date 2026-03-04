"""
Mock 数据入库：跳过 Wind API，直接向 raw 表插入模拟数据。
用于在 Wind API 权限未开通时测试 LLM 清洗流程。

用法：
  python mock_load.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import random
from datetime import date, timedelta
from base import get_conn, put_conn, upsert

random.seed(42)

# ── 生成交易日历（工作日）──────────────────────────────────
def _workdays(start: date, end: date) -> list[date]:
    days, d = [], start
    while d <= end:
        if d.weekday() < 5:
            days.append(d)
        d += timedelta(days=1)
    return days

# ── 生成月末日期序列 ───────────────────────────────────────
def _month_ends(start: date, end: date) -> list[date]:
    days = []
    y, m = start.year, start.month
    while True:
        # 月末：下月1日减1天
        if m == 12:
            last = date(y + 1, 1, 1) - timedelta(days=1)
        else:
            last = date(y, m + 1, 1) - timedelta(days=1)
        if last > end:
            break
        days.append(last)
        m += 1
        if m > 12:
            m = 1
            y += 1
    return days


def load_mock():
    conn = get_conn()
    try:
        START = date(2020, 1, 1)
        END   = date(2026, 2, 28)

        # ── 1. 交易日历 ───────────────────────────────────────
        print("[1/4] 插入交易日历...")
        tdays = _workdays(START, END)
        upsert(conn, "raw.trading_calendar",
               [{"trade_date": d} for d in tdays],
               conflict_cols=["trade_date"])
        print(f"      {len(tdays)} 个交易日")

        # ── 2. meta.assets (沪深300指数) ──────────────────────
        print("[2/4] 插入资产元数据...")
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO meta.assets (asset_code, asset_name, asset_class)
                VALUES ('000300.SH', '沪深300', 'index')
                ON CONFLICT (asset_code) DO NOTHING
                RETURNING id
            """)
            row = cur.fetchone()
            if row:
                asset_id = row[0]
            else:
                cur.execute("SELECT id FROM meta.assets WHERE asset_code='000300.SH'")
                asset_id = cur.fetchone()[0]
        conn.commit()
        print(f"      asset_id = {asset_id}")

        # ── 3. raw.daily_prices (模拟沪深300日行情) ────────────
        print("[3/4] 插入沪深300模拟日行情...")
        price = 4000.0
        price_rows = []
        for d in tdays:
            ret    = random.gauss(0.0003, 0.012)
            close  = round(price * (1 + ret), 2)
            open_  = round(price * (1 + random.gauss(0, 0.003)), 2)
            high   = round(max(close, open_) * (1 + abs(random.gauss(0, 0.003))), 2)
            low    = round(min(close, open_) * (1 - abs(random.gauss(0, 0.003))), 2)
            vol    = round(random.uniform(2e10, 6e10), 0)
            price_rows.append({
                "asset_id":   asset_id,
                "trade_date": d,
                "open":       open_,
                "high":       high,
                "low":        low,
                "close":      close,
                "volume":     vol,
                "amount":     round(vol * close * 0.01, 0),
                "pct_chg":    round(ret * 100, 4),
                "adj_factor": 1.0,
            })
            price = close
        upsert(conn, "raw.daily_prices", price_rows,
               conflict_cols=["asset_id", "trade_date"],
               update_cols=["open","high","low","close","volume","amount","pct_chg","adj_factor"])
        print(f"      {len(price_rows)} 行日行情")

        # ── 4. meta.indicators + raw.indicator_series (M2) ────
        print("[4/4] 插入M2宏观指标模拟数据...")
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO meta.indicators (indicator_code, indicator_name, category)
                VALUES ('M0001385', 'M2货币供应量(亿元)', 'macro')
                ON CONFLICT (indicator_code) DO NOTHING
                RETURNING id
            """)
            row = cur.fetchone()
            if row:
                ind_id = row[0]
            else:
                cur.execute("SELECT id FROM meta.indicators WHERE indicator_code='M0001385'")
                ind_id = cur.fetchone()[0]
        conn.commit()
        print(f"      indicator_id = {ind_id}")

        # M2 从 2020年约200万亿起，每月增长约0.7%（对应约8.5% YoY）
        m2 = 2_000_000.0
        m2_rows = []
        for d in _month_ends(START, END):
            m2 = round(m2 * (1 + random.gauss(0.007, 0.001)), 2)
            m2_rows.append({
                "indicator_id": ind_id,
                "trade_date":   d,
                "value":        m2,
            })
        upsert(conn, "raw.indicator_series", m2_rows,
               conflict_cols=["indicator_id", "trade_date"],
               update_cols=["value"])
        print(f"      {len(m2_rows)} 个月度M2数据点")

        print("\n Mock 数据入库完成！")
        print(f"   asset_id     = {asset_id}  (000300.SH 沪深300)")
        print(f"   indicator_id = {ind_id}  (M0001385 M2)")
        return asset_id, ind_id

    finally:
        put_conn(conn)


if __name__ == "__main__":
    load_mock()
