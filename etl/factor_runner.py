"""
Execute LLM-generated factor production scripts.
Usage: python etl/factor_runner.py --script <path>

Pre-built namespace includes:
- get_conn / put_conn / upsert / psycopg2
- numpy (np) / pandas (pd)
- load_processed_data / save_factor_values / save_factor_metadata
"""
import argparse
import sys
import traceback
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from factor_namespace import build_namespace

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--script", required=True)
    args = parser.parse_args()

    if not os.path.isfile(args.script):
        print(f"[错误] 脚本文件不存在: {args.script}", file=sys.stderr)
        sys.exit(1)

    with open(args.script, "r", encoding="utf-8") as f:
        script_content = f.read()

    ns = build_namespace()
    try:
        exec(compile(script_content, args.script, "exec"), ns)
    except Exception:
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
