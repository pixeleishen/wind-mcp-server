import { useState, useRef, useEffect, useCallback } from "react";
import { loadLLMConfig, callLLM } from "../config/llmConfig";
import styles from "./CleanPage.module.css";

type RunStatus = "idle" | "running" | "success" | "error";

interface Message {
  role: "user" | "assistant";
  content: string;
  script?: string;
  runStatus?: RunStatus;
  runLogs?: string;
}

const SYSTEM_PREFIX = `你是一个量化数据清洗助手。用户会描述数据清洗需求，你需要生成可直接运行的 Python 脚本。

## 可用环境
- \`conn = get_conn()\` — 获取 psycopg2 数据库连接
- \`put_conn(conn)\` — 归还连接
- \`upsert(conn, table, rows, conflict_cols, update_cols)\` — 批量 upsert
- \`psycopg2\` — 已导入
- \`numpy\`, \`pandas\`, \`scipy.stats\` — 如已安装则可用

## 规则
1. 清洗结果必须写入 processed.* schema（如 processed.daily_prices_cleaned）
2. 使用 CREATE TABLE IF NOT EXISTS 创建目标表
3. 用 print() 输出进度信息
4. 完成后务必调用 put_conn(conn) 归还连接
5. 生成完整可运行的脚本，放在一个 \`\`\`python 代码块中`;

function extractPython(text: string): string | undefined {
  const m = text.match(/```python\s*\n([\s\S]*?)```/);
  return m ? m[1].trim() : undefined;
}

export default function CleanPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [schemaCtx, setSchemaCtx] = useState<string>("");
  const [schemaLoading, setSchemaLoading] = useState(true);
  const messagesRef = useRef<HTMLDivElement>(null);

  // Load schema context on mount
  useEffect(() => {
    fetch("/api/clean/schema-context")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setSchemaCtx(JSON.stringify(d.data, null, 2));
        else console.error("schema-context error:", d.error);
      })
      .catch((e) => console.error("schema-context fetch failed:", e))
      .finally(() => setSchemaLoading(false));
  }, []);

  const scrollBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (messagesRef.current) {
        messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      }
    });
  }, []);

  // Auto-scroll on new messages
  useEffect(scrollBottom, [messages, scrollBottom]);

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
      const system = schemaCtx
        ? `${SYSTEM_PREFIX}\n\n## 数据库 Schema\n${schemaCtx}`
        : SYSTEM_PREFIX;

      // Build conversation as prompt: concatenate prior messages
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

    // Mark running
    setMessages((prev) =>
      prev.map((m, i) =>
        i === idx ? { ...m, runStatus: "running" as RunStatus, runLogs: "" } : m
      )
    );

    try {
      const res = await fetch("/api/clean/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: msg.script }),
      });

      if (res.status === 409) {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === idx
              ? { ...m, runStatus: "error" as RunStatus, runLogs: "[错误] 已有清洗任务在运行中" }
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
            // ignore malformed SSE
          }
        }
      }

      // If status wasn't set by done/error
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
    // Show text without the code block if we extracted it separately
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
          placeholder="描述数据清洗需求…"
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
  );
}
