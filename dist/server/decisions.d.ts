import type { ConclaveStore } from "../persistence/store.js";
import type { DecisionPayload, ProposalPayload, VotePayload } from "../protocol/types.js";
export interface DecisionResolution {
    payload: DecisionPayload;
}
/**
 * Decision protocol:
 *  - a `proposal` message opens a decision (id = proposal message id)
 *  - agents cast `vote` messages (approve / reject / request_changes);
 *    the latest vote per agent counts
 *  - the decision resolves once every *other currently online* agent in
 *    the room has voted: any reject → rejected, else any
 *    request_changes → changes_requested, else approved
 *  - resolution is persisted and broadcast as a system `decision` message
 */
export declare class DecisionEngine {
    private store;
    constructor(store: ConclaveStore);
    open(roomId: string, proposerAgentId: string, messageId: string, proposal: ProposalPayload): void;
    /**
     * Record a vote and resolve the decision if the electorate is complete.
     * Returns the resolution payload when the decision just resolved.
     */
    castVote(roomId: string, voterAgentId: string, vote: VotePayload): DecisionResolution | {
        error: string;
    } | null;
    /** Resolve if all eligible (online, non-proposer) agents have voted. */
    tryResolve(roomId: string, decisionId: string): DecisionResolution | null;
}
