# wind-mcp-server

A TypeScript MCP (Model Context Protocol) server that exposes Wind Information (万得) financial terminal data to LLMs. Wind has no native HTTP API — it uses a local desktop terminal with a Python SDK (WindPy). This server bridges MCP tool calls to Python subprocess calls that invoke WindPy and return JSON.

## Prerequisites

- **Wind Terminal** installed and logged in on the local machine
- **WindPy** Python package (installed with the Wind terminal, typically at `C:\Wind\Wind.NET.Client\WindNetClient\bin\WindPy`)
- **Python 3.7+** with WindPy accessible on `PATH`
- **Node.js 18+**

## Installation

```bash
npm install
npm run build
```

The build step compiles TypeScript to `dist/` and copies the Python bridge files to `dist/python/`.

## Wind Authentication

Wind does **not** use API keys. Authentication is handled entirely by the Wind desktop terminal:

1. Open and log in to the Wind terminal application before starting this server.
2. WindPy connects to the already-running terminal session on startup via `w.start()`.
3. If the terminal is not running or not logged in, all tool calls will fail with a connection error.

There are no environment variables or config files to set for credentials.

## Running

```bash
# Start the MCP server (stdio transport)
npm start
```

To use with an MCP client (e.g. Claude Desktop), add this to your MCP client config:

```json
{
  "mcpServers": {
    "wind": {
      "command": "node",
      "args": ["C:/Users/Pixel/Projects/wind-mcp-server/dist/index.js"]
    }
  }
}
```

## Available Tools

| Tool | Wind Function | Description |
|------|--------------|-------------|
| `wind_wsd` | `w.wsd()` | Historical time-series data (OHLCV, fundamentals) |
| `wind_wss` | `w.wss()` | Snapshot / point-in-time values (latest price, PE ratio) |
| `wind_wsq` | `w.wsq()` | Real-time quote snapshot |
| `wind_wset` | `w.wset()` | Dataset queries (index constituents, sector members) |
| `wind_edb` | `w.edb()` | Economic Database macro indicators |
| `wind_tdays` | `w.tdays()` | Trading calendar days |

## Testing

**Test the Python bridge directly** (requires Wind terminal running):

```bash
python dist/python/wind_bridge.py '{"function":"tdays","params":{"beginTime":"2024-01-01","endTime":"2024-01-10"}}'
```

Expected output:
```json
{"ok": true, "data": {"error_code": 0, "codes": [], "fields": ["DATETIME"], "times": [], "data": [["2024-01-02", ...]]}}
```

**Test with MCP inspector** (schema validation only, no Wind terminal needed):

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

Open the inspector UI and confirm all 6 tools appear in the tool list.

## Troubleshooting

### `Wind start failed` / `ErrorCode: -2`
The Wind terminal is not running or not logged in. Start the terminal and log in before running the server.

### `ModuleNotFoundError: No module named 'WindPy'`
WindPy is not on Python's path. Add the Wind installation directory to `PYTHONPATH`:

```bash
# Windows (PowerShell)
$env:PYTHONPATH = "C:\Wind\Wind.NET.Client\WindNetClient\bin"
```

Or set it permanently in System Environment Variables.

### `python: command not found` / `python` runs Python 2
The server calls `python` (not `python3`). Ensure `python` on your `PATH` resolves to Python 3.7+:

```bash
python --version
```

If needed, edit `src/bridge/runner.ts` line 10 to use `python3` or the full path to your Python executable, then rebuild.

### `Failed to parse bridge output`
The Python bridge printed something unexpected to stdout (e.g. Wind startup banner). Check stderr output. Wind sometimes prints startup messages — these are captured separately and should not interfere, but if they appear on stdout they will break JSON parsing.

### `No permission for this data` (ErrorCode: -40520007)
Your Wind account subscription does not include the requested data field or security. Check your Wind terminal data permissions.

### `Invalid security code` (ErrorCode: -40521009)
The security code format is incorrect. Wind codes follow the pattern `000001.SZ` (Shenzhen) or `600000.SH` (Shanghai). Verify the code in the Wind terminal.

### Build fails: `cp: command not found`
On Windows without Unix tools on PATH, the `cp` command in the build script may fail. Use Git Bash or WSL to run `npm run build`, or manually copy `src/python/` to `dist/python/` after `tsc`.

## Project Structure

```
src/
├── index.ts              # MCP server entry, tool registration, stdio transport
├── bridge/
│   ├── runner.ts         # Spawns Python subprocess, parses JSON stdout
│   └── types.ts          # BridgeRequest / BridgeResponse interfaces
├── tools/
│   ├── index.ts          # Re-exports all tools
│   ├── wsd.ts            # Historical time-series
│   ├── wss.ts            # Snapshot values
│   ├── wsq.ts            # Real-time quotes
│   ├── wset.ts           # Dataset queries
│   ├── edb.ts            # Economic database
│   └── tdays.ts          # Trading calendar
└── python/
    ├── wind_bridge.py    # CLI dispatcher: reads JSON arg, routes to handler
    ├── utils.py          # WindData serialization, error code mapping
    └── handlers/
        ├── wsd.py
        ├── wss.py
        ├── wsq.py
        ├── wset.py
        ├── edb.py
        └── tdays.py
```
