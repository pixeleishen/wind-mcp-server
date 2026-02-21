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

# ── LLM 配置 ────────────────────────────────────────────────
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai")   # openai | anthropic | deepseek | ollama
LLM_API_KEY  = os.getenv("LLM_API_KEY",  "")
LLM_MODEL    = os.getenv("LLM_MODEL",    "gpt-4o")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "")         # 留空使用 provider 默认地址

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
