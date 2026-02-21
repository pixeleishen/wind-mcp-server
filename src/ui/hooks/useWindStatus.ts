import { useState, useEffect } from "react";

export type WindStatus = "checking" | "connected" | "disconnected" | "server_down";

export function useWindStatus(intervalMs = 10000): WindStatus {
  const [status, setStatus] = useState<WindStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/status");
        if (!res.ok) throw new Error();
        const body = await res.json() as { connected: boolean };
        if (!cancelled) setStatus(body.connected ? "connected" : "disconnected");
      } catch {
        if (!cancelled) setStatus("server_down");
      }
    }

    check();
    const id = setInterval(check, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [intervalMs]);

  return status;
}
