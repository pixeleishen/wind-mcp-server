"""
ETL Clean Agent
功能：从 DB 读取 raw 数据样本 → 填充 prompt 模板 → 调用 LLM →
      提取生成的 process_data() 函数 → 沙盒预览 → 确认后全量写入 processed.feature_series

用法：
  # 清洗宏观指标（indicator_id=1，对应 meta.indicators.id）
  python run_clean_agent.py --type indicator --id 1 --name "中国M2余额" --tag "宏观指标-货币供应" --freq Monthly

  # 清洗资产行情（asset_id=2，对应 meta.assets.id）
  python run_clean_agent.py --type asset --id 2 --name "沪深300" --tag "资产价格-A股权益" --freq Daily

  # 跳过预览直接写库（CI 模式）
  python run_clean_agent.py --type indicator --id 1 --name "中国M2余额" --tag "宏观-货币" --freq Monthly --yes
"""
import argparse
import json
import logging
import os
import re
import sys
import textwrap
import traceback
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
import psycopg2
from base import get_conn, put_conn, upsert
from llm_client import LLMClient

logger = logging.getLogger(__name__)

# ── 路径常量 ────────────────────────────────────────────────
_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
_SYSTEM_PROMPT_PATH = _PROMPTS_DIR / "system_prompt.md"
_USER_PROMPT_PATH   = _PROMPTS_DIR / "user_prompt.md"


# ══════════════════════════════════════════════════════════════
# 1. 从数据库读取 raw 样本
# ══════════════════════════════════════════════════════════════

def _fetch_raw_sample(conn, target_type: str, target_id: int, limit: int = 10) -> pd.DataFrame:
    """从 raw 表按 target_type/target_id 读取最近 limit 行。"""
    if target_type == "indicator":
        sql = """
            SELECT trade_date AS obs_date, indicator_id AS target_id, value
            FROM raw.indicator_series
            WHERE indicator_id = %s
            ORDER BY trade_date DESC
            LIMIT %s
        """
    elif target_type == "asset":
        sql = """
            SELECT trade_date AS obs_date, asset_id AS target_id,
                   open, high, low, close, volume, amount, pct_chg, adj_factor
            FROM raw.daily_prices
            WHERE asset_id = %s
            ORDER BY trade_date DESC
            LIMIT %s
        """
    else:
        raise ValueError(f"target_type 必须是 'indicator' 或 'asset'，收到: {target_type}")

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, (target_id, limit))
        rows = cur.fetchall()

    if not rows:
        raise RuntimeError(f"raw 表中未找到 target_type={target_type}, target_id={target_id} 的数据，请先运行 ETL 入库。")

    df = pd.DataFrame([dict(r) for r in rows])
    df["obs_date"] = pd.to_datetime(df["obs_date"]).dt.strftime("%Y-%m-%d")
    return df.sort_values("obs_date")


def _fetch_raw_full(conn, target_type: str, target_id: int) -> pd.DataFrame:
    """读取全量 raw 数据（用于最终写库）。"""
    if target_type == "indicator":
        sql = """
            SELECT trade_date AS obs_date, indicator_id AS target_id, value
            FROM raw.indicator_series
            WHERE indicator_id = %s
            ORDER BY trade_date
        """
    else:
        sql = """
            SELECT trade_date AS obs_date, asset_id AS target_id,
                   open, high, low, close, volume, amount, pct_chg, adj_factor
            FROM raw.daily_prices
            WHERE asset_id = %s
            ORDER BY trade_date
        """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, (target_id,))
        rows = cur.fetchall()

    df = pd.DataFrame([dict(r) for r in rows])
    df["obs_date"] = pd.to_datetime(df["obs_date"]).dt.strftime("%Y-%m-%d")
    return df


# ══════════════════════════════════════════════════════════════
# 2. 填充 prompt 模板
# ══════════════════════════════════════════════════════════════

def _load_prompt(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"Prompt 文件不存在: {path}")
    return path.read_text(encoding="utf-8")


