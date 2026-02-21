import type { WindFunctionConfig } from "../config/windFunctions";
import styles from "./FunctionSelector.module.css";

interface Props {
  functions: WindFunctionConfig[];
  selected: string;
  onChange: (id: WindFunctionConfig["id"]) => void;
}

export default function FunctionSelector({ functions, selected, onChange }: Props) {
  return (
    <div className={styles.wrapper}>
      <label htmlFor="fn-select">Function</label>
      <select
        id="fn-select"
        value={selected}
        onChange={(e) => onChange(e.target.value as WindFunctionConfig["id"])}
        className={styles.select}
      >
        {functions.map((fn) => (
          <option key={fn.id} value={fn.id}>
            {fn.label}
          </option>
        ))}
      </select>
    </div>
  );
}
