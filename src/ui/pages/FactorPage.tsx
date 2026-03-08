import { useState, useRef, useEffect, useCallback } from "react";
import { loadLLMConfig, callLLM } from "../config/llmConfig";
import styles from "./FactorPage.module.css";

type RunStatus = "idle" | "running" | "success" | "error";

interface Message {
  role: "user" | "assistant";
  content: string;
  script?: string;
  runStatus?: RunStatus;
  runLogs?: string;
}

interface Factor {
  name: string;
  description: string;
  source: string;
  created: string;
}

const SYSTEM_PREFIX = `你是一个量化因子生产助手。用户会提供研究论文内容和因子需求描述，你需要生成可直接运行的 Python 脚本。

## 可用环境
- \`conn = get_conn()\` — 获取 psycopg2 数据库连接
- \`put_conn(conn)\` — 归还连接
- \`load_processed_data(conn, table, start_date=None, end_date=None)\` — 从 processed.* 加载数据，返回 DataFrame
- \`save_factor_values(conn, factor_name, df, asset_level=True)\` — 保存因子值到 factors.asset_values 或 factors.values
- \`save_factor_metadata(conn, factor_name, description, python_code, source_paper=None)\` — 保存因子元数据
- \`np\`, \`pd\` — numpy, pandas 已导入

## 规则
1. 因子计算结果必须写入 factors.asset_values（资产级）或 factors.values（组合级）
2. 使用 \`load_processed_data()\` 读取 processed.* 数据
3. 用 print() 输出进度信息
4. 完成后务必调用 put_conn(conn) 归还连接
5. 生成完整可运行的脚本，放在一个 \`\`\`python 代码块中
6. 因子名称使用英文，避免特殊字符`;

function extractPython(text: string): string | undefined {
  const m = text.match(/```python\s*\n([\s\S]*?)```/);
  return m ? m[1].trim() : undefined;
}

