import { ConclaveClient } from "../sdk/client.js";
import type { AgentDescriptor, StoredMessage } from "../protocol/types.js";
export interface OneShotIdentity {
    id?: string;
    name?: string;
    provider?: string;
    model?: string;
    role?: string;
}
/** Build an agent descriptor from flags + CONCLAVE_AGENT_* env + defaults. */
export declare function resolveIdentity(overrides?: OneShotIdentity): AgentDescriptor;
/**
 * Connect, run an action, wait linger ms for reactions (conflicts,
 * warnings, answers), then disconnect. The workhorse for one-shot CLI
 * commands and editor/agent hooks.
 */
export declare function oneShot<T>(options: {
    url: string;
    room: string;
    agent: AgentDescriptor;
    lingerMs?: number;
    autoStart?: boolean;
}, action: (client: ConclaveClient, reactions: StoredMessage[]) => T | Promise<T>): Promise<{
    result: T;
    reactions: StoredMessage[];
}>;
