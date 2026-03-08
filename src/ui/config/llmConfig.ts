// LLM 配置，持久化到 localStorage
export type LLMProvider = "openai" | "anthropic" | "deepseek" | "gemini" | "ollama";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
}

const STORAGE_KEY = "llm_config";

const PROVIDER_DEFAULTS: Record<LLMProvider, string> = {
  openai:    "o3",
  anthropic: "claude-opus-4-5",
  deepseek:  "deepseek-chat",
  gemini:    "gemini-2.5-pro",
  ollama:    "qwen2.5-coder:32b",
};

export const PROVIDER_MODELS: Record<LLMProvider, string[]> = {
  openai: [
    "auto",
    "o3",
    "o4-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4o",
    "gpt-4o-mini",
    "o3-mini",
    "o1",
    "o1-mini",
  ],
  anthropic: [
    "auto",
    "claude-opus-4-6",
    "claude-sonnet-4-6-thinking",
    "claude-opus-4-5-20251101",
    "claude-opus-4-5-20251101-thinking",
    "claude-sonnet-4-5-20250929",
    "claude-sonnet-4-5-20250929-thinking",
    "claude-haiku-4-5-20251001",
  ],
  deepseek: [
    "auto",
    "deepseek-chat",
    "deepseek-reasoner",
  ],
  gemini: [
    "auto",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
  ],
  ollama: [
    "auto",
    "qwen2.5-coder:32b",
    "qwen2.5:72b",
    "llama3.3:70b",
    "deepseek-r1:32b",
    "deepseek-v2.5:236b",
    "codellama:70b",
  ],
};

export const PROVIDER_LABELS: Record<LLMProvider, string> = {
  openai:    "OpenAI",
  anthropic: "Anthropic",
  deepseek:  "DeepSeek",
  gemini:    "Google Gemini",
  ollama:    "Ollama（本地）",
};

export function defaultModel(provider: LLMProvider): string {
  return PROVIDER_DEFAULTS[provider];
}

export function loadLLMConfig(): LLMConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { provider: parsed.provider, model: parsed.model };
    }
  } catch { /* ignore */ }
  return { provider: "openai", model: "o3" };
}

export function saveLLMConfig(config: LLMConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export interface ServerKeyInfo {
  hasKey: boolean;
  url: string;
}

export interface ServerProviderConfig {
  apiKey: string;   // masked on GET, full on PUT
  baseUrl: string;
}

export interface ServerMcpConfig {
  providers: Record<string, ServerProviderConfig>;
}

export async function loadServerKeys(): Promise<Record<string, ServerKeyInfo>> {
  try {
    const res = await fetch("/api/llm/keys");
    const data = await res.json() as { keys: Record<string, ServerKeyInfo> };
    return data.keys;
  } catch {
    return {};
  }
}

export async function loadServerConfig(): Promise<ServerMcpConfig> {
  const res = await fetch("/api/llm/config");
  const data = await res.json() as { ok: boolean; config: ServerMcpConfig };
  return data.config;
}

export async function saveServerConfig(
  providers: Record<string, Partial<ServerProviderConfig>>,
): Promise<void> {
  const res = await fetch("/api/llm/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providers }),
  });
  const data = await res.json() as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(data.error ?? "Failed to save config");
}

export async function callLLM(
  config: LLMConfig,
  prompt: string,
  system?: string,
): Promise<string> {
  const res = await fetch("/api/llm/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: config.provider,
      apiKey:   "",
      model:    config.model,
      baseUrl:  "",
      prompt,
      system,
    }),
  });
  const data = await res.json() as { ok: boolean; text?: string; error?: string };
  if (!data.ok) throw new Error(data.error ?? "LLM request failed");
  return data.text!;
}
