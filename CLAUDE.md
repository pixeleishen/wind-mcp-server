# wind-mcp-server

MCP server + Express REST API + React UI that bridges Claude/LLMs to the Wind financial data terminal via a Python subprocess.

## Architecture

```
Claude / MCP client
       │  stdio
  src/index.ts  (MCP server — tools: wsd, wss, wsq, wset, edb, tdays)
       │
  src/bridge/runner.ts  ──spawn──►  dist/python/wind_bridge.py
       │                                    │
  src/server.ts  (Express :3001)            ├── handlers/wsd.py
       │  REST                              ├── handlers/wss.py  ...
  src/ui/  (React/Vite :5173)              └── WindPy (C:\Wind\...)
       │
  etl/  (Python ETL → PostgreSQL)
```

## Build & Run

```bash
# Build TypeScript + copy Python files (server only, no UI)
npm run build:server

# Build everything (TS + Python copy + Vite UI)
npm run build

# Start MCP server (stdio, for Claude Desktop)
npm start                        # node dist/index.js

# Start Express API server (port 3001)
npm run server                   # node dist/server.js

# Dev: watch TypeScript
npm run dev

# Dev: Vite UI hot-reload
npm run dev:ui                   # http://localhost:5173
```

## Key Files

| Path | Purpose |
|------|---------|
| `src/index.ts` | MCP server entry — registers tools |
| `src/server.ts` | Express API — `/api/query`, `/api/status`, `/api/etl/run`, `/api/clean/run`, `/api/llm/*` |
| `src/bridge/runner.ts` | Spawns Python bridge subprocess |
| `src/bridge/types.ts` | `BridgeRequest` / `BridgeResponse` types |
| `src/tools/wsd.ts` | Pattern for adding a new MCP tool |
| `src/python/wind_bridge.py` | Python entry — routes to handlers |
| `src/python/handlers/wsd.py` | Pattern for adding a new Python handler |
| `etl/` | Standalone ETL scripts (PostgreSQL) |
| `config/llm-keys.json` | **NOT committed** — create manually |
| `etl/.env` | **NOT committed** — DB connection string |

## Environment Setup

```bash
# Required: set Python path (default is hardcoded to Pixel's machine)
export PYTHON_PATH="C:\path\to\your\python.exe"

# config/llm-keys.json (create manually, not in git)
{ "openai": "sk-...", "anthropic": "sk-ant-...", "deepseek": "..." }

# etl/.env (create manually, not in git)
DATABASE_URL=postgresql://user:pass@localhost:5432/wind
```

## Known Bugs / Stubs

- `BridgeRequest["function"]` union does NOT include `"ping"` — server.ts casts around it
- `PYTHON_PATH` hardcoded to `C:\Users\Pixel\...` in both `runner.ts` and `server.ts` — always set env var
- `/api/assets/*` endpoints are missing from `server.ts` (referenced in UI but not implemented)
- `etl/load_prices.py` passes `startDate`/`endDate` to `call_wind` but `handlers/wsd.py` expects `beginTime`/`endTime`
- `npm run build` uses Windows `xcopy` — not cross-platform
- WindPy path hardcoded to `C:\Wind\Wind.NET.Client\WindNET\bin` in `wind_bridge.py`

## Conventions

- TypeScript ESM (`"type": "module"`) — use `.js` extensions in imports
- Python handlers receive a `dict` of params and return a `dict`; they import `WindPy.w` directly
- Bridge protocol: TS spawns Python with a single JSON CLI arg; Python prints one JSON line to stdout
- MCP tools registered in `src/tools/index.ts` and wired in `src/index.ts`
- React UI talks only to Express `:3001`; never directly to Python

## DO NOTs

- Do NOT commit `config/` or `etl/.env`
- Do NOT auto-push or force-push
- Do NOT run `npm run build` on non-Windows (xcopy will fail — use `build:server` + manual copy)
- Do NOT add new MCP tools to `src/index.ts` without also adding the handler in `wind_bridge.py`
