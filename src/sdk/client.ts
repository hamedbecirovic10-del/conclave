import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { ServerFrameSchema } from "../protocol/schemas.js";
import type {
  Activity,
  AgentDescriptor,
  AgentIdentity,
  AgentStatus,
  AnswerPayload,
  ClientFrame,
  DecisionPayload,
  ExecutionRequestPayload,
  ExecutionResultPayload,
  MessageKind,
  ProposalPayload,
  QuestionPayload,
  ReviewPayload,
  RoomAgent,
  ServerFrame,
  StatusPayload,
  StoredMessage,
  TaskPayload,
  ThoughtPayload,
  VotePayload,
  VoteValue,
  WarningPayload,
  WelcomeFrame,
} from "../protocol/types.js";

export interface ConclaveClientOptions {
  /** Server base URL, e.g. ws://127.0.0.1:7777 or http://127.0.0.1:7777 */
  url: string;
  room: string;
  agent: AgentDescriptor;
  /** Interval between heartbeats. Default 5s. */
  heartbeatMs?: number;
  /** Automatically reconnect on unexpected disconnects. Default true. */
  reconnect?: boolean;
  /** Initial reconnect backoff. Default 500ms, doubles up to maxBackoffMs. */
  backoffMs?: number;
  maxBackoffMs?: number;
  maxReconnectAttempts?: number;
}

export interface PublishOptions {
  /** Deliver only to this agent id (still recorded in the room transcript). */
  to?: string;
  /** Reference another message id (answer→question, result→request). */
  refId?: string;
}

interface ConclaveClientEvents {
  connected: [];
  welcome: [WelcomeFrame];
  message: [StoredMessage];
  presence: [{ event: string; agent: RoomAgent }];
  question: [StoredMessage];
  warning: [StoredMessage];
  conflict: [StoredMessage];
  decision: [StoredMessage];
  disconnected: [{ code: number; reason: string }];
  reconnecting: [{ attempt: number; delayMs: number }];
  error: [Error];
}

/**
 * Conclave agent client. Any agent process (Claude Code, Codex, Grok CLI,
 * a custom script…) uses this to join a room, publish structured messages,
 * receive everything happening in the room live, and survive reconnects.
 */
export class ConclaveClient extends EventEmitter<ConclaveClientEvents> {
  private options: Required<Pick<ConclaveClientOptions, "heartbeatMs" | "reconnect" | "backoffMs" | "maxBackoffMs" | "maxReconnectAttempts">> &
    ConclaveClientOptions;
  private socket: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private sessionToken: string | null = null;
  private closedByUser = false;
  private reconnectAttempt = 0;

  /** Identity assigned by the server after the first welcome. */
  agent: AgentIdentity | null = null;
  /** Agents currently known in the room (updated from welcome + presence). */
  readonly roster = new Map<string, RoomAgent>();

  constructor(options: ConclaveClientOptions) {
    super();
    this.options = {
      heartbeatMs: 5_000,
      reconnect: true,
      backoffMs: 500,
      maxBackoffMs: 15_000,
      maxReconnectAttempts: Infinity,
      ...options,
    };
  }

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  get wsUrl(): string {
    const base = this.options.url.replace(/^http/, "ws").replace(/\/+$/, "");
    return `${base}/ws`;
  }

  /** Connect and join the room. Resolves after the server's welcome. */
  connect(): Promise<WelcomeFrame> {
    this.closedByUser = false;
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.wsUrl);
      this.socket = socket;
      let settled = false;

      socket.on("open", () => {
        this.sendFrame({
          op: "hello",
          room: this.options.room,
          agent: this.options.agent,
          ...(this.sessionToken ? { resumeToken: this.sessionToken } : {}),
        });
      });

