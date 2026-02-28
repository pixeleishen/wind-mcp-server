"""
快照基本面指标入库（增量）
Wind wss → raw.indicator_series
wss 返回无时间轴的快照值，ETL 将其 forward-fill 到全部交易日。
"""
import logging
from datetime import date

from base import call_wind, get_conn, put_conn, upsert

logger = logging.getLogger(__name__)

# wss 字段映射：Wind 字段名 → indicator category
WSS_FIELDS = [
    "pe_ttm", "pb_mrq", "ps_ttm", "pcf_ttm",
    "mkt_cap", "float_cap", "roe_ttm", "roa_ttm",
]


def _ensure_indicator(conn, code: str, name: str | None = None) -> int:
    """确保 meta.indicators 中存在该指标，返回 id。"""
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO meta.indicators (indicator_code, indicator_name, category)"
            " VALUES (%s, %s, 'fundamental')"
            " ON CONFLICT (indicator_code) DO UPDATE SET indicator_code = EXCLUDED.indicator_code"
            " RETURNING id",
            (code, name),
        )
        ind_id = cur.fetchone()[0]
    conn.commit()
    return ind_id


def _get_trading_dates(conn, after: date | None = None) -> list[str]:
    with conn.cursor() as cur:
        if after:
            cur.execute(
                "SELECT trade_date FROM raw.trading_calendar"
                " WHERE trade_date > %s ORDER BY trade_date",
                (after,),
            )
        else:
            cur.execute(
                "SELECT trade_date FROM raw.trading_calendar ORDER BY trade_date"
            )
        return [row[0].strftime("%Y-%m-%d") for row in cur.fetchall()]


def _get_last_date(conn, indicator_id: int) -> date | None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT MAX(trade_date) FROM raw.indicator_series WHERE indicator_id = %s",
            (indicator_id,),
        )
        row = cur.fetchone()
    return row[0] if row and row[0] else None


def load_fundamentals(
    codes: list[str],
    incremental: bool = True,
) -> dict[str, int]:
    """
    拉取 wss 快照指标并 forward-fill 到全部缺失交易日。
    每个 wss 字段作为独立指标写入 raw.indicator_series。
    返回 {code: 写入行数} 字典。
    """
    wind_fields = ",".join(WSS_FIELDS)
    results: dict[str, int] = {}

    conn = get_conn()
    try:
        for code in codes:
            logger.info(f"拉取基本面快照 {code}")
            try:
                data = call_wind(
                    "wss",
                    {"codes": code, "fields": wind_fields, "options": ""},
                )
            except RuntimeError as e:
                logger.error(f"{code} wss 拉取失败: {e}")
                results[code] = 0
                continue

            raw_rows = data.get("data", [])
            if not raw_rows:
                logger.warning(f"{code} wss 无数据")
                results[code] = 0
                continue

            snapshot = raw_rows[0]
            total = 0

            for field in WSS_FIELDS:
                val = snapshot.get(field)
                if val is None:
                    continue

                ind_code = f"{code}:{field}"
                ind_id = _ensure_indicator(conn, ind_code, f"{code} {field}")

                last = _get_last_date(conn, ind_id) if incremental else None
                missing_dates = _get_trading_dates(conn, after=last)
                if not missing_dates:
                    continue

                rows = [
                    {"indicator_id": ind_id, "trade_date": td, "value": val}
                    for td in missing_dates
                ]

                n = upsert(
                    conn,
                    table="raw.indicator_series",
                    rows=rows,
                    conflict_cols=["indicator_id", "trade_date"],
                    update_cols=["value"],
                )
                total += n

            logger.info(f"{code} 基本面写入 {total} 行")
            results[code] = total

    finally:
        put_conn(conn)

    return results


if __name__ == "__main__":
    sample_codes = ["000001.SZ", "600000.SH", "000002.SZ"]
    load_fundamentals(sample_codes)
