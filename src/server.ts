import express from "express";
import cors from "cors";
import https from "https";
import http from "http";
import fs from "fs";
import os from "os";
import path from "path";
import multer from "multer";
import { spawn, type ChildProcess } from "child_process";
import { runBridge } from "./bridge/runner.js";
import type { BridgeRequest } from "./bridge/types.js";

const upload = multer({ dest: path.join(os.tmpdir(), "wind-uploads") });

const KEYS_PATH = path.resolve(import.meta.dirname ?? ".", "../config/llm-keys.json");

function loadKeysFile(): Record<string, string> {
  try {
    const raw = fs.readFileSync(KEYS_PATH, "utf-8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/api/status", async (_req, res) => {
  try {
    const result = await runBridge({ function: "ping" as BridgeRequest["function"], params: {} });
    const r = result as unknown as { ok: boolean; connected: boolean; error_code?: number };
    res.json({ connected: r.connected ?? false });
  } catch {
    res.json({ connected: false });
  }
});

app.post("/api/query", upload.single("excelFile"), async (req, res) => {
  let body: BridgeRequest;
  try {
    if (req.file) {
      console.log("[query] file:", JSON.stringify(req.file));
      console.log("[query] body fields:", Object.keys(req.body));
      // multipart/form-data: params come as JSON string in "payload" field
      body = JSON.parse(req.body.payload as string) as BridgeRequest;
      const ext = path.extname(req.file.originalname) || ".xlsx";
      const dest = req.file.path + ext;
      fs.renameSync(req.file.path, dest);
      (body.params as Record<string, unknown>).excelPath = dest;
    } else if (typeof req.body === "string") {
      body = JSON.parse(req.body) as BridgeRequest;
    } else {
      body = req.body as BridgeRequest;
    }
  } catch (e) {
    res.status(400).json({ ok: false, error: `Invalid request body: ${e instanceof Error ? e.message : String(e)}` });
    return;
  }

  const { function: fn, params } = body;

  if (!fn || !params) {
    res.status(400).json({ ok: false, error: "Missing function or params" });
    return;
  }

  try {
    console.log("[query] fn=%s, params=%j, hasFile=%s", fn, params, !!req.file);
    const result = await runBridge({ function: fn, params });
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: message });
  }
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`Wind API server running on :${PORT}`));

// ── LLM provider 默认 base URL ────────────────────────────
const LLM_DEFAULTS: Record<string, string> = {
  openai:    "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  deepseek:  "https://api.deepseek.com/v1",
  gemini:    "https://generativelanguage.googleapis.com/v1beta",
  ollama:    "http://localhost:11434",
};

// ── GET /api/llm/keys — report which providers have server-side keys ──
app.get("/api/llm/keys", (_req, res) => {
  const keys = loadKeysFile();
  const result: Record<string, boolean> = {};
  for (const provider of Object.keys(LLM_DEFAULTS)) {
    result[provider] = !!(keys[provider] && keys[provider].trim());
  }
  res.json({ keys: result });
});

interface LLMRequest {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
  prompt: string;
  system?: string;
}