def _build_user_prompt(
    template: str,
    data_tag: str,
    data_name: str,
    wind_code: str,
    frequency: str,
    target_type: str,
    target_id: int,
    sample_df: pd.DataFrame,
) -> str:
    sample_json = sample_df.to_json(orient="records", force_ascii=False, indent=2)
    replacements = {
        "{{DATA_TAG}}":              data_tag,
        "{{DATA_NAME}}":             data_name,
        "{{WIND_CODE}}":             wind_code,
        "{{FREQUENCY}}":             frequency,
        "{{TARGET_TYPE}}":           f"'{target_type}'",
        "{{TARGET_ID}}":             str(target_id),
        "{{RAW_DATA_JSON_SAMPLE}}":  sample_json,
    }
    prompt = template
    for k, v in replacements.items():
        prompt = prompt.replace(k, v)
    return prompt


# ══════════════════════════════════════════════════════════════
# 3. 从 LLM 回复中提取 Python 代码块
# ══════════════════════════════════════════════════════════════

def _extract_code(llm_response: str) -> str:
    """提取 ```python ... ``` 代码块。"""
    pattern = r"```python\s*(.*?)```"
    matches = re.findall(pattern, llm_response, re.DOTALL)
    if not matches:
        # 降级：如果 LLM 直接输出了裸代码（含 def process_data）
        if "def process_data" in llm_response:
            return llm_response.strip()
        raise ValueError(
            "LLM 回复中未找到 ```python 代码块，也未找到 process_data 函数定义。\n"
            f"原始回复（前 500 字符）:\n{llm_response[:500]}"
        )
    # 取最长的那段（防止 LLM 输出多个小片段）
    return max(matches, key=len).strip()


# ══════════════════════════════════════════════════════════════
# 4. 在沙盒中执行 process_data()
# ══════════════════════════════════════════════════════════════

def _run_in_sandbox(code: str, raw_df: pd.DataFrame, target_type: str, target_id: int) -> pd.DataFrame:
    """
    在受控命名空间中 exec 生成的代码，调用 process_data()，返回结果 DataFrame。
    注意：沙盒模式下 upsert 是 no-op，不真正写库。
    """
    def _noop_upsert(*args, **kwargs):
        return 0

    ns: dict = {
        "pd": pd,
        "np": __import__("numpy"),
        "get_conn": get_conn,
        "put_conn": put_conn,
        "upsert": _noop_upsert,   # 沙盒：禁止写库
        "psycopg2": psycopg2,
    }

    exec(compile(code, "<llm_generated>", "exec"), ns)   # noqa: S102

    if "process_data" not in ns:
        raise ValueError("LLM 生成的代码中未定义 process_data 函数。")

    result = ns["process_data"](raw_df.copy(), target_type, target_id)

    if not isinstance(result, pd.DataFrame):
        raise TypeError(f"process_data 应返回 DataFrame，实际返回: {type(result)}")

    required_cols = {"obs_date", "target_type", "target_id", "raw_value", "transformed_value", "transform_method"}
    missing = required_cols - set(result.columns)
    if missing:
        raise ValueError(f"返回的 DataFrame 缺少必要列: {missing}")

    return result


# ══════════════════════════════════════════════════════════════
# 5. 全量写入 processed.feature_series
# ══════════════════════════════════════════════════════════════

def _write_to_db(conn, result_df: pd.DataFrame) -> int:
    rows = []
    for _, row in result_df.iterrows():
        rows.append({
            "obs_date":          str(row["obs_date"])[:10],
            "target_type":       str(row["target_type"]),
            "target_id":         int(row["target_id"]),
            "raw_value":         float(row["raw_value"])         if pd.notna(row["raw_value"])         else None,
            "transformed_value": float(row["transformed_value"]) if pd.notna(row["transformed_value"]) else None,
            "transform_method":  str(row["transform_method"]),
        })
    return upsert(
        conn,
        table="processed.feature_series",
        rows=rows,
        conflict_cols=["obs_date", "target_type", "target_id", "transform_method"],
        update_cols=["raw_value", "transformed_value"],
    )


# ══════════════════════════════════════════════════════════════
# 6. 主流程
# ══════════════════════════════════════════════════════════════

