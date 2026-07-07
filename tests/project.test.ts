import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  findProjectRoot,
  isLoopback,
  projectContext,
  roomForPath,
  slugify,
} from "../src/shared/project.js";
import { initProject, instructionsBlock, upsertBlock } from "../src/cli/init.js";

describe("project detection and room derivation", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "conclave-project-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("derives a stable per-project room from the path", () => {
    const roomA = roomForPath(join(dir, "My Project"));
    expect(roomA).toMatch(/^my-project-[0-9a-f]{8}$/);
    expect(roomForPath(join(dir, "My Project"))).toBe(roomA); // deterministic
    // Same folder name at a different path gets a different room.
    expect(roomForPath(join(dir, "elsewhere", "My Project"))).not.toBe(roomA);
  });

  it("finds the project root via .git or package.json from a nested cwd", () => {
    const root = join(dir, "repo");
    const nested = join(root, "src", "deep");
    mkdirSync(join(root, ".git"), { recursive: true });
    mkdirSync(nested, { recursive: true });
    expect(findProjectRoot(nested)).toBe(root);
  });

  it("prefers a conclave.json over the git root", () => {
    const root = join(dir, "repo");
    const sub = join(root, "packages", "app");
    mkdirSync(join(root, ".git"), { recursive: true });
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(sub, "conclave.json"), JSON.stringify({ room: "app-room" }));
    const ctx = projectContext(sub);
    expect(ctx.root).toBe(sub);
    expect(ctx.room).toBe("app-room");
  });

  it("slugify strips unsafe characters", () => {
    expect(slugify("My Cool Project!!")).toBe("my-cool-project");
    expect(slugify("---")).toBe("project");
  });

  it("isLoopback only accepts local urls", () => {
    expect(isLoopback("http://127.0.0.1:7777")).toBe(true);
    expect(isLoopback("http://localhost:7777")).toBe(true);
    expect(isLoopback("http://192.168.1.10:7777")).toBe(false);
    expect(isLoopback("not a url")).toBe(false);
  });
});

describe("conclave init", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "conclave-init-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates config, agent instructions and claude hooks — idempotently", () => {
    const first = initProject(dir);
    expect(first.config).toBe("created");
    expect(first.claudeMd).toBe("created");
    expect(first.agentsMd).toBe("created");
    expect(first.claudeHooks).toBe("created");

    const config = JSON.parse(readFileSync(join(dir, "conclave.json"), "utf8"));
    expect(config.room).toBe(roomForPath(dir));

    const claudeMd = readFileSync(join(dir, "CLAUDE.md"), "utf8");
    expect(claudeMd).toContain("conclave touch");
    expect(claudeMd).toContain(config.room);

    const settings = JSON.parse(readFileSync(join(dir, ".claude", "settings.json"), "utf8"));
    expect(JSON.stringify(settings.hooks)).toContain("conclave hook post-edit");

    // Second run changes nothing.
    const second = initProject(dir);
    expect(second.config).toBe("unchanged");
    expect(second.claudeMd).toBe("unchanged");
    expect(second.agentsMd).toBe("unchanged");
    expect(second.claudeHooks).toBe("unchanged");
  });

  it("preserves existing CLAUDE.md content and existing hooks", () => {
    writeFileSync(join(dir, "CLAUDE.md"), "# My rules\n\nAlways use tabs.\n");
    mkdirSync(join(dir, ".claude"), { recursive: true });
    writeFileSync(
      join(dir, ".claude", "settings.json"),
      JSON.stringify({ hooks: { PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo hi" }] }] } }),
    );

    initProject(dir);
    const claudeMd = readFileSync(join(dir, "CLAUDE.md"), "utf8");
    expect(claudeMd).toContain("Always use tabs.");
    expect(claudeMd).toContain("conclave say");

    const settings = JSON.parse(readFileSync(join(dir, ".claude", "settings.json"), "utf8"));
    const flat = JSON.stringify(settings.hooks);
    expect(flat).toContain("echo hi"); // pre-existing hook kept
    expect(flat).toContain("conclave hook post-edit");
  });

  it("upsertBlock replaces a stale block instead of duplicating it", () => {
    const path = join(dir, "AGENTS.md");
    upsertBlock(path, instructionsBlock("room-old"));
    upsertBlock(path, instructionsBlock("room-new"));
    const content = readFileSync(path, "utf8");
    expect(content).toContain("room-new");
    expect(content).not.toContain("room-old");
    expect(content.match(/conclave:begin/g)).toHaveLength(1);
  });
});
