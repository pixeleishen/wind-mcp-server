import type { WindStatus } from "../hooks/useWindStatus";
import styles from "./StatusIndicator.module.css";

const LABELS: Record<WindStatus, string> = {
  checking:     "Checking…",
  connected:    "Wind Connected",
  disconnected: "Wind Disconnected",
  server_down:  "API Server Down",
};

export default function StatusIndicator({ status }: { status: WindStatus }) {
  return (
    <div className={`${styles.indicator} ${styles[status]}`}>
      <span className={styles.dot} />
      {LABELS[status]}
    </div>
  );
}
