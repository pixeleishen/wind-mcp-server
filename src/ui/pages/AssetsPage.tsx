import { useEffect, useState, useRef } from "react";
import {
  fetchAssets,
  addAssets,
  importIndexMembers,
  deleteAsset,
  type Asset,
} from "../api/client";
import styles from "./AssetsPage.module.css";

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Manual add
  const [manualCode, setManualCode] = useState("");

  // Index import
  const [indexCode, setIndexCode] = useState("");

  // Excel import
  const fileRef = useRef<HTMLInputElement>(null);

  async function reload() {
    try {
      const list = await fetchAssets();
      setAssets(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { reload(); }, []);

  function clearMessages() {
    setError(null);
    setSuccess(null);
  }

  async function handleManualAdd() {
    if (!manualCode.trim()) return;
    clearMessages();
    setLoading(true);
    try {
      const codes = manualCode.split(/[,，\s]+/).filter(Boolean);
      const res = await addAssets(codes);
      setSuccess(`成功添加/更新 ${res.assets.length} 个资产`);
      if (res.errors.length > 0) {
        setError(`部分失败: ${res.errors.join("; ")}`);
      }
      setManualCode("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleIndexImport() {
    if (!indexCode.trim()) return;
    clearMessages();
    setLoading(true);
    try {
      const res = await importIndexMembers(indexCode.trim());
      setSuccess(`从指数成分导入 ${res.assets.length} 个资产`);
      if (res.errors.length > 0) {
        setError(`部分失败: ${res.errors.join("; ")}`);
      }
      setIndexCode("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleExcelImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    clearMessages();
    setLoading(true);
    try {
      // Read Excel on frontend, extract codes from first column
      const text = await file.text();
      // For simplicity, send file to a dedicated endpoint or parse codes
      // Here we use a simple approach: upload as form data
      const form = new FormData();
      form.append("excelFile", file);
      const res = await fetch("/api/assets/import-excel", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Upload failed: ${res.status}`);
      }
      const data = await res.json() as { assets: Asset[]; errors: string[] };
      setSuccess(`从 Excel 导入 ${data.assets.length} 个资产`);
      if (data.errors.length > 0) {
        setError(`部分失败: ${data.errors.join("; ")}`);
      }
      if (fileRef.current) fileRef.current.value = "";
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(code: string) {
    if (!confirm(`确认删除资产 ${code}？`)) return;
    clearMessages();
    try {
      await deleteAsset(code);
      setSuccess(`已删除 ${code}`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main className={styles.page}>
      <h2 className={styles.title}>资产管理</h2>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <section className={styles.actions}>
        {/* Manual add */}
        <div className={styles.actionGroup}>
          <label>手动添加</label>
          <div className={styles.inputRow}>
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="输入代码，如 000001.SZ,600519.SH"
              disabled={loading}
              className={styles.input}
              onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
            />
            <button onClick={handleManualAdd} disabled={loading} className={styles.btn}>
              添加
            </button>
          </div>
          <span className={styles.hint}>多个代码用逗号分隔，自动从 Wind 拉取基础信息</span>
        </div>

        {/* Index import */}
        <div className={styles.actionGroup}>
          <label>WSET 指数成分导入</label>
          <div className={styles.inputRow}>
            <input
              type="text"
              value={indexCode}
              onChange={(e) => setIndexCode(e.target.value)}
              placeholder="输入指数代码，如 000300.SH"
              disabled={loading}
              className={styles.input}
              onKeyDown={(e) => e.key === "Enter" && handleIndexImport()}
            />
            <button onClick={handleIndexImport} disabled={loading} className={styles.btn}>
              导入成分股
            </button>
          </div>
          <span className={styles.hint}>自动获取指数全部成分股并注册</span>
        </div>

        {/* Excel import */}
        <div className={styles.actionGroup}>
          <label>Excel 批量导入</label>
          <div className={styles.inputRow}>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              disabled={loading}
              className={styles.fileInput}
            />
            <button onClick={handleExcelImport} disabled={loading} className={styles.btn}>
              导入
            </button>
          </div>
          <span className={styles.hint}>Excel 需包含 code 列（或"股票代码"/"Wind代码"列）</span>
        </div>
      </section>

      {loading && <div className={styles.loading}>处理中…</div>}

      <section className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>代码</th>
              <th>名称</th>
              <th>类型</th>
              <th>上市日期</th>
              <th>行业</th>
              <th>交易所</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 ? (
              <tr><td colSpan={7} className={styles.empty}>暂无资产</td></tr>
            ) : (
              assets.map((a) => (
                <tr key={a.code}>
                  <td>{a.code}</td>
                  <td>{a.name ?? "-"}</td>
                  <td>{a.asset_type ?? "-"}</td>
                  <td>{a.ipo_date ?? "-"}</td>
                  <td>{a.industry ?? "-"}</td>
                  <td>{a.exchange ?? "-"}</td>
                  <td>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(a.code)}
                    >删除</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className={styles.count}>共 {assets.length} 个资产</div>
      </section>
    </main>
  );
}