export default function FactorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pdfText, setPdfText] = useState<string>("");
  const [pdfName, setPdfName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [schemaCtx, setSchemaCtx] = useState<string>("");
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [factors, setFactors] = useState<Factor[]>([]);
  const messagesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/factors/schema-context")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setSchemaCtx(JSON.stringify(d.data, null, 2));
        else console.error("schema-context error:", d.error);
      })
      .catch((e) => console.error("schema-context fetch failed:", e))
      .finally(() => setSchemaLoading(false));
  }, []);

  useEffect(() => {
    loadFactorList();
  }, []);

  const loadFactorList = () => {
    fetch("/api/factors/list")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setFactors(d.factors);
      })
      .catch((e) => console.error("factors/list failed:", e));
  };

  const scrollBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (messagesRef.current) {
        messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(scrollBottom, [messages, scrollBottom]);

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const res = await fetch("/api/factors/upload-pdf", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.ok) {
        setPdfText(data.text);
        setPdfName(file.name);
      } else {
        alert(`PDF 上传失败: ${data.error}`);
      }
    } catch (err) {
      alert(`PDF 上传失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: Message = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setSending(true);

    try {
      const config = loadLLMConfig();
      let system = SYSTEM_PREFIX;

      if (schemaCtx) {
        system += `\n\n## 数据库 Schema (processed.*)\n${schemaCtx}`;
      }

      if (pdfText) {
        system += `\n\n## 研究论文内容\n${pdfText.slice(0, 20000)}`;
      }

      const parts = updated.map(
        (m) => `${m.role === "user" ? "用户" : "助手"}: ${m.content}`
      );
      const prompt = parts.join("\n\n");

      const reply = await callLLM(config, prompt, system);
      const script = extractPython(reply);
      const assistantMsg: Message = {
        role: "assistant",
        content: reply,
        script,
        runStatus: script ? "idle" : undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg: Message = {
        role: "assistant",
        content: `[错误] ${err instanceof Error ? err.message : String(err)}`,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  }

  async function handleRun(idx: number) {
    const msg = messages[idx];
    if (!msg.script || msg.runStatus === "running") return;

    setMessages((prev) =>
      prev.map((m, i) =>
        i === idx ? { ...m, runStatus: "running" as RunStatus, runLogs: "" } : m
      )
    );

    try {
      const res = await fetch("/api/factors/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: msg.script }),
      });

      if (res.status === 409) {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === idx
              ? { ...m, runStatus: "error" as RunStatus, runLogs: "[错误] 已有因子任务在运行中" }
              : m
          )
        );
        return;
      }

      if (!res.ok || !res.body) {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === idx
              ? { ...m, runStatus: "error" as RunStatus, runLogs: `[错误] 请求失败: ${res.status}` }
              : m
          )
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.replace(/^data: /, "");
          if (!line) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.type === "log") {
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === idx ? { ...m, runLogs: (m.runLogs ?? "") + ev.text + "\n" } : m
                )
              );
              scrollBottom();
            } else if (ev.type === "done") {
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === idx ? { ...m, runStatus: "success" as RunStatus } : m
                )
              );
              loadFactorList();
            } else if (ev.type === "error") {
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === idx
                    ? {
                        ...m,
                        runStatus: "error" as RunStatus,
                        runLogs:
                          (m.runLogs ?? "") +
                          (ev.text ? `[错误] ${ev.text}\n` : `[进程退出] code=${ev.code}\n`),
                      }
                    : m
                )
              );
            }
          } catch {
            // ignore
          }
        }
      }

      setMessages((prev) =>
        prev.map((m, i) =>
          i === idx && m.runStatus === "running" ? { ...m, runStatus: "error" as RunStatus } : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m, i) =>
          i === idx
            ? {
                ...m,
                runStatus: "error" as RunStatus,
                runLogs: (m.runLogs ?? "") + `[错误] ${err instanceof Error ? err.message : String(err)}\n`,
              }
            : m
        )
      );
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function renderContent(text: string, script?: string) {
    if (script) {
      const before = text.split(/```python\s*\n/)[0].trim();
      const afterMatch = text.match(/```python[\s\S]*?```([\s\S]*)/);
      const after = afterMatch ? afterMatch[1].trim() : "";
      return (
        <>
          {before && <div>{before}</div>}
          {after && <div style={{ marginTop: "0.5rem" }}>{after}</div>}
        </>
      );
    }
    return <>{text}</>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.uploadSection}>
        <input
          type="file"
          accept=".pdf"
          ref={fileInputRef}
          onChange={handlePdfUpload}
          style={{ display: "none" }}
        />
        <button
          className={styles.uploadBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "上传中..." : pdfName ? `📄 ${pdfName}` : "上传 PDF"}
        </button>
        {pdfName && (
          <button
            className={styles.clearBtn}
            onClick={() => {
              setPdfText("");
              setPdfName("");
            }}
          >
            清除
          </button>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.chatSection}>
          <div className={styles.messages} ref={messagesRef}>
            {schemaLoading && <div className={styles.loading}>加载数据库 Schema…</div>}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`${styles.msgRow} ${
                  msg.role === "user" ? styles.msgRowUser : styles.msgRowAssistant
                }`}
              >
                <div
                  className={`${styles.bubble} ${
                    msg.role === "user" ? styles.bubbleUser : styles.bubbleAssistant
                  }`}
                >
                  {renderContent(msg.content, msg.script)}

                  {msg.script && (
                    <div className={styles.codeBlock}>
                      <pre>{msg.script}</pre>
                      <button
                        className={styles.runBtn}
                        disabled={msg.runStatus === "running"}
                        onClick={() => handleRun(i)}
                      >
                        {msg.runStatus === "running" ? "运行中…" : "运行"}
                      </button>
                      {msg.runStatus === "running" && (
                        <span className={`${styles.statusTag} ${styles.statusRunning}`}>运行中</span>
                      )}
                      {msg.runStatus === "success" && (
                        <span className={`${styles.statusTag} ${styles.statusSuccess}`}>完成</span>
                      )}
                      {msg.runStatus === "error" && (
                        <span className={`${styles.statusTag} ${styles.statusError}`}>失败</span>
                      )}
                    </div>
                  )}

                  {msg.runLogs && (
                    <pre className={styles.logArea}>{msg.runLogs}</pre>
                  )}
                </div>
              </div>
            ))}
            {sending && <div className={styles.loading}>LLM 生成中…</div>}
          </div>

          <div className={styles.inputBar}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="描述因子需求…"
              disabled={sending}
              rows={1}
            />
            <button
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={sending || !input.trim()}
            >
              发送
            </button>
          </div>
        </div>

        <div className={styles.factorList}>
          <h3>已生成因子</h3>
          {factors.length === 0 ? (
            <div className={styles.emptyState}>暂无因子</div>
          ) : (
            <ul>
              {factors.map((f) => (
                <li key={f.name}>
                  <div className={styles.factorName}>{f.name}</div>
                  {f.description && <div className={styles.factorDesc}>{f.description}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
