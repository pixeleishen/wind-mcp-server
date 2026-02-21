import { useState } from "react";
import { WIND_FUNCTIONS } from "./config/windFunctions";
import type { WindFunctionConfig } from "./config/windFunctions";
import { queryWind } from "./api/client";
import { transformWindData, type TableResult } from "./utils/transformData";
import { useWindStatus } from "./hooks/useWindStatus";
import FunctionSelector from "./components/FunctionSelector";
import DynamicForm from "./components/DynamicForm";
import QueryPreview from "./components/QueryPreview";
import ResultTable from "./components/ResultTable";
import ErrorBanner from "./components/ErrorBanner";
import StatusIndicator from "./components/StatusIndicator";
import SettingsPage from "./pages/SettingsPage";
import EtlPage from "./pages/EtlPage";
import CleanPage from "./pages/CleanPage";
import styles from "./App.module.css";

type Status = "idle" | "loading" | "success" | "error";
type Page = "query" | "etl" | "clean" | "settings";

function emptyValues(config: WindFunctionConfig): Record<string, string> {
  return Object.fromEntries(config.fields.map((f) => [f.key, ""]));
}

export default function App() {
  const windStatus = useWindStatus(10000);
  const [page, setPage] = useState<Page>("query");

  const [selectedFn, setSelectedFn] = useState<WindFunctionConfig["id"]>(WIND_FUNCTIONS[0].id);
  const [values, setValues] = useState<Record<string, string>>(
    () => emptyValues(WIND_FUNCTIONS[0])
  );
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TableResult | null>(null);

  const fnConfig = WIND_FUNCTIONS.find((f) => f.id === selectedFn)!;

  function handleFunctionChange(id: WindFunctionConfig["id"]) {
    setSelectedFn(id);
    setValues(emptyValues(WIND_FUNCTIONS.find((f) => f.id === id)!));
    setResult(null);
    setError(null);
    setStatus("idle");
  }

  function handleFieldChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(params: Record<string, string>, excelFile?: File) {
    setStatus("loading");
    setError(null);
    setResult(null);
    try {
      const res = await queryWind({ function: selectedFn, params }, excelFile);
      if (!res.ok || !res.data) {
        throw new Error(res.error ?? "Query returned no data");
      }
      const table = transformWindData(res.data);
      if (table.rows.length === 0) {
        throw new Error("No data returned for this query.");
      }
      setResult(table);
      setStatus("success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>Wind Data Query</h1>
        <nav className={styles.nav}>
          <button
            className={`${styles.navBtn} ${page === "query" ? styles.navActive : ""}`}
            onClick={() => setPage("query")}
          >数据查询</button>
          <button
            className={`${styles.navBtn} ${page === "etl" ? styles.navActive : ""}`}
            onClick={() => setPage("etl")}
          >数据入库</button>
          <button
            className={`${styles.navBtn} ${page === "clean" ? styles.navActive : ""}`}
            onClick={() => setPage("clean")}
          >数据清洗</button>
          <button
            className={`${styles.navBtn} ${page === "settings" ? styles.navActive : ""}`}
            onClick={() => setPage("settings")}
          >LLM 设置</button>
        </nav>
        <StatusIndicator status={windStatus} />
      </header>
      {page === "settings" ? (
        <SettingsPage />
      ) : page === "etl" ? (
        <EtlPage />
      ) : page === "clean" ? (
        <CleanPage />
      ) : (
        <main className={styles.main}>
          <section className={styles.formPanel}>
            <FunctionSelector
              functions={WIND_FUNCTIONS}
              selected={selectedFn}
              onChange={handleFunctionChange}
            />
            <p className={styles.description}>{fnConfig.description}</p>
            <DynamicForm
              config={fnConfig}
              values={values}
              onChange={handleFieldChange}
              onSubmit={handleSubmit}
              loading={status === "loading"}
            />
            <QueryPreview config={fnConfig} values={values} />
          </section>
          {status === "error" && error && <ErrorBanner message={error} />}
          {status === "loading" && <div className={styles.loading}>Querying Wind…</div>}
          {status === "success" && result && <ResultTable result={result} />}
        </main>
      )}
    </div>
  );
}
