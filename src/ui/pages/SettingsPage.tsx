import { useState, useEffect } from "react";
import {
  loadLLMConfig, saveLLMConfig, defaultModel, callLLM,
  loadServerKeys, PROVIDER_LABELS, PROVIDER_MODELS,
  type LLMConfig, type LLMProvider,
} from "../config/llmConfig";
import styles from "./SettingsPage.module.css";

const PROVIDERS = Object.keys(PROVIDER_LABELS) as LLMProvider[];

export default function SettingsPage() {
  const [config, setConfig] = useState<LLMConfig>(loadLLMConfig);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [serverKeys, setServerKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadServerKeys().then(setServerKeys);
  }, []);

  const hasServerKey = !!serverKeys[config.provider];

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
    if (!config.apiKey && !hasServerKey) {
      setTestResult({ ok: false, msg: "请先填写 API Key" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const reply = await callLLM(config, "请回复「连接成功」四个字，不要其他内容。");
      setTestResult({ ok: true, msg: `✓ 连接成功：${reply.trim()}` });
    } catch (e) {
      setTestResult({ ok: false, msg: `✗ ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setTesting(false);
    }
  }

  const baseUrlPlaceholder =
    config.provider === "ollama"
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
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label>API Key</label>
          {hasServerKey && !config.apiKey ? (
            <>
              <input type="text" value="已配置服务端密钥" readOnly disabled />
              <span className={styles.hint}>如需覆盖，可在下方输入自定义 Key</span>
            </>
          ) : (
            <>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => set("apiKey", e.target.value)}
                placeholder={config.provider === "ollama" ? "本地模型无需填写" : "sk-xxxx"}
                autoComplete="off"
              />
              <span className={styles.hint}>
                {hasServerKey
                  ? "当前使用自定义 Key（清空后将回退到服务端密钥）"
                  : "仅存储在浏览器 localStorage，不会上传到任何服务器"}
              </span>
            </>
          )}
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
          <label>Base URL（可选）</label>
          <input
            type="text"
            value={config.baseUrl}
            onChange={(e) => set("baseUrl", e.target.value)}
            placeholder={baseUrlPlaceholder}
          />
        </div>

        <div className={styles.actions}>
          <button className={styles.save} onClick={handleSave}>保存</button>
          <button className={styles.testBtn} onClick={handleTest} disabled={testing}>
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
