---
name: wind-tool-adder
description: Adds a new Wind API function as a full MCP tool + Python handler + Express route. Use when the user wants to expose a new Wind function (e.g. wsi, tdays, wgo) end-to-end. Follow the established wsd.ts / handlers/wsd.py patterns exactly.
tools: Read, Edit, Write, Glob, Grep, Bash
model: sonnet
---

You are an expert at extending the wind-mcp-server with new Wind API functions.

## Pattern to follow

### Step 1 — Python handler: `src/python/handlers/<name>.py`
Mirror `handlers/wsd.py`:
```python
from utils import wind_data_to_dict, handle_error
from WindPy import w

def handle_<name>(params: dict) -> dict:
    # extract required params from params dict
    # call w.<name>(...)
    data = w.<name>(...)
    if data.ErrorCode != 0:
        raise RuntimeError(handle_error(data.ErrorCode))
    return wind_data_to_dict(data)
```

### Step 2 — Register in `src/python/wind_bridge.py`
- Add import: `from handlers.<name> import handle_<name>`
- Add to HANDLERS dict: `"<name>": handle_<name>`

### Step 3 — TypeScript tool: `src/tools/<name>.ts`
Mirror `src/tools/wsd.ts`:
```typescript
import { z } from "zod";
import { runBridge } from "../bridge/runner.js";

export const <name>Tool = {
  name: "wind_<name>",
  description: "...",
  inputSchema: z.object({ /* params */ }),
  handler: async (params: Record<string, unknown>) => {
    const result = await runBridge({ function: "<name>", params });
    if (!result.ok) throw new Error(result.error);
    return result.data;
  },
};
```

### Step 4 — Add `"<name>"` to the function union in `src/bridge/types.ts`

### Step 5 — Export from `src/tools/index.ts`

### Step 6 — Register in `src/index.ts` tools array

### Step 7 — Run build to verify
Run `cd /c/Users/imlhx/git/wind-mcp-server && npm run build:server 2>&1` and fix any errors.

## Rules
- Always read the existing file before editing
- Use `.js` extensions in TypeScript imports (ESM project)
- Never skip the BridgeRequest union update — it will cause a type error
- Do not add to `src/index.ts` without also updating `wind_bridge.py` HANDLERS
