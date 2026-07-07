import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
/**
 * Durable local persistence for rooms, agent sessions, messages,
 * decisions and votes. Backed by SQLite (node:sqlite) in WAL mode so
 * the system survives restarts without any external service.
 */
export class ConclaveStore {
    db;
    constructor(path) {
        if (path !== ":memory:") {
            mkdirSync(dirname(resolve(path)), { recursive: true });
        }
        this.db = new DatabaseSync(path);
        this.db.exec("PRAGMA journal_mode = WAL;");
        this.db.exec("PRAGMA foreign_keys = ON;");
        this.migrate();
    }
    migrate() {
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
    ensureRoom(roomId) {
        this.db
            .prepare("INSERT OR IGNORE INTO rooms (id, created_at) VALUES (?, ?)")
            .run(roomId, Date.now());
    }
    listRooms() {
        const rows = this.db
            .prepare("SELECT id, created_at FROM rooms ORDER BY created_at")
            .all();
        return rows.map((r) => ({ id: r.id, createdAt: r.created_at }));
    }
    clearRoom(roomId) {
        this.db.prepare("DELETE FROM rooms WHERE id = ?").run(roomId);
    }
    /* ------------------------ agent sessions ------------------------ */
    upsertAgentSession(roomId, agent, sessionToken, now = Date.now()) {
        this.db
            .prepare(`INSERT INTO agent_sessions
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
           online = 1`)
            .run(agent.id, roomId, agent.name, agent.provider, agent.model, agent.role, JSON.stringify(agent.capabilities ?? []), agent.status, agent.intent ?? null, sessionToken, now, now);
    }
    findSessionByToken(token) {
        const row = this.db
            .prepare("SELECT * FROM agent_sessions WHERE session_token = ?")
            .get(token);
        return row ? this.rowToSession(row) : null;
    }
    getAgentSession(roomId, agentId) {
        const row = this.db
            .prepare("SELECT * FROM agent_sessions WHERE room_id = ? AND agent_id = ?")
            .get(roomId, agentId);
        return row ? this.rowToSession(row) : null;
    }
    listAgents(roomId) {
        const rows = this.db
            .prepare("SELECT * FROM agent_sessions WHERE room_id = ? ORDER BY joined_at")
            .all(roomId);
        return rows.map((r) => this.rowToRoomAgent(r));
    }
    touchAgent(roomId, agentId, now = Date.now()) {
        this.db
            .prepare("UPDATE agent_sessions SET last_seen = ?, online = 1 WHERE room_id = ? AND agent_id = ?")
            .run(now, roomId, agentId);
    }
    updateAgentState(roomId, agentId, fields) {
        const session = this.getAgentSession(roomId, agentId);
        if (!session)
            return;
        this.db
            .prepare("UPDATE agent_sessions SET status = ?, intent = ?, last_seen = ? WHERE room_id = ? AND agent_id = ?")
            .run(fields.status ?? session.status, fields.intent === undefined ? session.intent : fields.intent, Date.now(), roomId, agentId);
    }
    setAgentOnline(roomId, agentId, online) {
        this.db
            .prepare("UPDATE agent_sessions SET online = ? WHERE room_id = ? AND agent_id = ?")
            .run(online ? 1 : 0, roomId, agentId);
    }
    /** Mark agents offline whose last heartbeat is older than the timeout. */
    sweepStaleAgents(roomId, timeoutMs, now = Date.now()) {
        const cutoff = now - timeoutMs;
        const stale = this.db
            .prepare("SELECT * FROM agent_sessions WHERE room_id = ? AND online = 1 AND last_seen < ?")
            .all(roomId, cutoff);
        if (stale.length > 0) {
            this.db
                .prepare("UPDATE agent_sessions SET online = 0, status = 'offline' WHERE room_id = ? AND online = 1 AND last_seen < ?")
                .run(roomId, cutoff);
        }
        return stale.map((r) => this.rowToRoomAgent({ ...r, online: 0, status: "offline" }));
    }
    /* --------------------------- messages --------------------------- */
    insertMessage(message) {
        const stored = {
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
            .prepare(`INSERT INTO messages
           (id, room_id, agent_id, agent_name, agent_provider, agent_role,
            kind, payload, to_agent, ref_id, ts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(stored.id, stored.roomId, stored.from.agentId, stored.from.name, stored.from.provider, stored.from.role, stored.kind, JSON.stringify(stored.payload ?? null), stored.to ?? null, stored.refId ?? null, stored.ts);
        return stored;
    }
    getMessage(id) {
        const row = this.db.prepare("SELECT * FROM messages WHERE id = ?").get(id);
        return row ? this.rowToMessage(row) : null;
    }
    listMessages(roomId, query = {}) {
        const limit = Math.min(query.limit ?? 100, 1000);
        const clauses = ["room_id = ?"];
        const params = [roomId];
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
            .prepare(`SELECT * FROM messages WHERE ${clauses.join(" AND ")} ORDER BY ts DESC, id DESC LIMIT ?`)
            .all(...params);
        return rows.map((r) => this.rowToMessage(r)).reverse();
    }
    countMessages(roomId) {
        const row = this.db
            .prepare("SELECT COUNT(*) AS n FROM messages WHERE room_id = ?")
            .get(roomId);
        return row.n;
    }
    /* --------------------------- decisions -------------------------- */
    createDecision(decision) {
        const now = Date.now();
        this.db
            .prepare(`INSERT INTO decisions (id, room_id, proposer_agent_id, title, description, kind, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`)
            .run(decision.id, decision.roomId, decision.proposerAgentId, decision.title, decision.description ?? null, decision.kind ?? "general", now);
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
    getDecision(id) {
        const row = this.db.prepare("SELECT * FROM decisions WHERE id = ?").get(id);
        return row ? this.rowToDecision(row) : null;
    }
    listDecisions(roomId, status) {
        const rows = (status
            ? this.db
                .prepare("SELECT * FROM decisions WHERE room_id = ? AND status = ? ORDER BY created_at")
                .all(roomId, status)
            : this.db
                .prepare("SELECT * FROM decisions WHERE room_id = ? ORDER BY created_at")
                .all(roomId));
        return rows.map((r) => this.rowToDecision(r));
    }
    resolveDecision(id, outcome, now = Date.now()) {
        this.db
            .prepare("UPDATE decisions SET status = ?, resolved_at = ? WHERE id = ? AND status = 'open'")
            .run(outcome, now, id);
    }
    /* ----------------------------- votes ---------------------------- */
    castVote(vote) {
        this.db
            .prepare(`INSERT INTO votes (decision_id, agent_id, vote, comment, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(decision_id, agent_id) DO UPDATE SET
           vote = excluded.vote,
           comment = excluded.comment,
           created_at = excluded.created_at`)
            .run(vote.decisionId, vote.agentId, vote.vote, vote.comment ?? null, Date.now());
    }
    listVotes(decisionId) {
        const rows = this.db
            .prepare("SELECT * FROM votes WHERE decision_id = ? ORDER BY created_at")
            .all(decisionId);
        return rows.map((r) => ({
            decisionId: r.decision_id,
            agentId: r.agent_id,
            vote: r.vote,
            comment: r.comment ?? null,
            createdAt: r.created_at,
        }));
    }
    /* --------------------------- lifecycle -------------------------- */
    close() {
        this.db.close();
    }
    /* ---------------------------- mapping --------------------------- */
    rowToSession(row) {
        return {
            agentId: row.agent_id,
            roomId: row.room_id,
            name: row.name,
            provider: row.provider,
            model: row.model,
            role: row.role,
            capabilities: JSON.parse(row.capabilities || "[]"),
            status: row.status,
            intent: row.intent ?? null,
            sessionToken: row.session_token,
            joinedAt: row.joined_at,
            lastSeen: row.last_seen,
            online: Boolean(row.online),
        };
    }
    rowToRoomAgent(row) {
        return {
            id: row.agent_id,
            name: row.name,
            provider: row.provider,
            model: row.model,
            role: row.role,
            capabilities: JSON.parse(row.capabilities || "[]"),
            status: row.status,
            intent: row.intent ?? null,
            online: Boolean(row.online),
            lastSeen: row.last_seen,
            joinedAt: row.joined_at,
        };
    }
    rowToMessage(row) {
        return {
            id: row.id,
            roomId: row.room_id,
            from: {
                agentId: row.agent_id,
                name: row.agent_name,
                provider: row.agent_provider ?? "",
                role: row.agent_role ?? "",
            },
            kind: row.kind,
            payload: JSON.parse(row.payload),
            to: row.to_agent ?? null,
            refId: row.ref_id ?? null,
            ts: row.ts,
        };
    }
    rowToDecision(row) {
        return {
            id: row.id,
            roomId: row.room_id,
            proposerAgentId: row.proposer_agent_id,
            title: row.title,
            description: row.description ?? null,
            kind: row.kind,
            status: row.status,
            createdAt: row.created_at,
            resolvedAt: row.resolved_at ?? null,
        };
    }
}
//# sourceMappingURL=store.js.map