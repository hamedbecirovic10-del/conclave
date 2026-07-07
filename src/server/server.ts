import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import {
  ClientFrameSchema,
  validatePayload,
} from "../protocol/schemas.js";
import {
  SYSTEM_SENDER,
  type Activity,
  type AgentIdentity,
  type ClientFrame,
  type PresenceEvent,
  type ProposalPayload,
  type RoomAgent,
  type ServerFrame,
  type StatusPayload,
  type StoredMessage,
  type VotePayload,
} from "../protocol/types.js";
import { ConclaveStore } from "../persistence/store.js";
import { ConflictDetector } from "./conflicts.js";
import { DecisionEngine } from "./decisions.js";
import { assessCommand } from "./safety.js";

export interface ConclaveServerOptions {
  dbPath?: string;
  /** Agents missing heartbeats for this long are marked offline. */
  heartbeatTimeoutMs?: number;
  /** How often stale agents are swept. */
  sweepIntervalMs?: number;
  /** How many recent messages are replayed on join. */
  welcomeHistory?: number;
  log?: (line: string) => void;
}

interface ConnectionState {
  socket: WebSocket;
  roomId: string | null;
  agentId: string | null;
}

export class ConclaveServer {
  readonly store: ConclaveStore;
  private http: HttpServer;
  private wss: WebSocketServer;
  private decisions: DecisionEngine;
  private conflictDetectors = new Map<string, ConflictDetector>();
  private connections = new Map<WebSocket, ConnectionState>();
  private rooms = new Map<string, Map<string, WebSocket>>(); // roomId -> agentId -> socket
  private sweepTimer: NodeJS.Timeout | null = null;
  private heartbeatTimeoutMs: number;
  private sweepIntervalMs: number;
  private welcomeHistory: number;
  private log: (line: string) => void;

  constructor(options: ConclaveServerOptions = {}) {
    this.store = new ConclaveStore(options.dbPath ?? ":memory:");
    this.decisions = new DecisionEngine(this.store);
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 15_000;
    this.sweepIntervalMs = options.sweepIntervalMs ?? 5_000;
    this.welcomeHistory = options.welcomeHistory ?? 50;
    this.log = options.log ?? (() => {});

    this.http = createServer((req, res) => this.handleHttp(req, res));
    this.wss = new WebSocketServer({ server: this.http, path: "/ws" });
    this.wss.on("connection", (socket) => this.handleConnection(socket));
  }

  listen(port: number, host = "127.0.0.1"): Promise<number> {
    return new Promise((resolvePromise, reject) => {
      this.http.once("error", reject);
      this.http.listen(port, host, () => {
        this.sweepTimer = setInterval(() => this.sweepStale(), this.sweepIntervalMs);
        this.sweepTimer.unref();
        const address = this.http.address();
        const boundPort = typeof address === "object" && address ? address.port : port;
        this.log(`conclave server listening on ${host}:${boundPort}`);
        resolvePromise(boundPort);
      });
    });
  }

  async close(): Promise<void> {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    for (const socket of this.connections.keys()) socket.terminate();
    await new Promise<void>((r) => this.wss.close(() => r()));
    await new Promise<void>((r) => this.http.close(() => r()));
    this.store.close();
  }

  /* ------------------------------------------------------------------ */
  /* WebSocket handling                                                  */
  /* ------------------------------------------------------------------ */

