import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConclaveStore } from "../src/persistence/store.js";
import type { AgentIdentity } from "../src/protocol/types.js";

const agent = (id: string, name = id): AgentIdentity => ({
  id,
  name,
  provider: "anthropic",
  model: "sonnet",
  role: "implementer",
  capabilities: ["edit", "test"],
  status: "idle",
  intent: null,
});

describe("ConclaveStore", () => {
  let dir: string;
  let dbPath: string;
  let store: ConclaveStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "conclave-store-"));
    dbPath = join(dir, "test.db");
    store = new ConclaveStore(dbPath);
  });

  afterEach(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("persists rooms, sessions, messages, decisions and votes across restarts", () => {
    store.ensureRoom("repo");
    store.upsertAgentSession("repo", agent("a1", "claude"), "token-1");
    const message = store.insertMessage({
      roomId: "repo",
      from: { agentId: "a1", name: "claude", provider: "anthropic", role: "implementer" },
      kind: "thought",
      payload: { text: "hello" },
    });
    store.createDecision({ id: "d1", roomId: "repo", proposerAgentId: "a1", title: "Use JWT" });
    store.castVote({ decisionId: "d1", agentId: "a2", vote: "approve" });
    store.close();

    // Reopen — everything must survive.
    store = new ConclaveStore(dbPath);
    expect(store.listRooms().map((r) => r.id)).toEqual(["repo"]);
    expect(store.listAgents("repo")).toHaveLength(1);
    expect(store.getMessage(message.id)?.payload).toEqual({ text: "hello" });
    expect(store.getDecision("d1")?.title).toBe("Use JWT");
    expect(store.listVotes("d1")).toHaveLength(1);
  });

  it("filters and pages messages", () => {
    store.ensureRoom("repo");
    const from = { agentId: "a1", name: "claude", provider: "anthropic", role: "implementer" };
    for (let i = 0; i < 5; i++) {
      store.insertMessage({ roomId: "repo", from, kind: "thought", payload: { text: `t${i}` }, ts: 1000 + i });
    }
    store.insertMessage({ roomId: "repo", from, kind: "warning", payload: { severity: "info", category: "other", text: "w" }, ts: 2000 });

    expect(store.listMessages("repo")).toHaveLength(6);
    expect(store.listMessages("repo", { kind: "warning" })).toHaveLength(1);
    expect(store.listMessages("repo", { limit: 2 }).map((m) => (m.payload as { text?: string }).text ?? "w")).toEqual(["t4", "w"]);
    expect(store.listMessages("repo", { beforeTs: 1002 })).toHaveLength(2);
  });

  it("upserts votes so only the latest vote per agent counts", () => {
    store.ensureRoom("repo");
    store.createDecision({ id: "d1", roomId: "repo", proposerAgentId: "p", title: "T" });
    store.castVote({ decisionId: "d1", agentId: "a1", vote: "reject" });
    store.castVote({ decisionId: "d1", agentId: "a1", vote: "approve" });
    const votes = store.listVotes("d1");
    expect(votes).toHaveLength(1);
    expect(votes[0]!.vote).toBe("approve");
  });

  it("marks stale agents offline in sweeps", () => {
    store.ensureRoom("repo");
    store.upsertAgentSession("repo", agent("a1"), "t1", Date.now() - 60_000);
    store.upsertAgentSession("repo", agent("a2"), "t2");
    const stale = store.sweepStaleAgents("repo", 15_000);
    expect(stale.map((a) => a.id)).toEqual(["a1"]);
    const agents = store.listAgents("repo");
    expect(agents.find((a) => a.id === "a1")!.online).toBe(false);
    expect(agents.find((a) => a.id === "a2")!.online).toBe(true);
  });

  it("clearRoom cascades to sessions, messages, decisions and votes", () => {
    store.ensureRoom("repo");
    store.upsertAgentSession("repo", agent("a1"), "t1");
    store.insertMessage({
      roomId: "repo",
      from: { agentId: "a1", name: "a1", provider: "p", role: "r" },
      kind: "thought",
      payload: { text: "x" },
    });
    store.createDecision({ id: "d1", roomId: "repo", proposerAgentId: "a1", title: "T" });
    store.castVote({ decisionId: "d1", agentId: "a2", vote: "approve" });

    store.clearRoom("repo");
    expect(store.listRooms()).toHaveLength(0);
    expect(store.listAgents("repo")).toHaveLength(0);
    expect(store.listMessages("repo")).toHaveLength(0);
    expect(store.getDecision("d1")).toBeNull();
    expect(store.listVotes("d1")).toHaveLength(0);
  });

  it("finds sessions by token for reconnection", () => {
    store.ensureRoom("repo");
    store.upsertAgentSession("repo", agent("a1"), "secret-token");
    const session = store.findSessionByToken("secret-token");
    expect(session?.agentId).toBe("a1");
    expect(store.findSessionByToken("wrong")).toBeNull();
  });
});
