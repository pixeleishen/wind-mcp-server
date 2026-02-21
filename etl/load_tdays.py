"""
交易日历入库
Wind tdays → raw.trading_calendar
"""
import logging
from datetime import date

from base import call_wind, get_conn, put_conn, upsert

logger = logging.getLogger(__name__)


def load_tdays(start: str = "2000-01-01", end: str | None = None) -> int:
    """
    拉取 [start, end] 区间内的交易日并写入 raw.trading_calendar。
    end 默认为今天。
    """
    if end is None:
        end = date.today().strftime("%Y-%m-%d")

    logger.info(f"拉取交易日历 {start} → {end}")
    data = call_wind("tdays", {"startTime": start, "endTime": end, "options": ""})

    # tdays 返回格式：{"dates": ["2000-01-04", ...]}
    dates = data.get("dates", [])
    if not dates:
        logger.warning("tdays 返回空结果")
        return 0

    rows = [{"trade_date": d} for d in dates]

    conn = get_conn()
    try:
        n = upsert(
            conn,
            table="raw.trading_calendar",
            rows=rows,
            conflict_cols=["trade_date"],
        )
        logger.info(f"交易日历写入 {n} 行")
        return n
    finally:
        put_conn(conn)


if __name__ == "__main__":
    load_tdays()
