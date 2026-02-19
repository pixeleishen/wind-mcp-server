import { z } from "zod";
import { runBridge } from "../bridge/runner.js";

export const wsetTool = {
  name: "wind_wset",
  description: "Query Wind dataset tables (e.g. index constituents, sector members) using Wind w.wset().",
  inputSchema: z.object({
    tableName: z.string().describe("Wind dataset table name, e.g. 'IndexConstituent'"),
    options: z.string().optional().describe("Wind options string, e.g. 'date=2024-01-01;windcode=000300.SH'"),
  }),
  handler: async (params: Record<string, unknown>) => {
    const result = await runBridge({ function: "wset", params });
    if (!result.ok) throw new Error(result.error);
    return result.data;
  },
};