  private handleConnection(socket: WebSocket): void {
    const state: ConnectionState = { socket, roomId: null, agentId: null };
    this.connections.set(socket, state);

    socket.on("message", (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        this.sendFrame(socket, { op: "error", code: "bad_json", message: "frame is not valid JSON" });
        return;
      }
      const frame = ClientFrameSchema.safeParse(parsed);
      if (!frame.success) {
        const issue = frame.error.issues[0];
        this.sendFrame(socket, {
          op: "error",
          code: "bad_frame",
          message: `invalid frame: ${issue ? `${issue.path.join(".") || "(root)"} ${issue.message}` : "validation failed"}`,
        });
        return;
      }
      try {
        this.handleFrame(state, frame.data);
      } catch (err) {
        this.sendFrame(socket, {
          op: "error",
          code: "internal",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    });

    socket.on("close", () => {
      this.connections.delete(socket);
      if (state.roomId && state.agentId) {
        this.detachAgent(state.roomId, state.agentId, socket, "offline");
      }
    });
  }

  private handleFrame(state: ConnectionState, frame: ClientFrame): void {
    switch (frame.op) {
      case "hello":
        this.handleHello(state, frame);
        return;
      case "heartbeat": {
        if (!this.requireJoined(state)) return;
        this.store.touchAgent(state.roomId!, state.agentId!);
        this.sendFrame(state.socket, { op: "heartbeat_ack", ts: Date.now() });
        return;
      }
      case "publish":
        if (!this.requireJoined(state)) return;
        this.handlePublish(state, frame.kind, frame.payload, frame.to, frame.refId, frame.id);
        return;
      case "update": {
        if (!this.requireJoined(state)) return;
        this.store.updateAgentState(state.roomId!, state.agentId!, {
          status: frame.status,
          intent: frame.intent === undefined ? undefined : frame.intent,
        });
        const agent = this.getRoomAgent(state.roomId!, state.agentId!);
        if (agent) this.broadcastPresence(state.roomId!, "updated", agent);
        if (frame.activity) {
          this.runConflictDetection(state.roomId!, state.agentId!, frame.activity);
        }
        return;
      }
      case "history": {
        if (!this.requireJoined(state)) return;
        const messages = this.store.listMessages(state.roomId!, {
          limit: frame.limit,
          beforeTs: frame.beforeTs,
        });
        this.sendFrame(state.socket, { op: "history_result", messages });
        return;
      }
      case "leave": {
        if (!state.roomId || !state.agentId) return;
        this.detachAgent(state.roomId, state.agentId, state.socket, "left");
        state.roomId = null;
        state.agentId = null;
        return;
      }
    }
  }

  private handleHello(
    state: ConnectionState,
    frame: Extract<ClientFrame, { op: "hello" }>,
  ): void {
    let agent: AgentIdentity;
    let resumed = false;
    let sessionToken: string;

    const resumedSession = frame.resumeToken
      ? this.store.findSessionByToken(frame.resumeToken)
      : null;

    if (resumedSession && resumedSession.roomId === frame.room) {
      resumed = true;
      sessionToken = resumedSession.sessionToken;
      agent = {
        id: resumedSession.agentId,
        name: frame.agent.name,
        provider: frame.agent.provider,
        model: frame.agent.model,
        role: frame.agent.role,
        capabilities: frame.agent.capabilities ?? [],
        status: frame.agent.status ?? resumedSession.status,
        intent: frame.agent.intent ?? resumedSession.intent,
      };
    } else {
      sessionToken = randomUUID();
      agent = {
        id: frame.agent.id ?? randomUUID(),
        name: frame.agent.name,
        provider: frame.agent.provider,
        model: frame.agent.model,
        role: frame.agent.role,
        capabilities: frame.agent.capabilities ?? [],
        status: frame.agent.status ?? "idle",
        intent: frame.agent.intent ?? null,
      };
    }

    this.store.ensureRoom(frame.room);
    this.store.upsertAgentSession(frame.room, agent, sessionToken);

    // Replace any previous socket for this agent (reconnect with same id).
    const roomSockets = this.roomSockets(frame.room);
    const previous = roomSockets.get(agent.id);
    if (previous && previous !== state.socket) {
      const prevState = this.connections.get(previous);
      if (prevState) {
        prevState.roomId = null;
        prevState.agentId = null;
      }
      previous.close(4000, "replaced by a newer connection for the same agent");
    }
    roomSockets.set(agent.id, state.socket);
    state.roomId = frame.room;
    state.agentId = agent.id;

    const roomAgent = this.getRoomAgent(frame.room, agent.id);
    this.sendFrame(state.socket, {
      op: "welcome",
      room: frame.room,
      agent,
      sessionToken,
      agents: this.store.listAgents(frame.room),
      recent: this.store.listMessages(frame.room, { limit: this.welcomeHistory }),
      resumed,
    });
    if (roomAgent) {
      this.broadcastPresence(frame.room, resumed ? "reconnected" : "joined", roomAgent, agent.id);
    }
    this.log(`${agent.name} (${agent.id}) ${resumed ? "reconnected to" : "joined"} room ${frame.room}`);
  }

  private handlePublish(
    state: ConnectionState,
    kind: StoredMessage["kind"],
    rawPayload: unknown,
    to?: string,
    refId?: string,
    clientId?: string,
  ): void {
    const roomId = state.roomId!;
    const agentId = state.agentId!;
    if (clientId && this.store.getMessage(clientId)) {
      this.sendFrame(state.socket, {
        op: "error",
        code: "duplicate_id",
        message: `message id ${clientId} already exists`,
      });
      return;
    }
    const validation = validatePayload(kind, rawPayload);
    if (!validation.ok) {
      this.sendFrame(state.socket, { op: "error", code: "bad_payload", message: validation.error });
      return;
    }
    const payload = validation.payload;
    const session = this.store.getAgentSession(roomId, agentId);
    if (!session) {
      this.sendFrame(state.socket, { op: "error", code: "no_session", message: "agent session not found" });
      return;
    }
    this.store.touchAgent(roomId, agentId);

    const sender = {
      agentId,
      name: session.name,
      provider: session.provider,
      role: session.role,
    };

    // Votes are validated against the decision before being persisted.
    if (kind === "vote") {
      const vote = payload as VotePayload;
      const result = this.decisions.castVote(roomId, agentId, vote);
      if (result && "error" in result) {
        this.sendFrame(state.socket, { op: "error", code: "bad_vote", message: result.error });
        return;
      }
      const voteMessage = this.store.insertMessage({
        id: clientId, roomId, from: sender, kind, payload, to: to ?? null, refId: vote.decisionId,
      });
      this.broadcastMessage(roomId, voteMessage);
      if (result && "payload" in result) {
        const decisionMessage = this.store.insertMessage({
          roomId,
          from: SYSTEM_SENDER,
          kind: "decision",
          payload: result.payload,
          refId: result.payload.decisionId,
        });
        this.broadcastMessage(roomId, decisionMessage);
        this.log(`decision ${result.payload.decisionId} resolved: ${result.payload.outcome}`);
      }
      return;
    }

    // Dangerous execution requests trigger a mandatory system warning first.
    if (kind === "execution_request") {
      const request = payload as { command: string };
      const assessment = assessCommand(request.command);
      if (assessment.dangerous) {
        const warning = this.store.insertMessage({
          roomId,
          from: SYSTEM_SENDER,
          kind: "warning",
          payload: {
            severity: assessment.severity,
            category: assessment.category,
            text: `${session.name} is about to run a ${assessment.reason}: \`${request.command}\`. Object now if this affects your work.`,
            targets: [request.command],
          },
        });
        this.broadcastMessage(roomId, warning);
      }
    }

    const message = this.store.insertMessage({
      id: clientId, roomId, from: sender, kind, payload, to: to ?? null, refId: refId ?? null,
    });

    // Proposals open a decision keyed by the proposal message id.
    if (kind === "proposal") {
      this.decisions.open(roomId, agentId, message.id, payload as ProposalPayload);
    }

    // Status messages update presence and feed conflict detection.
    if (kind === "status") {
      const status = payload as StatusPayload;
      this.store.updateAgentState(roomId, agentId, {
        status: status.status,
        intent: status.intent ?? undefined,
      });
      const agent = this.getRoomAgent(roomId, agentId);
      if (agent) this.broadcastPresence(roomId, "updated", agent, agentId);
      this.broadcastMessage(roomId, message);
      if (status.activity) this.runConflictDetection(roomId, agentId, status.activity);
      return;
    }

    this.broadcastMessage(roomId, message);
  }

  private runConflictDetection(roomId: string, agentId: string, activity: Activity): void {
    const session = this.store.getAgentSession(roomId, agentId);
    if (!session) return;
    const detector = this.conflictDetector(roomId);
    const conflicts = detector.declare(agentId, session.name, activity);
    for (const conflict of conflicts) {
      const message = this.store.insertMessage({
        roomId,
        from: SYSTEM_SENDER,
        kind: "conflict",
        payload: conflict.payload,
      });
      this.broadcastMessage(roomId, message);
      this.log(`conflict in ${roomId}: ${conflict.payload.detail ?? conflict.payload.resource}`);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Presence and broadcast                                              */
  /* ------------------------------------------------------------------ */

  private detachAgent(roomId: string, agentId: string, socket: WebSocket, event: "left" | "offline"): void {
    const roomSockets = this.rooms.get(roomId);
    if (roomSockets?.get(agentId) === socket) {
      roomSockets.delete(agentId);
      this.store.setAgentOnline(roomId, agentId, false);
      if (event === "left") {
        this.store.updateAgentState(roomId, agentId, { status: "offline" });
      }
      this.conflictDetector(roomId).clear(agentId);
      const agent = this.getRoomAgent(roomId, agentId);
      if (agent) this.broadcastPresence(roomId, event, agent);
      this.log(`${agentId} ${event} room ${roomId}`);
    }
  }

  private sweepStale(): void {
    for (const [roomId] of this.rooms) {
      const stale = this.store.sweepStaleAgents(roomId, this.heartbeatTimeoutMs);
      for (const agent of stale) {
        const roomSockets = this.rooms.get(roomId);
        const socket = roomSockets?.get(agent.id);
        if (socket) {
          roomSockets!.delete(agent.id);
          socket.close(4001, "heartbeat timeout");
        }
        this.conflictDetector(roomId).clear(agent.id);
        this.broadcastPresence(roomId, "offline", agent);
        this.log(`${agent.name} (${agent.id}) timed out in room ${roomId}`);
      }
    }
  }

  private broadcastMessage(roomId: string, message: StoredMessage): void {
    const frame: ServerFrame = { op: "message", message };
    const sockets = this.rooms.get(roomId);
    if (!sockets) return;
    for (const [agentId, socket] of sockets) {
      // Direct messages are delivered to the target and echoed to the sender;
      // they remain part of the persistent room transcript.
      if (message.to && agentId !== message.to && agentId !== message.from.agentId) continue;
      this.sendFrame(socket, frame);
    }
  }

  private broadcastPresence(roomId: string, event: PresenceEvent, agent: RoomAgent, exceptAgentId?: string): void {
    const sockets = this.rooms.get(roomId);
    if (!sockets) return;
    for (const [agentId, socket] of sockets) {
      if (exceptAgentId && agentId === exceptAgentId) continue;
      this.sendFrame(socket, { op: "presence", event, agent });
    }
  }

  private sendFrame(socket: WebSocket, frame: ServerFrame): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(frame));
    }
  }

  private requireJoined(state: ConnectionState): boolean {
    if (!state.roomId || !state.agentId) {
      this.sendFrame(state.socket, {
        op: "error",
        code: "not_joined",
        message: "send a hello frame before any other operation",
      });
      return false;
    }
    return true;
  }

  private roomSockets(roomId: string): Map<string, WebSocket> {
    let sockets = this.rooms.get(roomId);
    if (!sockets) {
      sockets = new Map();
      this.rooms.set(roomId, sockets);
    }
    return sockets;
  }

  private conflictDetector(roomId: string): ConflictDetector {
    let detector = this.conflictDetectors.get(roomId);
    if (!detector) {
      detector = new ConflictDetector();
      this.conflictDetectors.set(roomId, detector);
    }
    return detector;
  }

  private getRoomAgent(roomId: string, agentId: string): RoomAgent | null {
    return this.store.listAgents(roomId).find((a) => a.id === agentId) ?? null;
  }

  /* ------------------------------------------------------------------ */
  /* HTTP API (used by the CLI for queries and exports)                  */
  /* ------------------------------------------------------------------ */

  private handleHttp(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? "/", "http://localhost");
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body, null, 2));
    };

    try {
      if (req.method === "GET" && url.pathname === "/health") {
        send(200, { ok: true, ts: Date.now() });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/rooms") {
        send(200, { rooms: this.store.listRooms() });
        return;
      }

      const roomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)(\/(agents|messages|decisions|export))?$/);
      if (roomMatch) {
        const roomId = decodeURIComponent(roomMatch[1]!);
        const section = roomMatch[3];

        if (req.method === "DELETE" && !section) {
          this.store.clearRoom(roomId);
          this.conflictDetectors.delete(roomId);
          const sockets = this.rooms.get(roomId);
          if (sockets) {
            for (const socket of sockets.values()) socket.close(4002, "room cleared");
            this.rooms.delete(roomId);
          }
          send(200, { ok: true, cleared: roomId });
          return;
        }
        if (req.method !== "GET") {
          send(405, { error: "method not allowed" });
          return;
        }
        if (section === "agents") {
          send(200, { agents: this.store.listAgents(roomId) });
          return;
        }
        if (section === "messages") {
          const limit = Number(url.searchParams.get("limit") ?? 100);
          const kind = url.searchParams.get("kind") ?? undefined;
          send(200, {
            messages: this.store.listMessages(roomId, {
              limit: Number.isFinite(limit) ? limit : 100,
              kind: kind as StoredMessage["kind"] | undefined,
            }),
          });
          return;
        }
        if (section === "decisions") {
          const decisions = this.store.listDecisions(roomId).map((d) => ({
            ...d,
            votes: this.store.listVotes(d.id),
          }));
          send(200, { decisions });
          return;
        }
        if (section === "export") {
          const format = url.searchParams.get("format") ?? "json";
          const messages = this.store.listMessages(roomId, { limit: 1000 });
          if (format === "md") {
            res.writeHead(200, { "content-type": "text/markdown" });
            res.end(renderTranscript(roomId, messages, this.store.listAgents(roomId)));
          } else {
            send(200, {
              room: roomId,
              exportedAt: Date.now(),
              agents: this.store.listAgents(roomId),
              decisions: this.store.listDecisions(roomId).map((d) => ({
                ...d,
                votes: this.store.listVotes(d.id),
              })),
              messages,
            });
          }
          return;
        }
        if (!section) {
          send(200, {
            room: roomId,
            agents: this.store.listAgents(roomId),
            messageCount: this.store.countMessages(roomId),
          });
          return;
        }
      }

      send(404, { error: "not found" });
    } catch (err) {
      send(500, { error: err instanceof Error ? err.message : String(err) });
    }
  }
}

export function renderTranscript(roomId: string, messages: StoredMessage[], agents: RoomAgent[]): string {
  const lines: string[] = [
    `# Conclave transcript — room \`${roomId}\``,
    "",
    `Exported ${new Date().toISOString()} · ${messages.length} messages`,
    "",
    "## Agents",
    "",
    ...agents.map(
      (a) =>
        `- **${a.name}** (\`${a.id}\`) — ${a.provider}/${a.model}, role: ${a.role}${a.online ? ", online" : ""}`,
    ),
    "",
    "## Messages",
    "",
  ];
  for (const m of messages) {
    const time = new Date(m.ts).toISOString();
    const direct = m.to ? ` → \`${m.to}\`` : "";
    lines.push(`### ${time} · **${m.from.name}** · \`${m.kind}\`${direct}`);
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(m.payload, null, 2));
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}
