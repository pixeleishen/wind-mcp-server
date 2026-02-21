"""
日度行情入库（增量）
Wind wsd → raw.daily_prices
"""
import logging
from datetime import date, timedelta

from base import call_wind, get_conn, put_conn, upsert

logger = logging.getLogger(__name__)

# wsd 字段映射：Wind 字段名 → 数据库列名
WSD_FIELDS = {
    "open":      "open",
    "high":      "high",
    "low":       "low",
    "close":     "close",
    "volume":    "volume",
    "amt":       "amount",
    "pct_chg":   "pct_chg",
    "adjfactor": "adj_factor",
}


def _get_last_date(conn, code: str) -> date | None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT MAX(trade_date) FROM raw.daily_prices WHERE code = %s",
            (code,),
        )
        row = cur.fetchone()
    return row[0] if row and row[0] else None


def _ensure_asset(conn, code: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO raw.assets (code, asset_type) VALUES (%s, 'stock')"
            " ON CONFLICT (code) DO NOTHING",
            (code,),
        )
    conn.commit()


def load_prices(
    codes: list[str],
    start: str = "2015-01-01",
    end: str | None = None,
    incremental: bool = True,
) -> dict[str, int]:
    """
    批量拉取日度行情并写入 raw.daily_prices。
    incremental=True 时自动跳过已有数据，只拉取缺失日期。
    返回 {code: 写入行数} 字典。
    """
    if end is None:
        end = date.today().strftime("%Y-%m-%d")

    wind_fields = ",".join(WSD_FIELDS.keys())
    results: dict[str, int] = {}

    conn = get_conn()
    try:
        for code in codes:
            _ensure_asset(conn, code)

            fetch_start = start
            if incremental:
                last = _get_last_date(conn, code)
                if last:
                    fetch_start = (last + timedelta(days=1)).strftime("%Y-%m-%d")
                    if fetch_start > end:
                        logger.info(f"{code} 已是最新，跳过")
                        results[code] = 0
                        continue

            logger.info(f"拉取行情 {code}  {fetch_start} → {end}")
            try:
                data = call_wind(
                    "wsd",
                    {
                        "codes": code,
                        "fields": wind_fields,
                        "startDate": fetch_start,
                        "endDate": end,
                        "options": "PriceAdj=F",
                    },
                )
            except RuntimeError as e:
                logger.error(f"{code} 拉取失败: {e}")
                results[code] = 0
                continue

            # wsd 返回格式：{"data": [{"code":..,"trade_date":..,"open":..,...}]}
            raw_rows = data.get("data", [])
            if not raw_rows:
                logger.warning(f"{code} 无数据")
                results[code] = 0
                continue

            rows = []
            for r in raw_rows:
                row = {"code": code, "trade_date": r["trade_date"]}
                for wind_col, db_col in WSD_FIELDS.items():
                    row[db_col] = r.get(wind_col)
                rows.append(row)

            n = upsert(
                conn,
                table="raw.daily_prices",
                rows=rows,
                conflict_cols=["code", "trade_date"],
                update_cols=list(WSD_FIELDS.values()),
            )
            logger.info(f"{code} 写入 {n} 行")
            results[code] = n

    finally:
        put_conn(conn)

    return results


if __name__ == "__main__":
    # 示例：沪深300成分股示例代码
    sample_codes = ["000001.SZ", "600000.SH", "000002.SZ"]
    load_prices(sample_codes)
