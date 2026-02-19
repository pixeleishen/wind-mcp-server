import { z } from "zod";
import { runBridge } from "../bridge/runner.js";

export const wsqTool = {
  name: "wind_wsq",
  description: "Fetch real-time quote snapshot for securities using Wind w.wsq() in snapshot mode.",
  inputSchema: z.object({
    codes: z.string().describe("Comma-separated Wind security codes"),
    fields: z.string().describe("Comma-separated real-time fields, e.g. 'rt_last,rt_vol,rt_bid1,rt_ask1'"),
  }),
  handler: async (params: Record<string, unknown>) => {
    const result = await runBridge({ function: "wsq", params });
    if (!result.ok) throw new Error(result.error);
    return result.data;
  },
};