def run_clean_agent(
    target_type: str,
    target_id: int,
    data_name: str,
    data_tag: str,
    frequency: str,
    wind_code: str = "",
    auto_confirm: bool = False,
) -> int:
    """
    完整流程：raw 样本 → LLM 生成代码 → 沙盒预览 → （确认）→ 全量写库。
    返回写入行数。
    """
    conn = get_conn()
    try:
        # ── Step 1: 读取样本 ──────────────────────────────────
        logger.info(f"[1/5] 读取 raw 样本 (target_type={target_type}, target_id={target_id})")
        sample_df = _fetch_raw_sample(conn, target_type, target_id)
        logger.info(f"      样本 {len(sample_df)} 行，列: {list(sample_df.columns)}")

        # ── Step 2: 构建 prompt ───────────────────────────────
        logger.info("[2/5] 构建 prompt")
        system_prompt = _load_prompt(_SYSTEM_PROMPT_PATH)
        user_template = _load_prompt(_USER_PROMPT_PATH)
        user_prompt   = _build_user_prompt(
            user_template, data_tag, data_name, wind_code,
            frequency, target_type, target_id, sample_df,
        )

        # ── Step 3: 调用 LLM ─────────────────────────────────
        logger.info("[3/5] 调用 LLM 生成 process_data() ...")
        client = LLMClient()
        llm_response = client.generate(user_prompt, system=system_prompt)
        logger.info(f"      LLM 回复长度: {len(llm_response)} 字符")

        code = _extract_code(llm_response)
        logger.info(f"      提取代码 {len(code.splitlines())} 行")

        # ── Step 4: 沙盒预览 ──────────────────────────────────
        logger.info("[4/5] 沙盒执行预览（仅用样本数据，不写库）")
        preview_df = _run_in_sandbox(code, sample_df, target_type, target_id)

        print("\n" + "═" * 60)
        print("【生成的 Python 代码】")
        print("─" * 60)
        print(textwrap.indent(code, "  "))
        print("─" * 60)
        print("【预览输出（前 10 行）】")
        print(preview_df.to_string(index=False))
        print("═" * 60 + "\n")

        # ── Step 5: 确认写库 ──────────────────────────────────
        if not auto_confirm:
            ans = input("结果符合预期？输入 y 确认全量写入，其他键取消: ").strip().lower()
            if ans != "y":
                logger.info("用户取消，未写入数据库。")
                return 0

        logger.info("[5/5] 全量读取 raw 数据并写入 processed.feature_series ...")
        full_df    = _fetch_raw_full(conn, target_type, target_id)
        result_df  = _run_in_sandbox(code, full_df, target_type, target_id)
        # 全量写库时使用真实 upsert
        n = _write_to_db(conn, result_df)
        logger.info(f"      写入 {n} 行到 processed.feature_series")
        return n

    finally:
        put_conn(conn)


# ══════════════════════════════════════════════════════════════
# CLI 入口
# ══════════════════════════════════════════════════════════════

def _parse_args():
    p = argparse.ArgumentParser(description="ETL Clean Agent：LLM 驱动的 raw→processed 转换")
    p.add_argument("--type",  required=True, choices=["asset", "indicator"], dest="target_type",
                   help="数据类型: asset（行情）或 indicator（宏观指标）")
    p.add_argument("--id",    required=True, type=int, dest="target_id",
                   help="meta 表中对应的整数 ID")
    p.add_argument("--name",  required=True, dest="data_name",
                   help="数据名称，如 '中国M2余额'")
    p.add_argument("--tag",   required=True, dest="data_tag",
                   help="数据分类标签，如 '宏观指标-货币供应'")
    p.add_argument("--freq",  required=True, dest="frequency",
                   choices=["Daily", "Monthly", "Quarterly", "Weekly"],
                   help="数据频率")
    p.add_argument("--code",  default="", dest="wind_code",
                   help="Wind 代码（可选，仅用于 prompt 提示）")
    p.add_argument("--yes",   action="store_true", dest="auto_confirm",
                   help="跳过确认步骤，直接写库（适合 CI/批量模式）")
    return p.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    try:
        n = run_clean_agent(
            target_type=args.target_type,
            target_id=args.target_id,
            data_name=args.data_name,
            data_tag=args.data_tag,
            frequency=args.frequency,
            wind_code=args.wind_code,
            auto_confirm=args.auto_confirm,
        )
        print(f"\n完成，共写入 {n} 行。")
    except Exception:
        traceback.print_exc()
        sys.exit(1)
