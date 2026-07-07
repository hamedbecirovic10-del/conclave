import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collect, sleep, startTestServer, waitFor, type TestContext } from "./helpers.js";

describe("server integration", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await startTestServer();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("broadcasts messages live between agents in the same room", async () => {
    const claude = await ctx.connect("repo", { name: "claude", provider: "anthropic" });
    const codex = await ctx.connect("repo", { name: "codex", provider: "openai" });
    const claudeInbox = collect(claude);
    const codexInbox = collect(codex);

    claude.thought("starting on the auth module");
    await waitFor(() => codexInbox.length >= 1, 3000, "codex to receive thought");

    expect(codexInbox[0]!.kind).toBe("thought");
    expect(codexInbox[0]!.from.name).toBe("claude");
    expect((codexInbox[0]!.payload as { text: string }).text).toBe("starting on the auth module");
    // sender receives its own echo too
    expect(claudeInbox.some((m) => m.kind === "thought")).toBe(true);
  });

  it("does not leak messages across rooms", async () => {
    const a = await ctx.connect("room-a", { name: "a" });
    const b = await ctx.connect("room-b", { name: "b" });
    const bInbox = collect(b);
    a.thought("private to room-a");
    await sleep(200);
    expect(bInbox).toHaveLength(0);
  });

  it("delivers direct messages only to the target and the sender", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    const codex = await ctx.connect("repo", { name: "codex" });
    const grok = await ctx.connect("repo", { name: "grok" });
    const codexInbox = collect(codex);
    const grokInbox = collect(grok);

    claude.publish("question", { text: "codex, are you touching users.ts?" }, { to: codex.agent!.id });
    await waitFor(() => codexInbox.length >= 1, 3000, "codex to receive direct question");
    await sleep(200);
    expect(grokInbox).toHaveLength(0);
  });

  it("shows the roster and recent history on join", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    claude.thought("first message");
    await sleep(100);

    const late = await ctx.connect("repo", { name: "late-joiner" });
    expect(late.roster.size).toBe(2);
    const history = await late.history({ limit: 10 });
    expect(history.some((m) => m.kind === "thought")).toBe(true);
  });

  it("emits presence events on join, update and leave", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    const events: string[] = [];
    claude.on("presence", ({ event, agent }) => events.push(`${event}:${agent.name}`));

    const codex = await ctx.connect("repo", { name: "codex" });
    await waitFor(() => events.includes("joined:codex"), 3000, "joined event");

    codex.updatePresence({ status: "working", intent: "writing tests" });
    await waitFor(() => events.some((e) => e.startsWith("updated:codex")), 3000, "updated event");
    expect(claude.roster.get(codex.agent!.id)?.status).toBe("working");

    await codex.disconnect();
    await waitFor(() => events.includes("left:codex"), 3000, "left event");
  });

  it("rejects invalid payloads with a typed error and stores nothing", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    const errors: string[] = [];
    claude.on("error", (err) => errors.push(err.message));

    claude.publish("vote", { decisionId: "d", vote: "maybe" });
    await waitFor(() => errors.length >= 1, 3000, "validation error");
    expect(errors[0]).toContain("bad_payload");
    expect(ctx.server.store.listMessages("repo")).toHaveLength(0);
  });

  it("question/answer round-trips through ask()", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    const codex = await ctx.connect("repo", { name: "codex" });

    codex.on("question", (question) => {
      codex.answer(question.id, "yes, ship it");
    });

    const answer = await claude.ask("is the api contract frozen?", { timeoutMs: 5000 });
    expect((answer.payload as { text: string }).text).toBe("yes, ship it");
    expect(answer.from.name).toBe("codex");
  });

  it("broadcasts a mandatory system warning before dangerous execution requests", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    const codex = await ctx.connect("repo", { name: "codex" });
    const codexInbox = collect(codex);

    claude.requestExecution({ command: "rm -rf dist && npm install", reason: "clean rebuild" });
    await waitFor(() => codexInbox.length >= 2, 3000, "warning + request");

    expect(codexInbox[0]!.kind).toBe("warning");
    expect(codexInbox[0]!.from.agentId).toBe("system");
    expect(codexInbox[1]!.kind).toBe("execution_request");
  });

  it("serves the HTTP query api and markdown export", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    claude.thought("for the transcript");
    await sleep(150);

    const agents = await fetch(`${ctx.url}/api/rooms/repo/agents`).then((r) => r.json() as Promise<any>);
    expect(agents.agents).toHaveLength(1);

    const messages = await fetch(`${ctx.url}/api/rooms/repo/messages`).then((r) => r.json() as Promise<any>);
    expect(messages.messages.length).toBeGreaterThanOrEqual(1);

    const md = await fetch(`${ctx.url}/api/rooms/repo/export?format=md`).then((r) => r.text());
    expect(md).toContain("# Conclave transcript");
    expect(md).toContain("for the transcript");

    const cleared = await fetch(`${ctx.url}/api/rooms/repo`, { method: "DELETE" });
    expect(cleared.ok).toBe(true);
    const after = await fetch(`${ctx.url}/api/rooms/repo/messages`).then((r) => r.json() as Promise<any>);
    expect(after.messages).toHaveLength(0);
  });
});
