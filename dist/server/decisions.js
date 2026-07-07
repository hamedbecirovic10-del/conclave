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
export class DecisionEngine {
    store;
    constructor(store) {
        this.store = store;
    }
    open(roomId, proposerAgentId, messageId, proposal) {
        this.store.createDecision({
            id: messageId,
            roomId,
            proposerAgentId,
            title: proposal.title,
            description: proposal.description ?? null,
            kind: proposal.kind ?? "general",
        });
    }
    /**
     * Record a vote and resolve the decision if the electorate is complete.
     * Returns the resolution payload when the decision just resolved.
     */
    castVote(roomId, voterAgentId, vote) {
        const decision = this.store.getDecision(vote.decisionId);
        if (!decision || decision.roomId !== roomId) {
            return { error: `unknown decision ${vote.decisionId}` };
        }
        if (decision.status !== "open") {
            return { error: `decision ${vote.decisionId} is already resolved (${decision.status})` };
        }
        if (voterAgentId === decision.proposerAgentId) {
            return { error: "proposer cannot vote on their own proposal" };
        }
        this.store.castVote({
            decisionId: vote.decisionId,
            agentId: voterAgentId,
            vote: vote.vote,
            comment: vote.comment ?? null,
        });
        return this.tryResolve(roomId, vote.decisionId);
    }
    /** Resolve if all eligible (online, non-proposer) agents have voted. */
    tryResolve(roomId, decisionId) {
        const decision = this.store.getDecision(decisionId);
        if (!decision || decision.status !== "open")
            return null;
        const votes = this.store.listVotes(decisionId);
        if (votes.length === 0)
            return null;
        const voted = new Set(votes.map((v) => v.agentId));
        const electorate = this.store
            .listAgents(roomId)
            .filter((a) => a.online && a.id !== decision.proposerAgentId && a.role !== "observer");
        const everyoneVoted = electorate.length > 0 && electorate.every((a) => voted.has(a.id));
        if (!everyoneVoted)
            return null;
        const tally = { approve: 0, reject: 0, request_changes: 0 };
        for (const v of votes)
            tally[v.vote] += 1;
        let outcome;
        if (tally.reject > 0)
            outcome = "rejected";
        else if (tally.request_changes > 0)
            outcome = "changes_requested";
        else
            outcome = "approved";
        this.store.resolveDecision(decisionId, outcome);
        return {
            payload: {
                decisionId,
                title: decision.title,
                outcome,
                tally,
            },
        };
    }
}
//# sourceMappingURL=decisions.js.map