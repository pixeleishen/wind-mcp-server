export type WindFunction = "wsd" | "wss" | "wsq" | "wset" | "edb" | "tdays" | "wst" | "wses" | "wsee" | "tdaysoffset" | "tdayscount";

export interface QueryRequest {
  function: WindFunction;
  params: Record<string, string>;
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
