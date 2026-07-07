/** Activity categories that conflict with each other on the same target
 *  even when the actions differ (e.g. one agent editing a schema file
 *  while another runs a migration). */
const CONTRACT_ACTIONS = new Set([
    "api_change",
    "schema_change",
    "migration",
]);
/**
 * Tracks what each agent is currently working on and detects overlaps.
 * Conclave never locks files — it makes agents aware of each other so
 * they can negotiate instead of colliding.
 */
export class ConflictDetector {
    ttlMs;
    claims = new Map(); // agentId -> active claims
    names = new Map();
    constructor(ttlMs = 10 * 60 * 1000) {
        this.ttlMs = ttlMs;
    }
    /** Replace an agent's active claims with its latest declared activity. */
    declare(agentId, agentName, activity, now = Date.now()) {
        this.names.set(agentId, agentName);
        const mine = activity.targets.map((target) => ({
            agentId,
            agentName,
            action: activity.action,
            target,
            ts: now,
        }));
        this.claims.set(agentId, mine);
        return this.findOverlaps(mine, now);
    }
    clear(agentId) {
        this.claims.delete(agentId);
    }
    findOverlaps(mine, now) {
        const conflicts = [];
        const cutoff = now - this.ttlMs;
        for (const claim of mine) {
            const others = [];
            for (const [agentId, theirClaims] of this.claims) {
                if (agentId === claim.agentId)
                    continue;
                for (const theirs of theirClaims) {
                    if (theirs.ts < cutoff)
                        continue;
                    if (theirs.target !== claim.target)
                        continue;
                    const sameAction = theirs.action === claim.action;
                    const contractOverlap = CONTRACT_ACTIONS.has(theirs.action) && CONTRACT_ACTIONS.has(claim.action);
                    if (sameAction || contractOverlap)
                        others.push(theirs);
                }
            }
            if (others.length > 0) {
                const agents = [claim.agentId, ...others.map((o) => o.agentId)];
                const names = [claim.agentName, ...others.map((o) => o.agentName)];
                conflicts.push({
                    payload: {
                        resource: claim.target,
                        category: claim.action,
                        agents,
                        detail: `${names.join(" and ")} are both working on ${claim.target} (${claim.action}). Coordinate before continuing.`,
                    },
                });
            }
        }
        return conflicts;
    }
}
//# sourceMappingURL=conflicts.js.map