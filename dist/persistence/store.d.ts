import type { AgentIdentity, AgentStatus, DecisionOutcome, MessageKind, RoomAgent, StoredMessage, VoteValue } from "../protocol/types.js";
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
export declare class ConclaveStore {
    private db;
    constructor(path: string);
    private migrate;
    ensureRoom(roomId: string): void;
    listRooms(): {
        id: string;
        createdAt: number;
    }[];
    clearRoom(roomId: string): void;
    upsertAgentSession(roomId: string, agent: AgentIdentity, sessionToken: string, now?: number): void;
    findSessionByToken(token: string): AgentSessionRow | null;
    getAgentSession(roomId: string, agentId: string): AgentSessionRow | null;
    listAgents(roomId: string): RoomAgent[];
    touchAgent(roomId: string, agentId: string, now?: number): void;
    updateAgentState(roomId: string, agentId: string, fields: {
        status?: AgentStatus;
        intent?: string | null;
    }): void;
    setAgentOnline(roomId: string, agentId: string, online: boolean): void;
    /** Mark agents offline whose last heartbeat is older than the timeout. */
    sweepStaleAgents(roomId: string, timeoutMs: number, now?: number): RoomAgent[];
    insertMessage(message: Omit<StoredMessage, "id" | "ts"> & {
        id?: string;
        ts?: number;
    }): StoredMessage;
    getMessage(id: string): StoredMessage | null;
    listMessages(roomId: string, query?: MessageQuery): StoredMessage[];
    countMessages(roomId: string): number;
    createDecision(decision: {
        id: string;
        roomId: string;
        proposerAgentId: string;
        title: string;
        description?: string | null;
        kind?: string;
    }): DecisionRow;
    getDecision(id: string): DecisionRow | null;
    listDecisions(roomId: string, status?: "open" | DecisionOutcome): DecisionRow[];
    resolveDecision(id: string, outcome: DecisionOutcome, now?: number): void;
    castVote(vote: {
        decisionId: string;
        agentId: string;
        vote: VoteValue;
        comment?: string | null;
    }): void;
    listVotes(decisionId: string): VoteRow[];
    close(): void;
    private rowToSession;
    private rowToRoomAgent;
    private rowToMessage;
    private rowToDecision;
}
