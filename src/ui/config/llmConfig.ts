// LLM 配置，持久化到 localStorage
export type LLMProvider = "openai" | "anthropic" | "deepseek" | "gemini" | "ollama";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
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
    "claude-opus-4-5",
    "claude-opus-4-0",
    "claude-sonnet-4-5",
    "claude-sonnet-4-0",
    "claude-haiku-3-5",
  ],
  deepseek: [
    "deepseek-chat",
    "deepseek-reasoner",
  ],
  gemini: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
  ],
  ollama: [
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
    if (raw) return JSON.parse(raw) as LLMConfig;
  } catch { /* ignore */ }
  return { provider: "openai", apiKey: "", model: "o3", baseUrl: "" };
}

export function saveLLMConfig(config: LLMConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function loadServerKeys(): Promise<Record<string, boolean>> {
  try {
    const res = await fetch("/api/llm/keys");
    const data = await res.json() as { keys: Record<string, boolean> };
    return data.keys;
  } catch {
    return {};
  }
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
      apiKey:   config.apiKey || "",
      model:    config.model,
      baseUrl:  config.baseUrl,
      prompt,
      system,
    }),
  });
  const data = await res.json() as { ok: boolean; text?: string; error?: string };
  if (!data.ok) throw new Error(data.error ?? "LLM request failed");
  return data.text!;
}
