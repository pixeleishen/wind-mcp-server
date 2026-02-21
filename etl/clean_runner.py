"""
执行 LLM 生成的数据清洗脚本。
用法: python etl/clean_runner.py --script <path>

预置命名空间包含 get_conn / put_conn / upsert / psycopg2，
以及可选的 numpy / pandas / scipy.stats。
"""
import argparse
import sys
import traceback

# 确保 etl/ 目录在 sys.path 中，以便 import base / config
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psycopg2
from base import get_conn, put_conn, upsert


def build_namespace() -> dict:
    ns = {
        "get_conn": get_conn,
        "put_conn": put_conn,
        "upsert": upsert,
        "psycopg2": psycopg2,
    }
    # 可选依赖
    for mod_name in ("numpy", "pandas"):
        try:
            ns[mod_name] = __import__(mod_name)
        except ImportError:
            pass
    try:
        import scipy.stats
        ns["scipy"] = __import__("scipy")
    except ImportError:
        pass
    return ns


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--script", required=True, help="要执行的 Python 脚本路径")
    args = parser.parse_args()

    script_path = args.script
    if not os.path.isfile(script_path):
        print(f"[错误] 脚本文件不存在: {script_path}", file=sys.stderr)
        sys.exit(1)

    with open(script_path, "r", encoding="utf-8") as f:
        script_content = f.read()

    ns = build_namespace()
    try:
        exec(compile(script_content, script_path, "exec"), ns)
    except Exception:
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
