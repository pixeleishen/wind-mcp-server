import type { WindFunctionConfig } from "../config/windFunctions";
import styles from "./QueryPreview.module.css";

interface Props {
  config: WindFunctionConfig;
  values: Record<string, string>;
}

function buildPythonCall(config: WindFunctionConfig, values: Record<string, string>): string {
  const fn = config.id;
  const args: string[] = [];

  for (const field of config.fields) {
    const val = values[field.key]?.trim();
    if (!val) continue;
    args.push(`"${val}"`);
  }

  // options is always last and keyword-style in WindPy
  // We already include it positionally above, but let's show it clearly
  return `w.${fn}(${args.join(", ")})`;
}

export default function QueryPreview({ config, values }: Props) {
  const call = buildPythonCall(config, values);

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>Preview</span>
      <pre className={styles.code}>{call}</pre>
    </div>
  );
}
