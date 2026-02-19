import { z } from "zod";
import { runBridge } from "../bridge/runner.js";

export const edbTool = {
  name: "wind_edb",
  description: "Query Wind Economic Database (EDB) for macro indicators using Wind w.edb().",
  inputSchema: z.object({
    codes: z.string().describe("Comma-separated EDB indicator codes"),
    beginTime: z.string().describe("Start date in YYYY-MM-DD format"),
    endTime: z.string().describe("End date in YYYY-MM-DD format"),
    options: z.string().optional().describe("Wind options string"),
  }),
  handler: async (params: Record<string, unknown>) => {
    const result = await runBridge({ function: "edb", params });
    if (!result.ok) throw new Error(result.error);
    return result.data;
  },
};