// ── 通用 JSON POST 辅助 ───────────────────────────────────
function jsonPost(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;

    const req = lib.request(
      { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search,
        method: "POST", headers: { "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload), ...headers } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error(`Invalid JSON from LLM API: ${data.slice(0, 200)}`)); }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// POST /api/llm/generate
app.post("/api/llm/generate", async (req, res) => {
  const { provider, apiKey: clientKey, model, baseUrl, prompt, system } = req.body as LLMRequest;

  if (!provider || !model || !prompt) {
    res.status(400).json({ ok: false, error: "Missing required fields: provider, model, prompt" });
    return;
  }

  // Client key takes priority; fall back to server-side key file
  let apiKey = clientKey;
  if (!apiKey) {
    const keys = loadKeysFile();
    apiKey = keys[provider.toLowerCase()] ?? "";
  }
  if (!apiKey && provider.toLowerCase() !== "ollama") {
    res.status(400).json({ ok: false, error: "No API key provided and no server-side key configured" });
    return;
  }

  const base = (baseUrl || LLM_DEFAULTS[provider.toLowerCase()] || "").replace(/\/$/, "");

  try {
    let text: string;

    if (provider.toLowerCase() === "anthropic") {
      const body: Record<string, unknown> = {
        model, max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      };
      if (system) body.system = system;

      const data = await jsonPost(`${base}/v1/messages`, {
        "x-api-key": apiKey, "anthropic-version": "2023-06-01",
      }, body) as Record<string, unknown>;

      if (!data.content) {
        const errMsg = (data as { error?: { message?: string } }).error?.message
          ?? JSON.stringify(data);
        throw new Error(`Anthropic API error: ${errMsg}`);
      }
      text = ((data.content as { text: string }[])[0]).text;
    } else if (provider.toLowerCase() === "gemini") {
      // Gemini uses OpenAI-compatible endpoint under /openai/
      const messages: { role: string; content: string }[] = [];
      if (system) messages.push({ role: "system", content: system });
      messages.push({ role: "user", content: prompt });

      const data = await jsonPost(`${base}/openai/chat/completions`, {
        Authorization: `Bearer ${apiKey}`,
      }, { model, messages }) as { choices: { message: { content: string } }[] };

      text = data.choices[0].message.content;
    } else {
      // OpenAI-compatible: openai / deepseek / ollama
      const messages: { role: string; content: string }[] = [];
      if (system) messages.push({ role: "system", content: system });
      messages.push({ role: "user", content: prompt });

      const data = await jsonPost(`${base}/chat/completions`, {
        Authorization: `Bearer ${apiKey}`,
      }, { model, messages }) as { choices: { message: { content: string } }[] };

      text = data.choices[0].message.content;
    }

    res.json({ ok: true, text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: message });
  }
});

// ── Schema context endpoint ──────────────────────────────
app.get("/api/clean/schema-context", (_req, res) => {
  const child = spawn("python", ["etl/schema_inspector.py"], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout!.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
  child.stderr!.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

  child.on("close", (code) => {
    if (code !== 0) {
      res.status(500).json({ ok: false, error: stderr || `exit code ${code}` });
      return;
    }
    try {
      const data = JSON.parse(stdout);
      res.json({ ok: true, data });
    } catch {
      res.status(500).json({ ok: false, error: "Invalid JSON from schema_inspector" });
    }
  });

  child.on("error", (err) => {
    res.status(500).json({ ok: false, error: err.message });
  });
});

// ── Clean runner SSE endpoint ────────────────────────────
let activeClean: ChildProcess | null = null;

app.post("/api/clean/run", (req, res) => {
  if (activeClean) {
    res.status(409).json({ ok: false, error: "Clean job already running" });
    return;
  }

  const { script } = req.body as { script?: string };
  if (!script) {
    res.status(400).json({ ok: false, error: "Missing script" });
    return;
  }

  // Write script to temp file
  const tmpFile = path.join(os.tmpdir(), `clean_${Date.now()}.py`);
  fs.writeFileSync(tmpFile, script, "utf-8");

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const child = spawn("python", ["etl/clean_runner.py", "--script", tmpFile], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  activeClean = child;

  const send = (obj: unknown) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  const onData = (stream: "stdout" | "stderr") => (chunk: Buffer) => {
    const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      send({ type: "log", stream, text: line });
    }
  };

  child.stdout!.on("data", onData("stdout"));
  child.stderr!.on("data", onData("stderr"));

  const cleanup = () => {
    activeClean = null;
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  };

  child.on("close", (code) => {
    cleanup();
    if (code === 0) {
      send({ type: "done", code: 0 });
    } else {
      send({ type: "error", code: code ?? 1 });
    }
    res.end();
  });

  child.on("error", (err) => {
    cleanup();
    send({ type: "error", code: -1, text: err.message });
    res.end();
  });

  req.on("close", () => {
    if (activeClean === child) {
      child.kill();
      cleanup();
    }
  });
});

// ── ETL SSE endpoint ─────────────────────────────────────
let activeEtl: ChildProcess | null = null;

app.post("/api/etl/run", (req, res) => {
  if (activeEtl) {
    res.status(409).json({ ok: false, error: "ETL job already running" });
    return;
  }

  const { codes, macroCodes, start, noIncremental } = req.body as {
    codes?: string; macroCodes?: string; start?: string; noIncremental?: boolean;
  };

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const args = ["etl/run_all.py"];
  if (codes) args.push("--codes", codes);
  if (macroCodes) args.push("--macro-codes", macroCodes);
  if (start) args.push("--start", start);
  if (noIncremental) args.push("--no-incremental");

  const child = spawn("python", args, { stdio: ["ignore", "pipe", "pipe"] });
  activeEtl = child;

  const send = (obj: unknown) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  const onData = (stream: "stdout" | "stderr") => (chunk: Buffer) => {
    const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      send({ type: "log", stream, text: line });
    }
  };

  child.stdout!.on("data", onData("stdout"));
  child.stderr!.on("data", onData("stderr"));

  child.on("close", (code) => {
    activeEtl = null;
    if (code === 0) {
      send({ type: "done", code: 0 });
    } else {
      send({ type: "error", code: code ?? 1 });
    }
    res.end();
  });

  child.on("error", (err) => {
    activeEtl = null;
    send({ type: "error", code: -1, text: err.message });
    res.end();
  });

  req.on("close", () => {
    if (activeEtl === child) {
      child.kill();
      activeEtl = null;
    }
  });
});
