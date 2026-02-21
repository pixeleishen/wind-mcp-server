import { useState, useRef, useCallback } from "react";
import styles from "./EtlPage.module.css";

type EtlStatus = "idle" | "running" | "success" | "error";

export default function EtlPage() {
  const [codes, setCodes] = useState("000001.SZ,600000.SH,000002.SZ");
  const [macroCodes, setMacroCodes] = useState("M0001385,M0001227");
  const [start, setStart] = useState("2015-01-01");
  const [noIncremental, setNoIncremental] = useState(false);
  const [status, setStatus] = useState<EtlStatus>("idle");
  const [logs, setLogs] = useState("");
  const logRef = useRef<HTMLPreElement>(null);

  const appendLog = useCallback((text: string) => {
    setLogs((prev) => prev + text + "\n");
    requestAnimationFrame(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    });
  }, []);

  async function handleRun() {
    setStatus("running");
    setLogs("");

    try {
      const res = await fetch("/api/etl/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes, macroCodes, start, noIncremental }),
      });

      if (res.status === 409) {
        appendLog("[错误] ETL 任务正在运行中，请等待完成后再试");
        setStatus("error");
        return;
      }

      if (!res.ok || !res.body) {
        appendLog(`[错误] 请求失败: ${res.status}`);
        setStatus("error");
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
            const msg = JSON.parse(line);
            if (msg.type === "log") {
              appendLog(msg.text);
            } else if (msg.type === "done") {
              setStatus("success");
            } else if (msg.type === "error") {
              appendLog(msg.text ? `[错误] ${msg.text}` : `[进程退出] code=${msg.code}`);
              setStatus("error");
            }
          } catch {
            // ignore malformed SSE
          }
        }
      }

      // If status wasn't set by a done/error event, mark based on current state
      setStatus((s) => (s === "running" ? "error" : s));
    } catch (err) {
      appendLog(`[错误] ${err instanceof Error ? err.message : String(err)}`);
      setStatus("error");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2>数据入库 (ETL)</h2>

        <div className={styles.field}>
          <label htmlFor="etl-codes">资产代码（逗号分隔）</label>
          <input
            id="etl-codes"
            type="text"
            value={codes}
            onChange={(e) => setCodes(e.target.value)}
            disabled={status === "running"}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="etl-macro">宏观指标代码（逗号分隔）</label>
          <input
            id="etl-macro"
            type="text"
            value={macroCodes}
            onChange={(e) => setMacroCodes(e.target.value)}
            disabled={status === "running"}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="etl-start">起始日期</label>
          <input
            id="etl-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            disabled={status === "running"}
          />
        </div>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={noIncremental}
            onChange={(e) => setNoIncremental(e.target.checked)}
            disabled={status === "running"}
          />
          强制全量重新拉取（忽略已有数据）
        </label>

        <div>
          <button
            className={styles.runBtn}
            onClick={handleRun}
            disabled={status === "running"}
          >
            {status === "running" ? "运行中…" : "开始入库"}
          </button>
          {status === "running" && (
            <span className={`${styles.statusBadge} ${styles.statusRunning}`} style={{ marginLeft: "1rem" }}>
              运行中
            </span>
          )}
          {status === "success" && (
            <span className={`${styles.statusBadge} ${styles.statusSuccess}`} style={{ marginLeft: "1rem" }}>
              完成
            </span>
          )}
          {status === "error" && (
            <span className={`${styles.statusBadge} ${styles.statusError}`} style={{ marginLeft: "1rem" }}>
              失败
            </span>
          )}
        </div>
      </div>

      {logs && (
        <pre ref={logRef} className={styles.logArea}>
          {logs}
        </pre>
      )}
    </div>
  );
}
