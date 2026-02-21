export type WindFunction = "wsd" | "wss" | "wsq" | "wset" | "edb" | "tdays" | "wst" | "wses" | "wsee" | "tdaysoffset" | "tdayscount";

export interface QueryRequest {
  function: WindFunction;
  params: Record<string, string>;
  showData?: boolean;
  saveToDB?: boolean;
}

export interface WindData {
  error_code: number;
  codes: string[];
  fields: string[];
  times: string[];
  data: (number | string | null)[][];
}

export interface BridgeResponse {
  ok: boolean;
  data?: WindData;
  error?: string;
  saved?: boolean;
}

export async function queryWind(req: QueryRequest, excelFile?: File): Promise<BridgeResponse> {
  let res: Response;

  if (excelFile) {
    const form = new FormData();
    form.append("payload", JSON.stringify(req));
    form.append("excelFile", excelFile);
    res = await fetch("/api/query", { method: "POST", body: form });
  } else {
    res = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  }

  if (!res.ok) {
    let message = `Server error ${res.status}`;
    try {
      const body = await res.json() as { error?: string };
      if (body.error) message = body.error;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  return res.json() as Promise<BridgeResponse>;
}

// ── Assets API ──────────────────────────────────────────────

export interface Asset {
  code: string;
  name: string | null;
  asset_type: string | null;
  ipo_date: string | null;
  industry: string | null;
  exchange: string | null;
  extra: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export async function fetchAssets(): Promise<Asset[]> {
  const res = await fetch("/api/assets");
  if (!res.ok) throw new Error(`Failed to fetch assets: ${res.status}`);
  const body = await res.json() as { ok: boolean; data: Asset[] };
  return body.data;
}

export async function addAssets(codes: string[]): Promise<{ assets: Asset[]; errors: string[] }> {
  const res = await fetch("/api/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codes }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Failed to add assets: ${res.status}`);
  }
  return res.json() as Promise<{ assets: Asset[]; errors: string[] }>;
}

export async function importIndexMembers(indexCode: string): Promise<{ assets: Asset[]; errors: string[] }> {
  const res = await fetch("/api/assets/import-index", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ indexCode }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Failed to import index: ${res.status}`);
  }
  return res.json() as Promise<{ assets: Asset[]; errors: string[] }>;
}

export async function deleteAsset(code: string): Promise<void> {
  const res = await fetch(`/api/assets/${encodeURIComponent(code)}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Failed to delete asset: ${res.status}`);
  }
}
