import { describe, expect, it } from "vitest";
import {
  ClientFrameSchema,
  MessageKindSchema,
  validatePayload,
} from "../src/protocol/schemas.js";

describe("payload validation", () => {
  it("accepts every message kind with a valid payload", () => {
    const valid: Record<string, unknown> = {
      status: { status: "working", intent: "implementing auth" },
      thought: { text: "the token refresh flow is racy" },
      proposal: { title: "Switch to JWT", kind: "architecture" },
      question: { text: "who owns src/api/users.ts?" },
      answer: { text: "I do" },
      warning: { severity: "danger", category: "schema_change", text: "changing users table" },
      conflict: { resource: "src/db/schema.ts", category: "editing", agents: ["a", "b"] },
      decision: {
        decisionId: "d1",
        title: "Switch to JWT",
        outcome: "approved",
        tally: { approve: 2, reject: 0, request_changes: 0 },
      },
      vote: { decisionId: "d1", vote: "approve" },
      task: { taskId: "t1", title: "wire login endpoint", state: "open" },
      review: { target: "src/auth.ts", verdict: "request_changes", comments: "missing rate limit" },
      execution_request: { command: "npm test" },
      execution_result: { success: true, exitCode: 0 },
    };
    for (const kind of MessageKindSchema.options) {
      const result = validatePayload(kind, valid[kind]);
      expect(result.ok, `${kind} should validate`).toBe(true);
    }
  });

  it("rejects malformed payloads with a clear error", () => {
    const bad = validatePayload("vote", { decisionId: "d1", vote: "maybe" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain("vote");

    const empty = validatePayload("thought", { text: "" });
    expect(empty.ok).toBe(false);

    const missing = validatePayload("warning", { severity: "danger" });
    expect(missing.ok).toBe(false);
  });

  it("rejects unknown fields shapes for conflict payloads", () => {
    const result = validatePayload("conflict", {
      resource: "x",
      category: "editing",
      agents: ["only-one"],
    });
    expect(result.ok).toBe(false); // conflicts need at least two agents
  });
});

describe("client frames", () => {
  it("parses a hello frame and applies defaults", () => {
    const frame = ClientFrameSchema.parse({
      op: "hello",
      room: "my-repo",
      agent: { name: "claude", provider: "anthropic", model: "sonnet", role: "implementer" },
    });
    expect(frame.op).toBe("hello");
    if (frame.op === "hello") {
      expect(frame.agent.capabilities).toEqual([]);
      expect(frame.agent.status).toBe("idle");
    }
  });

  it("rejects rooms with invalid characters", () => {
    const result = ClientFrameSchema.safeParse({
      op: "hello",
      room: "bad room name!",
      agent: { name: "x", provider: "p", model: "m", role: "r" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown ops", () => {
    expect(ClientFrameSchema.safeParse({ op: "hack" }).success).toBe(false);
  });
});
