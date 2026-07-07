import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, waitFor, type TestContext } from "./helpers.js";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(root, "src/cli/index.ts");
const TSX = join(root, "node_modules/tsx/dist/cli.mjs");

function runHook(event: string, stdin: object | string, cwd: string, url: string) {
  const promise = exec(process.execPath, [TSX, CLI, "hook", event], {
    env: { ...process.env, CONCLAVE_URL: url, NO_COLOR: "1" },
    cwd,
    timeout: 20_000,
  });
  promise.child.stdin!.write(typeof stdin === "string" ? stdin : JSON.stringify(stdin));
  promise.child.stdin!.end();
  return promise;
}

describe("agent hook bridge", () => {
  let ctx: TestContext;
  let project: string;
  let room: string;

  beforeAll(async () => {
    ctx = await startTestServer();
    project = mkdtempSync(join(tmpdir(), "conclave-hook-proj-"));
    mkdirSync(join(project, ".git"), { recursive: true });
    room = "hook-room";
    writeFileSync(join(project, "conclave.json"), JSON.stringify({ room }));
  });

  afterAll(async () => {
    await ctx.cleanup();
    rmSync(project, { recursive: true, force: true });
  });

  it("session-start announces the agent in the project room", async () => {
    await runHook("session-start", { session_id: "abc12345-ffff", cwd: project }, project, ctx.url);
    await waitFor(() => ctx.server.store.listMessages(room).length >= 1, 5000, "status message");
    const messages = ctx.server.store.listMessages(room);
    expect(messages.some((m) => m.kind === "status" && m.from.agentId === "claude-abc12345")).toBe(true);
  });

  it("post-edit declares editing activity for the touched file", async () => {
    await runHook(
      "post-edit",
      {
        session_id: "abc12345-ffff",
        cwd: project,
        tool_name: "Edit",
        tool_input: { file_path: join(project, "src", "api.ts") },
      },
      project,
      ctx.url,
    );
    const messages = ctx.server.store.listMessages(room);
    const activity = messages.find(
      (m) => m.kind === "status" && JSON.stringify(m.payload).includes("api.ts"),
    );
    expect(activity).toBeTruthy();
  });

  it("never fails the host agent, even with garbage stdin and no reachable server", async () => {
    // Exit code 0 is the contract — a broken conclave must not break Claude/Codex.
    const result = await runHook("post-edit", "this is not json", project, "http://127.0.0.1:1");
    expect(result.stderr).not.toContain("Error");
  }, 30_000);
});
