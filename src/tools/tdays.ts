import { z } from "zod";
import { runBridge } from "../bridge/runner.js";

export const tdaysTool = {
  name: "wind_tdays",
  description: "Get trading calendar days between two dates using Wind w.tdays().",
  inputSchema: z.object({
    beginTime: z.string().describe("Start date in YYYY-MM-DD format"),
    endTime: z.string().describe("End date in YYYY-MM-DD format"),
    options: z.string().optional().describe("Wind options string, e.g. 'Days=Alldays'"),
  }),
  handler: async (params: Record<string, unknown>) => {
    const result = await runBridge({ function: "tdays", params });
    if (!result.ok) throw new Error(result.error);
    return result.data;
  },
};
