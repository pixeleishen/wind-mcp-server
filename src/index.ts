import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { wsdTool, wssTool, wsqTool, wsetTool, edbTool, tdaysTool } from "./tools/index.js";

const server = new McpServer({
  name: "wind-mcp-server",
  version: "0.1.0",
});

const tools = [wsdTool, wssTool, wsqTool, wsetTool, edbTool, tdaysTool];

for (const tool of tools) {
  server.tool(tool.name, tool.description, tool.inputSchema.shape, async (params: Record<string, unknown>) => {
    const data = await tool.handler(params as Record<string, unknown>);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
  });
}

const transport = new StdioServerTransport();
await server.connect(transport);
