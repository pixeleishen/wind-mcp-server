"""
查询 raw.* 和 processed.* schema 的表结构、样本数据、行数，输出 JSON 到 stdout。
供服务端 /api/clean/schema-context 调用。
"""
import json
import sys

from base import get_conn, put_conn


def inspect_schema(conn, schema: str) -> list[dict]:
    tables = []
    with conn.cursor() as cur:
        cur.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = %s AND table_type = 'BASE TABLE' "
            "ORDER BY table_name",
            (schema,),
        )
        table_names = [row[0] for row in cur.fetchall()]

        for tname in table_names:
            full = f"{schema}.{tname}"

            # 列信息
            cur.execute(
                "SELECT column_name, data_type "
                "FROM information_schema.columns "
                "WHERE table_schema = %s AND table_name = %s "
                "ORDER BY ordinal_position",
                (schema, tname),
            )
            columns = [{"name": r[0], "type": r[1]} for r in cur.fetchall()]

            # 行数
            cur.execute(f"SELECT COUNT(*) FROM {full}")
            row_count = cur.fetchone()[0]

            # 样本
            cur.execute(f"SELECT * FROM {full} LIMIT 5")
            col_names = [desc[0] for desc in cur.description]
            sample_rows = [
                {col_names[i]: _serialize(val) for i, val in enumerate(row)}
                for row in cur.fetchall()
            ]

            tables.append({
                "table": full,
                "columns": columns,
                "row_count": row_count,
                "sample_rows": sample_rows,
            })
    return tables


def _serialize(val):
    """将不可 JSON 序列化的值转为字符串。"""
    if val is None:
        return None
    if isinstance(val, (int, float, bool, str)):
        return val
    return str(val)


def main():
    conn = get_conn()
    try:
        result = {
            "raw": inspect_schema(conn, "raw"),
            "processed": inspect_schema(conn, "processed"),
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
    finally:
        put_conn(conn)


if __name__ == "__main__":
    main()
