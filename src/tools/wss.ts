import { z } from "zod";
import { runBridge } from "../bridge/runner.js";

export const wssTool = {
  name: "wind_wss",
  description: "Fetch snapshot / point-in-time values for securities (e.g. latest price, PE ratio) using Wind w.wss().",
  inputSchema: z.object({
    codes: z.string().describe("Comma-separated Wind security codes"),
    fields: z.string().describe("Comma-separated data fields"),
    options: z.string().optional().describe("Wind options string"),
  }),
  handler: async (params: Record<string, unknown>) => {
    const result = await runBridge({ function: "wss", params });
    if (!result.ok) throw new Error(result.error);
    return result.data;
  },
};
