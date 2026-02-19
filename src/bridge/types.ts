export interface BridgeRequest {
  function: "wsd" | "wss" | "wsq" | "wset" | "edb" | "tdays";
  params: Record<string, unknown>;
}

export interface BridgeResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
