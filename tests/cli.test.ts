import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, type TestContext } from "./helpers.js";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(root, "src/cli/index.ts");
// Invoke tsx through node so this works identically on Windows, macOS and Linux.
const TSX = join(root, "node_modules/tsx/dist/cli.mjs");

function runCli(args: string[], url: string) {
  return exec(process.execPath, [TSX, CLI, ...args], {
    env: { ...process.env, CONCLAVE_URL: url, NO_COLOR: "1" },
    timeout: 20_000,
  });
}

describe("cli", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestServer();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it("send publishes a message, messages/agents/export read it back", async () => {
    const sent = await runCli(
      ["send", "thought", "cli-room", "--text", "hello from the cli", "--name", "cli-agent"],
      ctx.url,
    );
    expect(sent.stdout).toContain("sent thought");

    const messages = await runCli(["messages", "cli-room"], ctx.url);
    expect(messages.stdout).toContain("hello from the cli");

    const agents = await runCli(["agents", "cli-room"], ctx.url);
    expect(agents.stdout).toContain("cli-agent");

    const rooms = await runCli(["rooms"], ctx.url);
    expect(rooms.stdout).toContain("cli-room");

    const exported = await runCli(["export", "cli-room", "--format", "md"], ctx.url);
    expect(exported.stdout).toContain("# Conclave transcript");
  }, 60_000);

  it("say broadcasts and touch reports conflicts across processes", async () => {
    const said = await runCli(["say", "checking", "the", "auth", "flow", "--room", "cli-room"], ctx.url);
    expect(said.stdout).toContain("sent");

    const first = await runCli(
      ["touch", "src/auth.ts", "--room", "cli-room", "--name", "agent-one", "--id", "agent-one"],
      ctx.url,
    );
    expect(first.stdout).toContain("declared");

    // agent-one's one-shot session ended, so its claims were released.
    const second = await runCli(
      ["touch", "src/auth.ts", "--room", "cli-room", "--name", "agent-two", "--id", "agent-two"],
      ctx.url,
    );
    expect(second.stdout).toContain("declared");
  }, 60_000);

  it("send rejects invalid payloads and unknown kinds", async () => {
    await expect(runCli(["send", "nonsense", "cli-room", "--text", "x"], ctx.url)).rejects.toMatchObject({
      code: 1,
    });

    const bad = await runCli(
      ["send", "vote", "cli-room", "--payload", '{"decisionId":"d","vote":"maybe"}'],
      ctx.url,
    ).catch((err) => err);
    expect(bad.code).toBe(1);
  }, 60_000);

  it("clear requires --yes and then wipes the room", async () => {
    await expect(runCli(["clear", "cli-room"], ctx.url)).rejects.toMatchObject({ code: 1 });
    const cleared = await runCli(["clear", "cli-room", "--yes"], ctx.url);
    expect(cleared.stdout).toContain("cleared");
    expect(ctx.server.store.countMessages("cli-room")).toBe(0);
  }, 60_000);
});
