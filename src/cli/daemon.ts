import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isLoopback } from "../shared/project.js";

const HEALTH_TIMEOUT_MS = 1_000;

export async function serverIsUp(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url.replace(/\/+$/, "")}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function defaultDbPath(): string {
  const dir = join(homedir(), ".conclave");
  mkdirSync(dir, { recursive: true });
  return join(dir, "conclave.db");
}

/**
 * Make sure a conclave server is reachable at `url`. If it is a loopback
 * URL and nothing answers, spawn one detached in the background (shared
 * by all projects on this machine — rooms keep projects isolated) and
 * wait until it responds. Works on Windows, macOS and Linux.
 */
export async function ensureServer(url: string, options: { quiet?: boolean } = {}): Promise<boolean> {
  if (await serverIsUp(url)) return true;
  if (!isLoopback(url)) return false;

  const port = new URL(url).port || "7777";
  const dir = dirname(fileURLToPath(import.meta.url));
  const jsEntry = join(dir, "index.js");
  const cliEntry = existsSync(jsEntry) ? jsEntry : join(dir, "index.ts");
  const child = spawn(
    process.execPath,
    // execArgv carries loaders (e.g. tsx) when running from source.
    [...process.execArgv, cliEntry, "serve", "--port", port, "--db", defaultDbPath()],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env, CONCLAVE_AUTOSTARTED: "1" },
    },
  );
  child.unref();

  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (await serverIsUp(url)) {
      if (!options.quiet) {
        console.error(`conclave: started local server on ${url} (db: ${defaultDbPath()})`);
      }
      return true;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}
