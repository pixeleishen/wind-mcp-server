"""
快照基本面指标入库 + forward-fill（增量）
Wind wss → raw.daily_fundamentals
wss 返回无时间轴的快照值，ETL 将其 forward-fill 到全部交易日。
"""
import logging
from datetime import date

from base import call_wind, get_conn, put_conn, upsert

logger = logging.getLogger(__name__)

# wss 字段映射：Wind 字段名 → 数据库列名
WSS_FIELDS = {
    "pe_ttm":    "pe_ttm",
    "pb_mrq":    "pb_mrq",
    "ps_ttm":    "ps_ttm",
    "pcf_ttm":   "pcf_ttm",
    "mkt_cap":   "mkt_cap",
    "float_cap": "float_cap",
    "roe_ttm":   "roe_ttm",
    "roa_ttm":   "roa_ttm",
}


def _get_trading_dates(conn, after: date | None = None) -> list[str]:
    """获取 trading_calendar 中所有（或指定日期之后的）交易日。"""
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


def _get_last_date(conn, code: str) -> date | None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT MAX(trade_date) FROM raw.daily_fundamentals WHERE code = %s",
            (code,),
        )
        row = cur.fetchone()
    return row[0] if row and row[0] else None


def load_fundamentals(
    codes: list[str],
    incremental: bool = True,
) -> dict[str, int]:
    """
    拉取 wss 快照指标并 forward-fill 到全部缺失交易日。
    返回 {code: 写入行数} 字典。
    """
    wind_fields = ",".join(WSS_FIELDS.keys())
    results: dict[str, int] = {}

    conn = get_conn()
    try:
        for code in codes:
            last = _get_last_date(conn, code) if incremental else None
            missing_dates = _get_trading_dates(conn, after=last)

            if not missing_dates:
                logger.info(f"{code} 基本面已是最新，跳过")
                results[code] = 0
                continue

            logger.info(f"拉取基本面快照 {code}（将 fill 到 {len(missing_dates)} 个交易日）")
            try:
                data = call_wind(
                    "wss",
                    {"codes": code, "fields": wind_fields, "options": ""},
                )
            except RuntimeError as e:
                logger.error(f"{code} wss 拉取失败: {e}")
                results[code] = 0
                continue

            # wss 返回格式：{"data": [{"code":..,"pe_ttm":..,...}]}
            raw_rows = data.get("data", [])
            if not raw_rows:
                logger.warning(f"{code} wss 无数据")
                results[code] = 0
                continue

            snapshot = raw_rows[0]  # wss 每个 code 返回一行快照

            # forward-fill：将快照值复制到全部缺失交易日
            rows = []
            for td in missing_dates:
                row = {"code": code, "trade_date": td}
                for wind_col, db_col in WSS_FIELDS.items():
                    row[db_col] = snapshot.get(wind_col)
                rows.append(row)

            n = upsert(
                conn,
                table="raw.daily_fundamentals",
                rows=rows,
                conflict_cols=["code", "trade_date"],
                update_cols=list(WSS_FIELDS.values()),
            )
            logger.info(f"{code} 基本面写入 {n} 行")
            results[code] = n

    finally:
        put_conn(conn)

    return results


if __name__ == "__main__":
    sample_codes = ["000001.SZ", "600000.SH", "000002.SZ"]
    load_fundamentals(sample_codes)
