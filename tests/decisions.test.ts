import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DecisionPayload } from "../src/protocol/types.js";
import { sleep, startTestServer, waitFor, type TestContext } from "./helpers.js";

describe("decision protocol", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await startTestServer();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("resolves approved once every other online agent votes approve", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    const codex = await ctx.connect("repo", { name: "codex" });
    const grok = await ctx.connect("repo", { name: "grok" });

    for (const voter of [codex, grok]) {
      voter.on("message", (message) => {
        if (message.kind === "proposal") {
          voter.vote(message.id, "approve", "sounds right");
        }
      });
    }

    const decision = await claude.proposeAndWait(
      { title: "Adopt zod for all payload validation", kind: "architecture" },
      5000,
    );
    expect(decision.outcome).toBe("approved");
    expect(decision.tally).toEqual({ approve: 2, reject: 0, request_changes: 0 });

    const rows = ctx.server.store.listDecisions("repo");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("approved");
  });

  it("any reject vote rejects the decision", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    const codex = await ctx.connect("repo", { name: "codex" });
    const grok = await ctx.connect("repo", { name: "grok" });

    codex.on("message", (m) => {
      if (m.kind === "proposal") codex.vote(m.id, "approve");
    });
    grok.on("message", (m) => {
      if (m.kind === "proposal") grok.vote(m.id, "reject", "breaks the mobile client");
    });

    const decision = await claude.proposeAndWait({ title: "Drop the v1 API" }, 5000);
    expect(decision.outcome).toBe("rejected");
  });

  it("request_changes without rejects resolves changes_requested", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    const codex = await ctx.connect("repo", { name: "codex" });

    codex.on("message", (m) => {
      if (m.kind === "proposal") codex.vote(m.id, "request_changes", "needs a migration plan");
    });

    const decision = await claude.proposeAndWait({ title: "Rename users table" }, 5000);
    expect(decision.outcome).toBe("changes_requested");
  });

  it("stays open until the electorate is complete", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    const codex = await ctx.connect("repo", { name: "codex" });
    await ctx.connect("repo", { name: "grok" }); // never votes

    codex.on("message", (m) => {
      if (m.kind === "proposal") codex.vote(m.id, "approve");
    });

    claude.propose({ title: "Half-voted proposal" });
    await sleep(400);
    const rows = ctx.server.store.listDecisions("repo");
    expect(rows[0]!.status).toBe("open");
  });

  it("blocks the proposer from voting on their own proposal", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    await ctx.connect("repo", { name: "codex" });
    const errors: string[] = [];
    claude.on("error", (err) => errors.push(err.message));

    const decisionId = claude.propose({ title: "Self-approved?" });
    await sleep(100);
    claude.vote(decisionId, "approve");
    await waitFor(() => errors.length >= 1, 3000, "proposer-vote rejection");
    expect(errors[0]).toContain("proposer");
  });

  it("rejects votes on unknown or resolved decisions", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    const codex = await ctx.connect("repo", { name: "codex" });
    const errors: string[] = [];
    codex.on("error", (err) => errors.push(err.message));

    codex.vote("no-such-decision", "approve");
    await waitFor(() => errors.length >= 1, 3000, "unknown decision error");
    expect(errors[0]).toContain("unknown decision");

    // resolve one, then vote again on it
    codex.on("message", (m) => {
      if (m.kind === "proposal") codex.vote(m.id, "approve");
    });
    const decision: DecisionPayload = await claude.proposeAndWait({ title: "One-shot" }, 5000);
    codex.vote(decision.decisionId, "reject");
    await waitFor(() => errors.length >= 2, 3000, "already-resolved error");
    expect(errors[1]).toContain("already resolved");
  });

  it("ignores observers when computing the electorate", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    const codex = await ctx.connect("repo", { name: "codex" });
    await ctx.connect("repo", { name: "watcher", role: "observer" });

    codex.on("message", (m) => {
      if (m.kind === "proposal") codex.vote(m.id, "approve");
    });

    const decision = await claude.proposeAndWait({ title: "Observers excluded from electorate" }, 5000);
    expect(decision.outcome).toBe("approved");
  });
});