      socket.on("message", (data) => {
        const frame = this.parseFrame(data.toString());
        if (!frame) return;
        if (frame.op === "welcome") {
          this.sessionToken = frame.sessionToken;
          this.agent = frame.agent;
          this.roster.clear();
          for (const a of frame.agents) this.roster.set(a.id, a);
          this.reconnectAttempt = 0;
          this.startHeartbeat();
          this.emit("connected");
          this.emit("welcome", frame);
          if (!settled) {
            settled = true;
            resolve(frame);
          }
          return;
        }
        this.dispatch(frame);
      });

      socket.on("error", (err) => {
        this.emit("error", err instanceof Error ? err : new Error(String(err)));
        if (!settled) {
          settled = true;
          reject(err);
        }
      });

      socket.on("close", (code, reason) => {
        this.stopHeartbeat();
        this.emit("disconnected", { code, reason: reason.toString() });
        if (!this.closedByUser && this.options.reconnect && code !== 4000 && code !== 4002) {
          this.scheduleReconnect();
        }
      });
    });
  }

  private scheduleReconnect(): void {
    this.reconnectAttempt += 1;
    if (this.reconnectAttempt > this.options.maxReconnectAttempts) return;
    const delayMs = Math.min(
      this.options.backoffMs * 2 ** (this.reconnectAttempt - 1),
      this.options.maxBackoffMs,
    );
    this.emit("reconnecting", { attempt: this.reconnectAttempt, delayMs });
    const timer = setTimeout(() => {
      if (this.closedByUser) return;
      this.connect().catch(() => {
        /* close handler schedules the next attempt */
      });
    }, delayMs);
    timer.unref();
  }

  private dispatch(frame: ServerFrame): void {
    switch (frame.op) {
      case "message": {
        const message = frame.message;
        this.emit("message", message);
        if (message.kind === "question") this.emit("question", message);
        if (message.kind === "warning") this.emit("warning", message);
        if (message.kind === "conflict") this.emit("conflict", message);
        if (message.kind === "decision") this.emit("decision", message);
        return;
      }
      case "presence": {
        this.roster.set(frame.agent.id, frame.agent);
        this.emit("presence", { event: frame.event, agent: frame.agent });
        return;
      }
      case "error": {
        this.emit("error", new Error(`[${frame.code}] ${frame.message}`));
        return;
      }
      case "history_result":
      case "heartbeat_ack":
      case "welcome":
        return;
    }
  }

  private parseFrame(raw: string): ServerFrame | null {
    try {
      const parsed = ServerFrameSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendFrame({ op: "heartbeat" });
    }, this.options.heartbeatMs);
    this.heartbeatTimer.unref();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendFrame(frame: ClientFrame): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(frame));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Publishing                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Low-level publish of any message kind. Returns the message id, which
   * is generated client-side so callers can reference it immediately
   * (e.g. a proposal's id doubles as the decision id).
   */
  publish(kind: MessageKind, payload: unknown, options: PublishOptions = {}): string {
    if (!this.connected) throw new Error("not connected — call connect() first");
    const id = randomUUID();
    this.sendFrame({ op: "publish", id, kind, payload, to: options.to, refId: options.refId });
    return id;
  }

  status(payload: StatusPayload): void {
    this.publish("status", payload);
  }

  thought(text: string): void {
    this.publish("thought", { text } satisfies ThoughtPayload);
  }

  /**
   * Ask a question. Resolves with the first answer message that
   * references it, or rejects after timeoutMs.
   */
  ask(text: string, options: { to?: string; timeoutMs?: number } = {}): Promise<StoredMessage> {
    const timeoutMs = options.timeoutMs ?? 120_000;
    return new Promise((resolve, reject) => {
      const questionId = this.publish("question", { text } satisfies QuestionPayload, {
        to: options.to,
      });
      const onMessage = (message: StoredMessage) => {
        if (message.kind === "answer" && message.refId === questionId) {
          cleanup();
          resolve(message);
        }
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`question timed out after ${timeoutMs}ms: ${text}`));
      }, timeoutMs);
      timer.unref();
      const cleanup = () => {
        clearTimeout(timer);
        this.off("message", onMessage);
      };
      this.on("message", onMessage);
    });
  }

  answer(questionMessageId: string, text: string, options: PublishOptions = {}): void {
    this.publish("answer", { text } satisfies AnswerPayload, {
      ...options,
      refId: questionMessageId,
    });
  }

  warn(payload: WarningPayload): void {
    this.publish("warning", payload);
  }

  /** Open a decision. Returns the proposal message id (= decision id). */
  propose(payload: ProposalPayload): string {
    return this.publish("proposal", payload);
  }

  vote(decisionId: string, vote: VoteValue, comment?: string): void {
    this.publish("vote", { decisionId, vote, comment } satisfies VotePayload);
  }

  /**
   * Propose and wait for the room to decide. Resolves with the decision
   * payload once every other online agent has voted.
   */
  proposeAndWait(payload: ProposalPayload, timeoutMs = 300_000): Promise<DecisionPayload> {
    const decisionId = this.propose(payload);
    return new Promise((resolve, reject) => {
      const onDecision = (message: StoredMessage) => {
        const decision = message.payload as DecisionPayload;
        if (decision.decisionId === decisionId) {
          cleanup();
          resolve(decision);
        }
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`decision ${decisionId} not resolved within ${timeoutMs}ms`));
      }, timeoutMs);
      timer.unref();
      const cleanup = () => {
        clearTimeout(timer);
        this.off("decision", onDecision);
      };
      this.on("decision", onDecision);
    });
  }

  task(payload: TaskPayload): void {
    this.publish("task", payload);
  }

  review(payload: ReviewPayload, options: PublishOptions = {}): void {
    this.publish("review", payload, options);
  }

  requestExecution(payload: ExecutionRequestPayload): string {
    return this.publish("execution_request", payload);
  }

  reportExecution(requestMessageId: string, payload: ExecutionResultPayload): void {
    this.publish("execution_result", payload, { refId: requestMessageId });
  }

  /** Declare current activity so other agents get conflict warnings. */
  declareActivity(activity: Activity, status: AgentStatus = "working", intent?: string): void {
    this.status({ status, intent, activity });
  }

  /** Update presence without publishing a message. */
  updatePresence(fields: { status?: AgentStatus; intent?: string | null; activity?: Activity }): void {
    if (!this.connected) throw new Error("not connected — call connect() first");
    this.sendFrame({ op: "update", ...fields });
  }

  /** Fetch older messages from the server. */
  history(options: { limit?: number; beforeTs?: number } = {}): Promise<StoredMessage[]> {
    if (!this.connected) return Promise.reject(new Error("not connected"));
    return new Promise((resolve, reject) => {
      const socket = this.socket!;
      const onMessage = (data: WebSocket.RawData) => {
        const frame = this.parseFrame(data.toString());
        if (frame?.op === "history_result") {
          socket.off("message", onMessage);
          clearTimeout(timer);
          resolve(frame.messages);
        }
      };
      const timer = setTimeout(() => {
        socket.off("message", onMessage);
        reject(new Error("history request timed out"));
      }, 10_000);
      timer.unref();
      socket.on("message", onMessage);
      this.sendFrame({ op: "history", limit: options.limit ?? 100, beforeTs: options.beforeTs });
    });
  }

  /** Leave the room politely and close the connection. */
  async disconnect(): Promise<void> {
    this.closedByUser = true;
    this.stopHeartbeat();
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.sendFrame({ op: "leave" });
      await new Promise<void>((resolve) => {
        const socket = this.socket!;
        const timer = setTimeout(() => {
          socket.terminate();
          resolve();
        }, 1_000);
        socket.once("close", () => {
          clearTimeout(timer);
          resolve();
        });
        socket.close(1000, "client disconnect");
      });
    } else {
      this.socket?.terminate();
    }
    this.socket = null;
  }

}
