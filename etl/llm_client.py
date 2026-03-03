"""
LLM 客户端：统一封装 OpenAI / Anthropic / DeepSeek / Ollama
用法：
    from llm_client import LLMClient
    client = LLMClient()          # 从 config.py 读取配置
    response = client.generate("请帮我生成一个因子计算脚本...")
    print(response)
"""
import logging
from typing import Any

from config import LLM_PROVIDER, LLM_MODEL, load_llm_config

logger = logging.getLogger(__name__)

# ── Provider 默认 base URL ─────────────────────────────────
_DEFAULTS: dict[str, str] = {
    "openai":    "https://api.openai.com/v1",
    "anthropic": "https://api.anthropic.com",
    "deepseek":  "https://api.deepseek.com/v1",
    "ollama":    "http://localhost:11434",
    "gemini":    "",   # 由 llm-keys.json 提供代理 URL
}


class LLMClient:
    def __init__(
        self,
        provider: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
    ):
        # 每次实例化都实时读取 llm-keys.json，key 改了无需重启
        cfg = load_llm_config(provider)
        self.provider = cfg["provider"].lower()
        self.api_key  = api_key  or cfg["api_key"]
        self.model    = model    or cfg["model"]
        self.base_url = (base_url or cfg["base_url"] or _DEFAULTS.get(self.provider, "")).rstrip("/")

        if self.provider not in _DEFAULTS:
            raise ValueError(
                f"不支持的 provider: {self.provider}，"
                f"可选值：{list(_DEFAULTS.keys())}"
            )

    # ── 公共接口 ───────────────────────────────────────────
    def generate(self, prompt: str, system: str | None = None) -> str:
        """发送 prompt，返回模型回复文本。"""
        logger.info(f"LLM [{self.provider}/{self.model}] 请求中...")
        # 若配置了自定义 base_url（代理），一律走 OpenAI 兼容接口
        is_proxy = self.base_url and self.base_url not in (
            _DEFAULTS.get("anthropic", ""), "https://api.anthropic.com"
        )
        if self.provider == "anthropic" and not is_proxy:
            return self._call_anthropic(prompt, system)
        else:
            # openai / deepseek / ollama / gemini / 代理 anthropic
            return self._call_openai_compat(prompt, system)

    # ── OpenAI 兼容接口（OpenAI / DeepSeek / Ollama）──────
    def _call_openai_compat(self, prompt: str, system: str | None) -> str:
        import urllib.request, json

        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload = json.dumps({
            "model":    self.model,
            "messages": messages,
        }).encode()

        headers: dict[str, str] = {
            "Content-Type":  "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        url = f"{self.base_url}/chat/completions"
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")

        with urllib.request.urlopen(req, timeout=120) as resp:
            body: dict[str, Any] = json.loads(resp.read().decode())

        return body["choices"][0]["message"]["content"]

    # ── Anthropic Messages API ─────────────────────────────
    def _call_anthropic(self, prompt: str, system: str | None) -> str:
        import urllib.request, json

        payload_dict: dict[str, Any] = {
            "model":      self.model,
            "max_tokens": 8192,
            "messages":   [{"role": "user", "content": prompt}],
        }
        if system:
            payload_dict["system"] = system

        payload = json.dumps(payload_dict).encode()
        headers = {
            "Content-Type":      "application/json",
            "x-api-key":         self.api_key,
            "anthropic-version": "2023-06-01",
        }

        url = f"{self.base_url}/v1/messages"
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")

        with urllib.request.urlopen(req, timeout=120) as resp:
            body: dict[str, Any] = json.loads(resp.read().decode())

        return body["content"][0]["text"]


# ── 便捷函数 ───────────────────────────────────────────────
def generate(prompt: str, system: str | None = None, **kwargs: Any) -> str:
    """使用全局配置快速调用 LLM。"""
    return LLMClient(**kwargs).generate(prompt, system)
