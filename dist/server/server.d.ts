import { type RoomAgent, type StoredMessage } from "../protocol/types.js";
import { ConclaveStore } from "../persistence/store.js";
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
export declare class ConclaveServer {
    readonly store: ConclaveStore;
    private http;
    private wss;
    private decisions;
    private conflictDetectors;
    private connections;
    private rooms;
    private sweepTimer;
    private heartbeatTimeoutMs;
    private sweepIntervalMs;
    private welcomeHistory;
    private log;
    constructor(options?: ConclaveServerOptions);
    listen(port: number, host?: string): Promise<number>;
    close(): Promise<void>;
    private handleConnection;
    private handleFrame;
    private handleHello;
    private handlePublish;
    private runConflictDetection;
    private detachAgent;
    private sweepStale;
    private broadcastMessage;
    private broadcastPresence;
    private sendFrame;
    private requireJoined;
    private roomSockets;
    private conflictDetector;
    private getRoomAgent;
    private handleHttp;
}
export declare function renderTranscript(roomId: string, messages: StoredMessage[], agents: RoomAgent[]): string;
