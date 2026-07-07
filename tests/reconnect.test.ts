import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConclaveServer } from "../src/server/server.js";
import { ConclaveClient } from "../src/sdk/client.js";
import { startTestServer, waitFor, type TestContext } from "./helpers.js";

describe("heartbeats and reconnection", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await startTestServer({ heartbeatTimeoutMs: 400, sweepIntervalMs: 100 });
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("marks agents offline after heartbeat timeout", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    const codex = await ctx.connect("repo", { name: "codex" });
    const offline: string[] = [];
    claude.on("presence", ({ event, agent }) => {
      if (event === "offline") offline.push(agent.name);
    });

    // Kill codex's socket without a clean leave and stop its heartbeats.
    (codex as unknown as { socket: { terminate(): void } })["socket"].terminate();
    (codex as unknown as { closedByUser: boolean })["closedByUser"] = true;

    await waitFor(() => offline.includes("codex"), 3000, "offline presence");
    const agents = ctx.server.store.listAgents("repo");
    expect(agents.find((a) => a.name === "codex")!.online).toBe(false);
  });

  it("auto-reconnects and resumes the same agent identity", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    const watcher = await ctx.connect("repo", { name: "watcher" });
    const originalId = claude.agent!.id;
    const reconnected: string[] = [];
    watcher.on("presence", ({ event, agent }) => {
      if (event === "reconnected") reconnected.push(agent.id);
    });

    // Drop the transport out from under the client; it should reconnect on its own.
    (claude as unknown as { socket: { terminate(): void } })["socket"].terminate();

    await waitFor(() => claude.connected, 5000, "client reconnect");
    expect(claude.agent!.id).toBe(originalId);
    await waitFor(() => reconnected.includes(originalId), 3000, "reconnected presence");

    // The resumed client can still publish.
    claude.thought("back online");
    await waitFor(
      () => ctx.server.store.listMessages("repo").some((m) => (m.payload as { text?: string }).text === "back online"),
      3000,
      "post-reconnect publish",
    );
  });
});

describe("durability across server restarts", () => {
  it("reloads rooms, transcripts and decisions from disk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "conclave-restart-"));
    const dbPath = join(dir, "conclave.db");

    let server = new ConclaveServer({ dbPath });
    let port = await server.listen(0);
    const client = new ConclaveClient({
      url: `http://127.0.0.1:${port}`,
      room: "repo",
      agent: { name: "claude", provider: "anthropic", model: "sonnet", role: "implementer" },
      reconnect: false,
    });
    await client.connect();
    client.thought("must survive restart");
    client.propose({ title: "Persist me" });
    await waitFor(() => server.store.countMessages("repo") >= 2, 3000, "messages stored");
    await client.disconnect();
    await server.close();

    // Restart on the same database file.
    server = new ConclaveServer({ dbPath });
    port = await server.listen(0);
    const client2 = new ConclaveClient({
      url: `http://127.0.0.1:${port}`,
      room: "repo",
      agent: { name: "codex", provider: "openai", model: "gpt", role: "reviewer" },
      reconnect: false,
    });
    const welcome = await client2.connect();
    expect(welcome.recent.some((m) => (m.payload as { text?: string }).text === "must survive restart")).toBe(true);
    expect(server.store.listDecisions("repo")).toHaveLength(1);
    expect(server.store.listAgents("repo").map((a) => a.name)).toContain("claude");

    await client2.disconnect();
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
