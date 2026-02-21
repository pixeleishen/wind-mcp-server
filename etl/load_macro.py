"""
宏观经济指标入库（增量）
Wind edb → raw.macro_indicators
"""
import logging
from datetime import date, timedelta

from base import call_wind, get_conn, put_conn, upsert

logger = logging.getLogger(__name__)


def _get_last_date(conn, indicator_code: str) -> date | None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT MAX(trade_date) FROM raw.macro_indicators"
            " WHERE indicator_code = %s",
            (indicator_code,),
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
    批量拉取宏观指标并写入 raw.macro_indicators。
    indicator_codes — Wind EDB 指标代码列表，如 ["M0001385", "M0001227"]
    返回 {indicator_code: 写入行数} 字典。
    """
    if end is None:
        end = date.today().strftime("%Y-%m-%d")

    results: dict[str, int] = {}

    conn = get_conn()
    try:
        for code in indicator_codes:
            fetch_start = start
            if incremental:
                last = _get_last_date(conn, code)
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

            # edb 返回格式：{"data": [{"indicator_code":..,"date":..,"value":..}]}
            raw_rows = data.get("data", [])
            if not raw_rows:
                logger.warning(f"{code} 无数据")
                results[code] = 0
                continue

            rows = [
                {
                    "indicator_code": code,
                    "indicator_name": r.get("name"),
                    "trade_date":     r.get("date") or r.get("trade_date"),
                    "value":          r.get("value"),
                }
                for r in raw_rows
            ]

            n = upsert(
                conn,
                table="raw.macro_indicators",
                rows=rows,
                conflict_cols=["indicator_code", "trade_date"],
                update_cols=["value", "indicator_name"],
            )
            logger.info(f"{code} 写入 {n} 行")
            results[code] = n

    finally:
        put_conn(conn)

    return results


if __name__ == "__main__":
    # 示例：M2 同比增速、CPI 同比
    sample_codes = ["M0001385", "M0001227"]
    load_macro(sample_codes)
