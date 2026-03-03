"""
ETL 配置：数据库连接 + Wind 参数 + LLM 配置
"""
import os

# 自动加载同目录下的 .env 文件（需要 pip install python-dotenv）
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

# ── 数据库连接 ──────────────────────────────────────────────
DB_HOST     = os.getenv("DB_HOST",     "localhost")
DB_PORT     = int(os.getenv("DB_PORT", "5432"))
DB_NAME     = os.getenv("DB_NAME",     "quantdb")
DB_USER     = os.getenv("DB_USER",     "quant")
DB_PASSWORD = os.getenv("DB_PASSWORD", "quant123")

DB_DSN = (
    f"postgresql://{DB_USER}:{DB_PASSWORD}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# ── LLM 配置（从 config/llm-keys.json 实时读取，环境变量可覆盖）─
import pathlib as _pl, json as _json

_KEYS_FILE = _pl.Path(__file__).parent.parent / "config" / "llm-keys.json"

def load_llm_config(provider: str | None = None) -> dict:
    """
    实时读取 llm-keys.json，返回指定 provider 的配置字典。
    每次调用都重新读文件，修改 json 后无需重启进程。
    优先级：环境变量 > llm-keys.json
    返回: {"provider": str, "api_key": str, "base_url": str, "model": str}
    """
    try:
        keys = _json.loads(_KEYS_FILE.read_text(encoding="utf-8")) if _KEYS_FILE.exists() else {}
    except Exception:
        keys = {}

    p   = os.getenv("LLM_PROVIDER", provider or "anthropic")
    cfg = keys.get(p, {})
    return {
        "provider": p,
        "api_key":  os.getenv("LLM_API_KEY",  "") or cfg.get("key",   ""),
        "base_url": os.getenv("LLM_BASE_URL", "") or cfg.get("url",   ""),
        "model":    os.getenv("LLM_MODEL",    "") or cfg.get("model", "claude-sonnet-4-6"),
    }

# 模块级常量仅保留 provider 和 model 供其他模块 import；
# api_key / base_url 请通过 load_llm_config() 实时获取。
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "anthropic")
LLM_MODEL    = os.getenv("LLM_MODEL",    "claude-sonnet-4-6")

# ── Wind Python bridge 路径 ─────────────────────────────────
import pathlib
BRIDGE_DIR = pathlib.Path(__file__).parent.parent / "src" / "python"

# ── 日志 ────────────────────────────────────────────────────
import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
