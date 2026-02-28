"""
宏观经济指标入库（增量）
Wind edb → raw.indicator_series
"""
import logging
from datetime import date, timedelta

from base import call_wind, get_conn, put_conn, upsert

logger = logging.getLogger(__name__)


def _ensure_indicator(conn, code: str, name: str | None = None) -> int:
    """确保 meta.indicators 中存在该指标，返回 id。"""
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO meta.indicators (indicator_code, indicator_name, category)"
            " VALUES (%s, %s, 'macro')"
            " ON CONFLICT (indicator_code) DO UPDATE SET indicator_name = COALESCE(EXCLUDED.indicator_name, meta.indicators.indicator_name)"
            " RETURNING id",
            (code, name),
        )
        ind_id = cur.fetchone()[0]
    conn.commit()
    return ind_id


def _get_last_date(conn, indicator_id: int) -> date | None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT MAX(trade_date) FROM raw.indicator_series"
            " WHERE indicator_id = %s",
            (indicator_id,),
        )
        row = cur.fetchone()
    return row[0] if row and row[0] else None


def load_macro(
    indicator_codes: list[str],
    start: str = "2000-01-01",
    end: str | None = None,
    incremental: bool = True,
) -> dict[str, int]:
    """
    批量拉取宏观指标并写入 raw.indicator_series。
    返回 {indicator_code: 写入行数} 字典。
    """
    if end is None:
        end = date.today().strftime("%Y-%m-%d")

    results: dict[str, int] = {}

    conn = get_conn()
    try:
        for code in indicator_codes:
            ind_id = _ensure_indicator(conn, code)

            fetch_start = start
            if incremental:
                last = _get_last_date(conn, ind_id)
                if last:
                    fetch_start = (last + timedelta(days=1)).strftime("%Y-%m-%d")
                    if fetch_start > end:
                        logger.info(f"{code} 已是最新，跳过")
                        results[code] = 0
                        continue

            logger.info(f"拉取宏观指标 {code}  {fetch_start} → {end}")
            try:
                data = call_wind(
                    "edb",
                    {
                        "codes": code,
                        "startDate": fetch_start,
                        "endDate": end,
                        "options": "",
                    },
                )
            except RuntimeError as e:
                logger.error(f"{code} edb 拉取失败: {e}")
                results[code] = 0
                continue

            raw_rows = data.get("data", [])
            if not raw_rows:
                logger.warning(f"{code} 无数据")
                results[code] = 0
                continue

            # 更新 indicator_name（如果 edb 返回了名称）
            first_name = raw_rows[0].get("name")
            if first_name:
                _ensure_indicator(conn, code, first_name)

            rows = [
                {
                    "indicator_id": ind_id,
                    "trade_date": r.get("date") or r.get("trade_date"),
                    "value": r.get("value"),
                }
                for r in raw_rows
            ]

            n = upsert(
                conn,
                table="raw.indicator_series",
                rows=rows,
                conflict_cols=["indicator_id", "trade_date"],
                update_cols=["value"],
            )
            logger.info(f"{code} 写入 {n} 行")
            results[code] = n

    finally:
        put_conn(conn)

    return results


if __name__ == "__main__":
    sample_codes = ["M0001385", "M0001227"]
    load_macro(sample_codes)
