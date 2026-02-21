import { type FormEvent, type KeyboardEvent, useRef, useState } from "react";
import type { WindFunctionConfig } from "../config/windFunctions";
import styles from "./DynamicForm.module.css";

interface Props {
  config: WindFunctionConfig;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSubmit: (params: Record<string, string>, excelFile?: File) => void;
  loading: boolean;
}

// Fields that can be supplied via Excel — made optional when a file is selected
const EXCEL_KEYS = ["codes", "beginTime", "endTime"];

export default function DynamicForm({ config, values, onChange, onSubmit, loading }: Props) {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasCodesField = config.fields.some((f) => f.key === "codes");

  function isMultiValue(val: string | undefined): boolean {
    return !!val && val.split(",").filter((s) => s.trim()).length > 1;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setValidationError(null);

    const params = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v.trim() !== "")
    );

    // Check singleOnly constraints
    if (config.singleOnly) {
      for (const [key, message] of Object.entries(config.singleOnly)) {
        if (isMultiValue(params[key])) {
          setValidationError(message);
          return;
        }
      }
    }

    onSubmit(params, excelFile ?? undefined);
  }

  function handleFileClear() {
    setExcelFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {config.fields.map((field) => (
        <div key={field.key} className={styles.field}>
          <label htmlFor={field.key}>
            {field.label}
            {field.required && !(excelFile && EXCEL_KEYS.includes(field.key))
              && <span className={styles.required}> *</span>}
          </label>
          <input
            id={field.key}
            type={field.type === "date" ? "date" : "text"}
            value={values[field.key] ?? ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Tab" && field.type !== "date") {
                const input = e.currentTarget;
                const placeholder = input.placeholder;
                if (placeholder && !input.value) {
                  e.preventDefault();
                  onChange(field.key, placeholder);
                }
              }
            }}
            placeholder={
              excelFile && EXCEL_KEYS.includes(field.key)
                ? `已从 Excel 导入（可留空）`
                : field.placeholder
            }
            required={field.required && !(excelFile && EXCEL_KEYS.includes(field.key))}
            disabled={loading}
          />
          {field.hint && <span className={styles.hint}>{field.hint}</span>}
        </div>
      ))}

      {hasCodesField && (
        <div className={styles.field}>
          <label>从 Excel 导入代码</label>
          <div className={styles.fileRow}>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              disabled={loading}
              className={styles.fileInput}
              onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)}
            />
            {excelFile && (
              <button type="button" className={styles.fileClear} onClick={handleFileClear}>
                清除
              </button>
            )}
          </div>
          <span className={styles.hint}>
            支持列名：code / 股票代码 / Wind代码、beginTime / 开始日期、endTime / 结束日期
          </span>
        </div>
      )}

      {validationError && (
        <div className={styles.validationError}>{validationError}</div>
      )}

      <button type="submit" disabled={loading} className={styles.submit}>
        {loading ? "查询中…" : "执行查询"}
      </button>
    </form>
  );
}
