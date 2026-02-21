"""
全量 ETL 入口：按顺序执行所有入库脚本
用法：python run_all.py [--codes 000001.SZ,600000.SH] [--start 2015-01-01]
"""
import argparse
import logging
import sys

logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="量化研究平台 ETL 全量入库")
    parser.add_argument(
        "--codes",
        default="000001.SZ,600000.SH,000002.SZ",
        help="逗号分隔的资产代码列表",
    )
    parser.add_argument(
        "--macro-codes",
        default="M0001385,M0001227",
        help="逗号分隔的宏观指标代码列表",
    )
    parser.add_argument(
        "--start",
        default="2015-01-01",
        help="历史数据起始日期（YYYY-MM-DD）",
    )
    parser.add_argument(
        "--no-incremental",
        action="store_true",
        help="强制全量重新拉取（忽略已有数据）",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    codes = [c.strip() for c in args.codes.split(",") if c.strip()]
    macro_codes = [c.strip() for c in args.macro_codes.split(",") if c.strip()]
    incremental = not args.no_incremental

    # ── 1. 交易日历 ──────────────────────────────────────────
    logger.info("=== 步骤 1/4：交易日历 ===")
    from load_tdays import load_tdays
    try:
        n = load_tdays(start=args.start)
        logger.info(f"交易日历完成，共 {n} 行")
    except Exception as e:
        logger.error(f"交易日历失败: {e}")
        sys.exit(1)

    # ── 2. 日度行情 ──────────────────────────────────────────
    logger.info("=== 步骤 2/4：日度行情 ===")
    from load_prices import load_prices
    try:
        results = load_prices(codes, start=args.start, incremental=incremental)
        total = sum(results.values())
        logger.info(f"日度行情完成，共写入 {total} 行")
    except Exception as e:
        logger.error(f"日度行情失败: {e}")
        sys.exit(1)

    # ── 3. 基本面快照 ────────────────────────────────────────
    logger.info("=== 步骤 3/4：基本面快照 ===")
    from load_fundamentals import load_fundamentals
    try:
        results = load_fundamentals(codes, incremental=incremental)
        total = sum(results.values())
        logger.info(f"基本面快照完成，共写入 {total} 行")
    except Exception as e:
        logger.error(f"基本面快照失败: {e}")
        sys.exit(1)

    # ── 4. 宏观指标 ──────────────────────────────────────────
    logger.info("=== 步骤 4/4：宏观指标 ===")
    from load_macro import load_macro
    try:
        results = load_macro(macro_codes, start=args.start, incremental=incremental)
        total = sum(results.values())
        logger.info(f"宏观指标完成，共写入 {total} 行")
    except Exception as e:
        logger.error(f"宏观指标失败: {e}")
        sys.exit(1)

    logger.info("=== 全部 ETL 完成 ===")


if __name__ == "__main__":
    main()
