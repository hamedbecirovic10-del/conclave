import type { Activity, ConflictPayload } from "../protocol/types.js";
export interface DetectedConflict {
    payload: ConflictPayload;
}
/**
 * Tracks what each agent is currently working on and detects overlaps.
 * Conclave never locks files — it makes agents aware of each other so
 * they can negotiate instead of colliding.
 */
export declare class ConflictDetector {
    private ttlMs;
    private claims;
    private names;
    constructor(ttlMs?: number);
    /** Replace an agent's active claims with its latest declared activity. */
    declare(agentId: string, agentName: string, activity: Activity, now?: number): DetectedConflict[];
    clear(agentId: string): void;
    private findOverlaps;
}
