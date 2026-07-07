import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  AgentIdentity,
  AgentStatus,
  DecisionOutcome,
  MessageKind,
  RoomAgent,
  StoredMessage,
  VoteValue,
} from "../protocol/types.js";

export interface AgentSessionRow {
  agentId: string;
  roomId: string;
  name: string;
  provider: string;
  model: string;
  role: string;
  capabilities: string[];
  status: AgentStatus;
  intent: string | null;
  sessionToken: string;
  joinedAt: number;
  lastSeen: number;
  online: boolean;
}

export interface DecisionRow {
  id: string;
  roomId: string;
  proposerAgentId: string;
  title: string;
  description: string | null;
  kind: string;
  status: "open" | DecisionOutcome;
  createdAt: number;
  resolvedAt: number | null;
}

export interface VoteRow {
  decisionId: string;
  agentId: string;
  vote: VoteValue;
  comment: string | null;
  createdAt: number;
}

export interface MessageQuery {
  limit?: number;
  beforeTs?: number;
  kind?: MessageKind;
  agentId?: string;
}

/**
 * Durable local persistence for rooms, agent sessions, messages,
 * decisions and votes. Backed by SQLite (node:sqlite) in WAL mode so
 * the system survives restarts without any external service.
 */
export class ConclaveStore {
  private db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") {
      mkdirSync(dirname(resolve(path)), { recursive: true });
    }
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_sessions (
        agent_id TEXT NOT NULL,
        room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        role TEXT NOT NULL,
        capabilities TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'idle',
        intent TEXT,
        session_token TEXT NOT NULL,
        joined_at INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        online INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (room_id, agent_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        agent_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        agent_provider TEXT NOT NULL DEFAULT '',
        agent_role TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL,
        payload TEXT NOT NULL,
        to_agent TEXT,
        ref_id TEXT,
        ts INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_room_ts ON messages(room_id, ts);
      CREATE INDEX IF NOT EXISTS idx_messages_room_kind ON messages(room_id, kind);

      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        proposer_agent_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        kind TEXT NOT NULL DEFAULT 'general',
        status TEXT NOT NULL DEFAULT 'open',
        created_at INTEGER NOT NULL,
        resolved_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_decisions_room ON decisions(room_id, status);

      CREATE TABLE IF NOT EXISTS votes (
        decision_id TEXT NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
        agent_id TEXT NOT NULL,
        vote TEXT NOT NULL,
        comment TEXT,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (decision_id, agent_id)
      );
    `);
  }

  /* ---------------------------- rooms ----------------------------- */

  ensureRoom(roomId: string): void {
    this.db
      .prepare("INSERT OR IGNORE INTO rooms (id, created_at) VALUES (?, ?)")
      .run(roomId, Date.now());
  }

  listRooms(): { id: string; createdAt: number }[] {
    const rows = this.db
      .prepare("SELECT id, created_at FROM rooms ORDER BY created_at")
      .all() as { id: string; created_at: number }[];
    return rows.map((r) => ({ id: r.id, createdAt: r.created_at }));
  }

  clearRoom(roomId: string): void {
    this.db.prepare("DELETE FROM rooms WHERE id = ?").run(roomId);
  }

  /* ------------------------ agent sessions ------------------------ */

  upsertAgentSession(
    roomId: string,
    agent: AgentIdentity,
    sessionToken: string,
    now = Date.now(),
  ): void {
    this.db
      .prepare(
        `INSERT INTO agent_sessions
           (agent_id, room_id, name, provider, model, role, capabilities,
            status, intent, session_token, joined_at, last_seen, online)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(room_id, agent_id) DO UPDATE SET
           name = excluded.name,
           provider = excluded.provider,
           model = excluded.model,
           role = excluded.role,
           capabilities = excluded.capabilities,
           status = excluded.status,
           intent = excluded.intent,
           session_token = excluded.session_token,
           last_seen = excluded.last_seen,
           online = 1`,
      )
      .run(
        agent.id,
        roomId,
        agent.name,
        agent.provider,
        agent.model,
        agent.role,
        JSON.stringify(agent.capabilities ?? []),
        agent.status,
        agent.intent ?? null,
        sessionToken,
        now,
        now,
      );
  }

  findSessionByToken(token: string): AgentSessionRow | null {
    const row = this.db
      .prepare("SELECT * FROM agent_sessions WHERE session_token = ?")
      .get(token) as Record<string, unknown> | undefined;
    return row ? this.rowToSession(row) : null;
  }

  getAgentSession(roomId: string, agentId: string): AgentSessionRow | null {
    const row = this.db
      .prepare("SELECT * FROM agent_sessions WHERE room_id = ? AND agent_id = ?")
      .get(roomId, agentId) as Record<string, unknown> | undefined;
    return row ? this.rowToSession(row) : null;
  }

  listAgents(roomId: string): RoomAgent[] {
    const rows = this.db
      .prepare("SELECT * FROM agent_sessions WHERE room_id = ? ORDER BY joined_at")
      .all(roomId) as Record<string, unknown>[];
    return rows.map((r) => this.rowToRoomAgent(r));
  }

  touchAgent(roomId: string, agentId: string, now = Date.now()): void {
    this.db
      .prepare(
        "UPDATE agent_sessions SET last_seen = ?, online = 1 WHERE room_id = ? AND agent_id = ?",
      )
      .run(now, roomId, agentId);
  }

  updateAgentState(
    roomId: string,
    agentId: string,
    fields: { status?: AgentStatus; intent?: string | null },
  ): void {
    const session = this.getAgentSession(roomId, agentId);
    if (!session) return;
    this.db
      .prepare(
        "UPDATE agent_sessions SET status = ?, intent = ?, last_seen = ? WHERE room_id = ? AND agent_id = ?",
      )
      .run(
        fields.status ?? session.status,
        fields.intent === undefined ? session.intent : fields.intent,
        Date.now(),
        roomId,
        agentId,
      );
  }

  setAgentOnline(roomId: string, agentId: string, online: boolean): void {
    this.db
      .prepare("UPDATE agent_sessions SET online = ? WHERE room_id = ? AND agent_id = ?")
      .run(online ? 1 : 0, roomId, agentId);
  }

  /** Mark agents offline whose last heartbeat is older than the timeout. */
  sweepStaleAgents(roomId: string, timeoutMs: number, now = Date.now()): RoomAgent[] {
    const cutoff = now - timeoutMs;
    const stale = this.db
      .prepare(
        "SELECT * FROM agent_sessions WHERE room_id = ? AND online = 1 AND last_seen < ?",
      )
      .all(roomId, cutoff) as Record<string, unknown>[];
    if (stale.length > 0) {
      this.db
        .prepare(
          "UPDATE agent_sessions SET online = 0, status = 'offline' WHERE room_id = ? AND online = 1 AND last_seen < ?",
        )
        .run(roomId, cutoff);
    }
    return stale.map((r) => this.rowToRoomAgent({ ...r, online: 0, status: "offline" }));
  }

  /* --------------------------- messages --------------------------- */

  insertMessage(message: Omit<StoredMessage, "id" | "ts"> & { id?: string; ts?: number }): StoredMessage {
    const stored: StoredMessage = {
      id: message.id ?? randomUUID(),
      roomId: message.roomId,
      from: message.from,
      kind: message.kind,
      payload: message.payload,
      to: message.to ?? null,
      refId: message.refId ?? null,
      ts: message.ts ?? Date.now(),
    };
    this.db
      .prepare(
        `INSERT INTO messages
           (id, room_id, agent_id, agent_name, agent_provider, agent_role,
            kind, payload, to_agent, ref_id, ts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        stored.id,
        stored.roomId,
        stored.from.agentId,
        stored.from.name,
        stored.from.provider,
        stored.from.role,
        stored.kind,
        JSON.stringify(stored.payload ?? null),
        stored.to ?? null,
        stored.refId ?? null,
        stored.ts,
      );
    return stored;
  }

  getMessage(id: string): StoredMessage | null {
    const row = this.db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.rowToMessage(row) : null;
  }

  listMessages(roomId: string, query: MessageQuery = {}): StoredMessage[] {
    const limit = Math.min(query.limit ?? 100, 1000);
    const clauses = ["room_id = ?"];
    const params: (string | number)[] = [roomId];
    if (query.beforeTs) {
      clauses.push("ts < ?");
      params.push(query.beforeTs);
    }
    if (query.kind) {
      clauses.push("kind = ?");
      params.push(query.kind);
    }
    if (query.agentId) {
      clauses.push("agent_id = ?");
      params.push(query.agentId);
    }
    params.push(limit);
    const rows = this.db
      .prepare(
        `SELECT * FROM messages WHERE ${clauses.join(" AND ")} ORDER BY ts DESC, id DESC LIMIT ?`,
      )
      .all(...params) as Record<string, unknown>[];
    return rows.map((r) => this.rowToMessage(r)).reverse();
  }

  countMessages(roomId: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS n FROM messages WHERE room_id = ?")
      .get(roomId) as { n: number };
    return row.n;
  }

  /* --------------------------- decisions -------------------------- */

  createDecision(decision: {
    id: string;
    roomId: string;
    proposerAgentId: string;
    title: string;
    description?: string | null;
    kind?: string;
  }): DecisionRow {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO decisions (id, room_id, proposer_agent_id, title, description, kind, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
      )
      .run(
        decision.id,
        decision.roomId,
        decision.proposerAgentId,
        decision.title,
        decision.description ?? null,
        decision.kind ?? "general",
        now,
      );
    return {
      id: decision.id,
      roomId: decision.roomId,
      proposerAgentId: decision.proposerAgentId,
      title: decision.title,
      description: decision.description ?? null,
      kind: decision.kind ?? "general",
      status: "open",
      createdAt: now,
      resolvedAt: null,
    };
  }

  getDecision(id: string): DecisionRow | null {
    const row = this.db.prepare("SELECT * FROM decisions WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.rowToDecision(row) : null;
  }

  listDecisions(roomId: string, status?: "open" | DecisionOutcome): DecisionRow[] {
    const rows = (
      status
        ? this.db
            .prepare("SELECT * FROM decisions WHERE room_id = ? AND status = ? ORDER BY created_at")
            .all(roomId, status)
        : this.db
            .prepare("SELECT * FROM decisions WHERE room_id = ? ORDER BY created_at")
            .all(roomId)
    ) as Record<string, unknown>[];
    return rows.map((r) => this.rowToDecision(r));
  }

  resolveDecision(id: string, outcome: DecisionOutcome, now = Date.now()): void {
    this.db
      .prepare("UPDATE decisions SET status = ?, resolved_at = ? WHERE id = ? AND status = 'open'")
      .run(outcome, now, id);
  }

  /* ----------------------------- votes ---------------------------- */

  castVote(vote: {
    decisionId: string;
    agentId: string;
    vote: VoteValue;
    comment?: string | null;
  }): void {
    this.db
      .prepare(
        `INSERT INTO votes (decision_id, agent_id, vote, comment, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(decision_id, agent_id) DO UPDATE SET
           vote = excluded.vote,
           comment = excluded.comment,
           created_at = excluded.created_at`,
      )
      .run(vote.decisionId, vote.agentId, vote.vote, vote.comment ?? null, Date.now());
  }

  listVotes(decisionId: string): VoteRow[] {
    const rows = this.db
      .prepare("SELECT * FROM votes WHERE decision_id = ? ORDER BY created_at")
      .all(decisionId) as Record<string, unknown>[];
    return rows.map((r) => ({
      decisionId: r.decision_id as string,
      agentId: r.agent_id as string,
      vote: r.vote as VoteValue,
      comment: (r.comment as string | null) ?? null,
      createdAt: r.created_at as number,
    }));
  }

  /* --------------------------- lifecycle -------------------------- */

  close(): void {
    this.db.close();
  }

  /* ---------------------------- mapping --------------------------- */

  private rowToSession(row: Record<string, unknown>): AgentSessionRow {
    return {
      agentId: row.agent_id as string,
      roomId: row.room_id as string,
      name: row.name as string,
      provider: row.provider as string,
      model: row.model as string,
      role: row.role as string,
      capabilities: JSON.parse((row.capabilities as string) || "[]") as string[],
      status: row.status as AgentStatus,
      intent: (row.intent as string | null) ?? null,
      sessionToken: row.session_token as string,
      joinedAt: row.joined_at as number,
      lastSeen: row.last_seen as number,
      online: Boolean(row.online),
    };
  }

  private rowToRoomAgent(row: Record<string, unknown>): RoomAgent {
    return {
      id: row.agent_id as string,
      name: row.name as string,
      provider: row.provider as string,
      model: row.model as string,
      role: row.role as string,
      capabilities: JSON.parse((row.capabilities as string) || "[]") as string[],
      status: row.status as AgentStatus,
      intent: (row.intent as string | null) ?? null,
      online: Boolean(row.online),
      lastSeen: row.last_seen as number,
      joinedAt: row.joined_at as number,
    };
  }

  private rowToMessage(row: Record<string, unknown>): StoredMessage {
    return {
      id: row.id as string,
      roomId: row.room_id as string,
      from: {
        agentId: row.agent_id as string,
        name: row.agent_name as string,
        provider: (row.agent_provider as string) ?? "",
        role: (row.agent_role as string) ?? "",
      },
      kind: row.kind as MessageKind,
      payload: JSON.parse(row.payload as string),
      to: (row.to_agent as string | null) ?? null,
      refId: (row.ref_id as string | null) ?? null,
      ts: row.ts as number,
    };
  }

  private rowToDecision(row: Record<string, unknown>): DecisionRow {
    return {
      id: row.id as string,
      roomId: row.room_id as string,
      proposerAgentId: row.proposer_agent_id as string,
      title: row.title as string,
      description: (row.description as string | null) ?? null,
      kind: row.kind as string,
      status: row.status as DecisionRow["status"],
      createdAt: row.created_at as number,
      resolvedAt: (row.resolved_at as number | null) ?? null,
    };
  }
}
