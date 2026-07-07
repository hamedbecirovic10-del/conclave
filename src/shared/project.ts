import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";

export interface ProjectConfig {
  room?: string;
  url?: string;
}

export const DEFAULT_PORT = 7777;
export const DEFAULT_URL = `http://127.0.0.1:${DEFAULT_PORT}`;
export const CONFIG_FILE = "conclave.json";

/**
 * Walk up from cwd to find the project root: the nearest directory with
 * a conclave.json, else the nearest with .git, else package.json, else cwd.
 */
export function findProjectRoot(cwd: string = process.cwd()): string {
  const start = resolve(cwd);
  let gitRoot: string | null = null;
  let pkgRoot: string | null = null;
  let dir = start;
  while (true) {
    if (existsSync(resolve(dir, CONFIG_FILE))) return dir;
    if (!gitRoot && existsSync(resolve(dir, ".git"))) gitRoot = dir;
    if (!pkgRoot && existsSync(resolve(dir, "package.json"))) pkgRoot = dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return gitRoot ?? pkgRoot ?? start;
}

export function readProjectConfig(root: string): ProjectConfig {
  const path = resolve(root, CONFIG_FILE);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ProjectConfig;
  } catch {
    return {};
  }
}

/** Turn an arbitrary name into a safe room slug. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "project"
  );
}

/**
 * Derive the room for a project deterministically from its root path:
 * `<folder-slug>-<8 char path hash>`. Same project → same room on every
 * run and for every agent; different projects (even with the same folder
 * name) → different rooms, so they can never cross-talk.
 */
export function roomForPath(root: string): string {
  // Normalize so all platforms and spellings of the same path agree
  // (Windows paths are case-insensitive; separators differ).
  const normalized = resolve(root).split(sep).join("/").toLowerCase();
  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 8);
  return `${slugify(basename(root))}-${hash}`;
}

export interface ProjectContext {
  root: string;
  room: string;
  url: string;
}

/**
 * Resolve the effective project context. Precedence:
 * explicit CLI flag > CONCLAVE_ROOM/CONCLAVE_URL env > conclave.json > derived.
 */
export function projectContext(cwd: string = process.cwd()): ProjectContext {
  const root = findProjectRoot(cwd);
  const config = readProjectConfig(root);
  return {
    root,
    room: process.env.CONCLAVE_ROOM ?? config.room ?? roomForPath(root),
    url: process.env.CONCLAVE_URL ?? config.url ?? DEFAULT_URL,
  };
}

export function isLoopback(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
  } catch {
    return false;
  }
}
