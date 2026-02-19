import { z } from "zod";
import { runBridge } from "../bridge/runner.js";

export const wsdTool = {
  name: "wind_wsd",
  description: "Fetch historical time-series data for one or more securities (OHLCV, fundamentals, etc.) using Wind w.wsd().",
  inputSchema: z.object({
    codes: z.string().describe("Comma-separated Wind security codes, e.g. '000001.SZ,600000.SH'"),
    fields: z.string().describe("Comma-separated data fields, e.g. 'open,high,low,close,volume'"),
    beginTime: z.string().describe("Start date in YYYY-MM-DD format"),
    endTime: z.string().describe("End date in YYYY-MM-DD format"),
    options: z.string().optional().describe("Wind options string, e.g. 'Period=W;Fill=Previous'"),
  }),
  handler: async (params: Record<string, unknown>) => {
    const result = await runBridge({ function: "wsd", params });
    if (!result.ok) throw new Error(result.error);
    return result.data;
  },
};
