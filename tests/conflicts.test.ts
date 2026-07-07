import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ConflictPayload } from "../src/protocol/types.js";
import { collect, sleep, startTestServer, waitFor, type TestContext } from "./helpers.js";

describe("conflict awareness", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await startTestServer();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it("broadcasts a conflict when two agents edit the same file", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    const codex = await ctx.connect("repo", { name: "codex" });
    const claudeInbox = collect(claude);

    claude.declareActivity({ action: "editing", targets: ["src/api/users.ts"] });
    await sleep(100);
    codex.declareActivity({ action: "editing", targets: ["src/api/users.ts"] });

    await waitFor(
      () => claudeInbox.some((m) => m.kind === "conflict"),
      3000,
      "conflict broadcast",
    );
    const conflict = claudeInbox.find((m) => m.kind === "conflict")!;
    const payload = conflict.payload as ConflictPayload;
    expect(conflict.from.agentId).toBe("system");
    expect(payload.resource).toBe("src/api/users.ts");
    expect(payload.agents).toContain(claude.agent!.id);
    expect(payload.agents).toContain(codex.agent!.id);
  });

  it("treats api/schema/migration work on the same target as conflicting", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    const codex = await ctx.connect("repo", { name: "codex" });
    const inbox = collect(claude);

    claude.declareActivity({ action: "schema_change", targets: ["users"] });
    await sleep(100);
    codex.declareActivity({ action: "migration", targets: ["users"] });

    await waitFor(() => inbox.some((m) => m.kind === "conflict"), 3000, "cross-category conflict");
  });

  it("does not warn about different files", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    const codex = await ctx.connect("repo", { name: "codex" });
    const inbox = collect(claude);

    claude.declareActivity({ action: "editing", targets: ["src/a.ts"] });
    await sleep(100);
    codex.declareActivity({ action: "editing", targets: ["src/b.ts"] });
    await sleep(300);

    expect(inbox.filter((m) => m.kind === "conflict")).toHaveLength(0);
  });

  it("clears an agent's claims when it disconnects", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    const codex = await ctx.connect("repo", { name: "codex" });
    const inbox = collect(codex);

    claude.declareActivity({ action: "editing", targets: ["src/shared.ts"] });
    await sleep(100);
    await claude.disconnect();
    await sleep(100);

    codex.declareActivity({ action: "editing", targets: ["src/shared.ts"] });
    await sleep(300);
    expect(inbox.filter((m) => m.kind === "conflict")).toHaveLength(0);
  });

  it("moving to a new activity releases previous claims", async () => {
    const claude = await ctx.connect("repo", { name: "claude" });
    const codex = await ctx.connect("repo", { name: "codex" });
    const inbox = collect(codex);

    claude.declareActivity({ action: "editing", targets: ["src/x.ts"] });
    await sleep(100);
    claude.declareActivity({ action: "editing", targets: ["src/y.ts"] });
    await sleep(100);

    codex.declareActivity({ action: "editing", targets: ["src/x.ts"] });
    await sleep(300);
    expect(inbox.filter((m) => m.kind === "conflict")).toHaveLength(0);
  });
});
