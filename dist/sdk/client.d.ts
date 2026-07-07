import { EventEmitter } from "node:events";
import type { Activity, AgentDescriptor, AgentIdentity, AgentStatus, DecisionPayload, ExecutionRequestPayload, ExecutionResultPayload, MessageKind, ProposalPayload, ReviewPayload, RoomAgent, StatusPayload, StoredMessage, TaskPayload, VoteValue, WarningPayload, WelcomeFrame } from "../protocol/types.js";
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
    presence: [{
        event: string;
        agent: RoomAgent;
    }];
    question: [StoredMessage];
    warning: [StoredMessage];
    conflict: [StoredMessage];
    decision: [StoredMessage];
    disconnected: [{
        code: number;
        reason: string;
    }];
    reconnecting: [{
        attempt: number;
        delayMs: number;
    }];
    error: [Error];
}
/**
 * Conclave agent client. Any agent process (Claude Code, Codex, Grok CLI,
 * a custom script…) uses this to join a room, publish structured messages,
 * receive everything happening in the room live, and survive reconnects.
 */
export declare class ConclaveClient extends EventEmitter<ConclaveClientEvents> {
    private options;
    private socket;
    private heartbeatTimer;
    private sessionToken;
    private closedByUser;
    private reconnectAttempt;
    /** Identity assigned by the server after the first welcome. */
    agent: AgentIdentity | null;
    /** Agents currently known in the room (updated from welcome + presence). */
    readonly roster: Map<string, {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        capabilities: string[];
        online: boolean;
        lastSeen: number;
        joinedAt: number;
        intent?: string | null | undefined;
    }>;
    constructor(options: ConclaveClientOptions);
    get connected(): boolean;
    get wsUrl(): string;
    /** Connect and join the room. Resolves after the server's welcome. */
    connect(): Promise<WelcomeFrame>;
    private scheduleReconnect;
    private dispatch;
    private parseFrame;
    private startHeartbeat;
    private stopHeartbeat;
    private sendFrame;
    /**
     * Low-level publish of any message kind. Returns the message id, which
     * is generated client-side so callers can reference it immediately
     * (e.g. a proposal's id doubles as the decision id).
     */
    publish(kind: MessageKind, payload: unknown, options?: PublishOptions): string;
    status(payload: StatusPayload): void;
    thought(text: string): void;
    /**
     * Ask a question. Resolves with the first answer message that
     * references it, or rejects after timeoutMs.
     */
    ask(text: string, options?: {
        to?: string;
        timeoutMs?: number;
    }): Promise<StoredMessage>;
    answer(questionMessageId: string, text: string, options?: PublishOptions): void;
    warn(payload: WarningPayload): void;
    /** Open a decision. Returns the proposal message id (= decision id). */
    propose(payload: ProposalPayload): string;
    vote(decisionId: string, vote: VoteValue, comment?: string): void;
    /**
     * Propose and wait for the room to decide. Resolves with the decision
     * payload once every other online agent has voted.
     */
    proposeAndWait(payload: ProposalPayload, timeoutMs?: number): Promise<DecisionPayload>;
    task(payload: TaskPayload): void;
    review(payload: ReviewPayload, options?: PublishOptions): void;
    requestExecution(payload: ExecutionRequestPayload): string;
    reportExecution(requestMessageId: string, payload: ExecutionResultPayload): void;
    /** Declare current activity so other agents get conflict warnings. */
    declareActivity(activity: Activity, status?: AgentStatus, intent?: string): void;
    /** Update presence without publishing a message. */
    updatePresence(fields: {
        status?: AgentStatus;
        intent?: string | null;
        activity?: Activity;
    }): void;
    /** Fetch older messages from the server. */
    history(options?: {
        limit?: number;
        beforeTs?: number;
    }): Promise<StoredMessage[]>;
    /** Leave the room politely and close the connection. */
    disconnect(): Promise<void>;
}
export {};
