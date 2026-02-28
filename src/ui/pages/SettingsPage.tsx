import { useState, useEffect } from "react";
import {
  loadLLMConfig, saveLLMConfig, defaultModel, callLLM,
  loadServerKeys, loadServerConfig, saveServerConfig,
  PROVIDER_LABELS, PROVIDER_MODELS,
  type LLMConfig, type LLMProvider, type ServerKeyInfo,
} from "../config/llmConfig";
import styles from "./SettingsPage.module.css";

const PROVIDERS = Object.keys(PROVIDER_LABELS) as LLMProvider[];

export default function SettingsPage() {
  const [config, setConfig] = useState<LLMConfig>(loadLLMConfig);
  const [saved, setSaved] = useState(false);
  const [serverSaved, setServerSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [serverKeys, setServerKeys] = useState<Record<string, ServerKeyInfo>>({});

  // Per-provider editable fields
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [baseUrls, setBaseUrls] = useState<Record<string, string>>({});
  const [keyDirty, setKeyDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadServerKeys().then(setServerKeys);
    loadServerConfig().then((cfg) => {
      const keys: Record<string, string> = {};
      const urls: Record<string, string> = {};
      for (const [name, p] of Object.entries(cfg.providers)) {
        keys[name] = p.apiKey;
        urls[name] = p.baseUrl;
      }
      setApiKeys(keys);
      setBaseUrls(urls);
    }).catch(() => {});
  }, []);

  const info = serverKeys[config.provider];
  const hasServerKey = info?.hasKey ?? false;
  const canTest = hasServerKey || config.provider === "ollama";

  function set<K extends keyof LLMConfig>(key: K, value: LLMConfig[K]) {
    setSaved(false);
    setTestResult(null);
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function handleProviderChange(p: LLMProvider) {
    setSaved(false);
    setTestResult(null);
    setConfig((prev) => ({
      ...prev,
      provider: p,
      model: defaultModel(p),
      baseUrl: "",
    }));
  }

  function handleSave() {
    saveLLMConfig(config);
    setSaved(true);
  }

  async function handleSaveServer() {
    setSaving(true);
    setServerSaved(false);
    try {
      const patch: Record<string, { apiKey?: string; baseUrl?: string }> = {};
      for (const p of PROVIDERS) {
        const entry: { apiKey?: string; baseUrl?: string } = {};
        if (keyDirty[p]) entry.apiKey = apiKeys[p] ?? "";
        entry.baseUrl = baseUrls[p] ?? "";
        patch[p] = entry;
      }
      await saveServerConfig(patch);
      setServerSaved(true);
      setKeyDirty({});
      // Refresh server key status
      const fresh = await loadServerKeys();
      setServerKeys(fresh);
    } catch (e) {
      setTestResult({ ok: false, msg: `保存失败：${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!canTest) return;
    setTesting(true);
    setTestResult(null);
    try {
      const reply = await callLLM(config, "请回复「连接成功」四个字，不要其他内容。");
      setTestResult({ ok: true, msg: `连接成功：${reply.trim()}` });
    } catch (e) {
      setTestResult({ ok: false, msg: `${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className={styles.page}>
      {/* ── Server Config Card: API Keys & Endpoints ── */}
      <div className={styles.card}>
        <h2>服务端配置（mcp-config.json）</h2>
        <span className={styles.hint}>
          API Key 和 Endpoint 保存到服务端 config/mcp-config.json，所有客户端共享
        </span>

        {PROVIDERS.map((p) => {
          const pInfo = serverKeys[p];
          const hasKey = pInfo?.hasKey ?? false;
          return (
            <div key={p} className={styles.providerRow}>
              <div className={styles.providerHeader}>
                <span className={styles.providerName}>{PROVIDER_LABELS[p]}</span>
                {hasKey
                  ? <span className={styles.badge}>已配置</span>
                  : p === "ollama"
                    ? <span className={styles.badgeLocal}>本地</span>
                    : <span className={styles.badgeMissing}>未配置</span>
                }
              </div>
              <div className={styles.providerFields}>
                <div className={styles.fieldInline}>
                  <label>API Key</label>
                  <input
                    type="password"
                    value={apiKeys[p] ?? ""}
                    placeholder={p === "ollama" ? "本地模型无需 Key" : "sk-..."}
                    onChange={(e) => {
                      setApiKeys((prev) => ({ ...prev, [p]: e.target.value }));
                      setKeyDirty((prev) => ({ ...prev, [p]: true }));
                      setServerSaved(false);
                    }}
                  />
                </div>
                <div className={styles.fieldInline}>
                  <label>Endpoint</label>
                  <input
                    type="text"
                    value={baseUrls[p] ?? ""}
                    placeholder="https://..."
                    onChange={(e) => {
                      setBaseUrls((prev) => ({ ...prev, [p]: e.target.value }));
                      setServerSaved(false);
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        <div className={styles.actions}>
          <button
            className={styles.save}
            onClick={handleSaveServer}
            disabled={saving}
          >
            {saving ? "保存中…" : "保存到服务端"}
          </button>
          {serverSaved && <span className={styles.saved}>已保存</span>}
        </div>
      </div>

      {/* ── Client Config Card: Model Selection & Test ── */}
      <div className={styles.card}>
        <h2>客户端模型配置</h2>

        <div className={styles.field}>
          <label>Provider</label>
          <select
            value={config.provider}
            onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
          >
            {PROVIDERS.map((p) => {
              const pInfo = serverKeys[p];
              const status = pInfo?.hasKey ? " (已配置)" : "";
              return <option key={p} value={p}>{PROVIDER_LABELS[p]}{status}</option>;
            })}
          </select>
        </div>

        <div className={styles.field}>
          <label>模型名</label>
          <select
            value={config.model}
            onChange={(e) => set("model", e.target.value)}
          >
            {PROVIDER_MODELS[config.provider].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label>Base URL 覆盖（可选）</label>
          <input
            type="text"
            value={config.baseUrl}
            onChange={(e) => set("baseUrl", e.target.value)}
            placeholder="留空使用服务端配置的 Endpoint"
          />
          <span className={styles.hint}>
            仅覆盖本客户端，不影响服务端配置
          </span>
        </div>

        <div className={styles.actions}>
          <button className={styles.save} onClick={handleSave}>保存</button>
          <button
            className={styles.testBtn}
            onClick={handleTest}
            disabled={testing || !canTest}
            title={canTest ? "" : "请先在上方配置 API Key"}
          >
            {testing ? "测试中…" : "测试连接"}
          </button>
          {saved && <span className={styles.saved}>已保存</span>}
        </div>

        {testResult && (
          <div className={`${styles.testResult} ${testResult.ok ? styles.ok : styles.err}`}>
            {testResult.msg}
          </div>
        )}
      </div>
    </div>
  );
}
