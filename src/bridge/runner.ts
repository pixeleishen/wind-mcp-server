import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import type { BridgeRequest, BridgeResponse } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRIDGE_PATH = join(__dirname, "..", "python", "wind_bridge.py");

export function runBridge<T = unknown>(request: BridgeRequest): Promise<BridgeResponse<T>> {
  return new Promise((resolve, reject) => {
    const arg = JSON.stringify(request);
    const proc = spawn("python", [BRIDGE_PATH, arg]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Python bridge exited with code ${code}: ${stderr.trim()}`));
      }
      try {
        resolve(JSON.parse(stdout) as BridgeResponse<T>);
      } catch {
        reject(new Error(`Failed to parse bridge output: ${stdout}`));
      }
    });

    proc.on("error", (err) => reject(err));
  });
}
