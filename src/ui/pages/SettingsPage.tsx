import { useState, useEffect } from "react";
import {
  loadLLMConfig, saveLLMConfig, defaultModel, callLLM,
  loadServerKeys, PROVIDER_LABELS, PROVIDER_MODELS,
  type LLMConfig, type LLMProvider, type ServerKeyInfo,
} from "../config/llmConfig";
import styles from "./SettingsPage.module.css";

const PROVIDERS = Object.keys(PROVIDER_LABELS) as LLMProvider[];

export default function SettingsPage() {
  const [config, setConfig] = useState<LLMConfig>(loadLLMConfig);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [serverKeys, setServerKeys] = useState<Record<string, ServerKeyInfo>>({});

  useEffect(() => {
    loadServerKeys().then(setServerKeys);
  }, []);

  const info = serverKeys[config.provider];
  const hasServerKey = info?.hasKey ?? false;
  const serverUrl = info?.url ?? "";
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

  const baseUrlPlaceholder = serverUrl
    ? `服务端配置: ${serverUrl}`
    : config.provider === "ollama"
      ? "http://localhost:11434"
      : "留空使用默认地址，或填写代理 URL";

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2>LLM 模型配置</h2>

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
          <label>API Key</label>
          <div className={styles.keyStatus}>
            {hasServerKey
              ? <span className={styles.keyOk}>已在服务端配置</span>
              : config.provider === "ollama"
                ? <span className={styles.keyHint}>本地模型无需 Key</span>
                : <span className={styles.keyMissing}>未配置（请在 config/llm-keys.json 中设置）</span>
            }
          </div>
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
          <label>Base URL（可选覆盖）</label>
          <input
            type="text"
            value={config.baseUrl}
            onChange={(e) => set("baseUrl", e.target.value)}
            placeholder={baseUrlPlaceholder}
          />
          <span className={styles.hint}>
            留空则使用服务端配置的 URL，服务端也未配置则使用默认地址
          </span>
        </div>

        <div className={styles.actions}>
          <button className={styles.save} onClick={handleSave}>保存</button>
          <button
            className={styles.testBtn}
            onClick={handleTest}
            disabled={testing || !canTest}
            title={canTest ? "" : "请先在 config/llm-keys.json 中配置 API Key"}
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
