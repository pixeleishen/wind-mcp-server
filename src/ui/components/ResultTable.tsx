import type { TableResult } from "../utils/transformData";
import styles from "./ResultTable.module.css";

interface Props {
  result: TableResult;
}

export default function ResultTable({ result }: Props) {
  const { columns, rows } = result;
  return (
    <div className={styles.wrapper}>
      <p className={styles.count}>
        {rows.length} row{rows.length !== 1 ? "s" : ""}
      </p>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col}>{row[col] ?? "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
