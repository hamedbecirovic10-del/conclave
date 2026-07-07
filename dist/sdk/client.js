import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { ServerFrameSchema } from "../protocol/schemas.js";
/**
 * Conclave agent client. Any agent process (Claude Code, Codex, Grok CLI,
 * a custom script…) uses this to join a room, publish structured messages,
 * receive everything happening in the room live, and survive reconnects.
 */
export class ConclaveClient extends EventEmitter {
    options;
    socket = null;
    heartbeatTimer = null;
    sessionToken = null;
    closedByUser = false;
    reconnectAttempt = 0;
    /** Identity assigned by the server after the first welcome. */
    agent = null;
    /** Agents currently known in the room (updated from welcome + presence). */
    roster = new Map();
    constructor(options) {
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
    get connected() {
        return this.socket?.readyState === WebSocket.OPEN;
    }
    get wsUrl() {
        const base = this.options.url.replace(/^http/, "ws").replace(/\/+$/, "");
        return `${base}/ws`;
    }
    /** Connect and join the room. Resolves after the server's welcome. */
    connect() {
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
                if (!frame)
                    return;
                if (frame.op === "welcome") {
                    this.sessionToken = frame.sessionToken;
                    this.agent = frame.agent;
                    this.roster.clear();
                    for (const a of frame.agents)
                        this.roster.set(a.id, a);
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
    scheduleReconnect() {
        this.reconnectAttempt += 1;
        if (this.reconnectAttempt > this.options.maxReconnectAttempts)
            return;
        const delayMs = Math.min(this.options.backoffMs * 2 ** (this.reconnectAttempt - 1), this.options.maxBackoffMs);
        this.emit("reconnecting", { attempt: this.reconnectAttempt, delayMs });
        const timer = setTimeout(() => {
            if (this.closedByUser)
                return;
            this.connect().catch(() => {
                /* close handler schedules the next attempt */
            });
        }, delayMs);
        timer.unref();
    }
    dispatch(frame) {
        switch (frame.op) {
            case "message": {
                const message = frame.message;
                this.emit("message", message);
                if (message.kind === "question")
                    this.emit("question", message);
                if (message.kind === "warning")
                    this.emit("warning", message);
                if (message.kind === "conflict")
                    this.emit("conflict", message);
                if (message.kind === "decision")
                    this.emit("decision", message);
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
    parseFrame(raw) {
        try {
            const parsed = ServerFrameSchema.safeParse(JSON.parse(raw));
            return parsed.success ? parsed.data : null;
        }
        catch {
            return null;
        }
    }
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            this.sendFrame({ op: "heartbeat" });
        }, this.options.heartbeatMs);
        this.heartbeatTimer.unref();
    }
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    sendFrame(frame) {
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
    publish(kind, payload, options = {}) {
        if (!this.connected)
            throw new Error("not connected — call connect() first");
        const id = randomUUID();
        this.sendFrame({ op: "publish", id, kind, payload, to: options.to, refId: options.refId });
        return id;
    }
    status(payload) {
        this.publish("status", payload);
    }
    thought(text) {
        this.publish("thought", { text });
    }
    /**
     * Ask a question. Resolves with the first answer message that
     * references it, or rejects after timeoutMs.
     */
    ask(text, options = {}) {
        const timeoutMs = options.timeoutMs ?? 120_000;
        return new Promise((resolve, reject) => {
            const questionId = this.publish("question", { text }, {
                to: options.to,
            });
            const onMessage = (message) => {
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
    answer(questionMessageId, text, options = {}) {
        this.publish("answer", { text }, {
            ...options,
            refId: questionMessageId,
        });
    }
    warn(payload) {
        this.publish("warning", payload);
    }
    /** Open a decision. Returns the proposal message id (= decision id). */
    propose(payload) {
        return this.publish("proposal", payload);
    }
    vote(decisionId, vote, comment) {
        this.publish("vote", { decisionId, vote, comment });
    }
    /**
     * Propose and wait for the room to decide. Resolves with the decision
     * payload once every other online agent has voted.
     */
    proposeAndWait(payload, timeoutMs = 300_000) {
        const decisionId = this.propose(payload);
        return new Promise((resolve, reject) => {
            const onDecision = (message) => {
                const decision = message.payload;
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
    task(payload) {
        this.publish("task", payload);
    }
    review(payload, options = {}) {
        this.publish("review", payload, options);
    }
    requestExecution(payload) {
        return this.publish("execution_request", payload);
    }
    reportExecution(requestMessageId, payload) {
        this.publish("execution_result", payload, { refId: requestMessageId });
    }
    /** Declare current activity so other agents get conflict warnings. */
    declareActivity(activity, status = "working", intent) {
        this.status({ status, intent, activity });
    }
    /** Update presence without publishing a message. */
    updatePresence(fields) {
        if (!this.connected)
            throw new Error("not connected — call connect() first");
        this.sendFrame({ op: "update", ...fields });
    }
    /** Fetch older messages from the server. */
    history(options = {}) {
        if (!this.connected)
            return Promise.reject(new Error("not connected"));
        return new Promise((resolve, reject) => {
            const socket = this.socket;
            const onMessage = (data) => {
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
    async disconnect() {
        this.closedByUser = true;
        this.stopHeartbeat();
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.sendFrame({ op: "leave" });
            await new Promise((resolve) => {
                const socket = this.socket;
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
        }
        else {
            this.socket?.terminate();
        }
        this.socket = null;
    }
}
//# sourceMappingURL=client.js.map