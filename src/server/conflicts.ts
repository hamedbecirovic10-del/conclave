import type { Activity, ActivityAction, ConflictPayload } from "../protocol/types.js";

interface Claim {
  agentId: string;
  agentName: string;
  action: ActivityAction;
  target: string;
  ts: number;
}

/** Activity categories that conflict with each other on the same target
 *  even when the actions differ (e.g. one agent editing a schema file
 *  while another runs a migration). */
const CONTRACT_ACTIONS: ReadonlySet<ActivityAction> = new Set([
  "api_change",
  "schema_change",
  "migration",
]);

export interface DetectedConflict {
  payload: ConflictPayload;
}

/**
 * Tracks what each agent is currently working on and detects overlaps.
 * Conclave never locks files — it makes agents aware of each other so
 * they can negotiate instead of colliding.
 */
export class ConflictDetector {
  private claims = new Map<string, Claim[]>(); // agentId -> active claims
  private names = new Map<string, string>();

  constructor(private ttlMs = 10 * 60 * 1000) {}

  /** Replace an agent's active claims with its latest declared activity. */
  declare(agentId: string, agentName: string, activity: Activity, now = Date.now()): DetectedConflict[] {
    this.names.set(agentId, agentName);
    const mine: Claim[] = activity.targets.map((target) => ({
      agentId,
      agentName,
      action: activity.action,
      target,
      ts: now,
    }));
    this.claims.set(agentId, mine);
    return this.findOverlaps(mine, now);
  }

  clear(agentId: string): void {
    this.claims.delete(agentId);
  }

  private findOverlaps(mine: Claim[], now: number): DetectedConflict[] {
    const conflicts: DetectedConflict[] = [];
    const cutoff = now - this.ttlMs;
    for (const claim of mine) {
      const others: Claim[] = [];
      for (const [agentId, theirClaims] of this.claims) {
        if (agentId === claim.agentId) continue;
        for (const theirs of theirClaims) {
          if (theirs.ts < cutoff) continue;
          if (theirs.target !== claim.target) continue;
          const sameAction = theirs.action === claim.action;
          const contractOverlap =
            CONTRACT_ACTIONS.has(theirs.action) && CONTRACT_ACTIONS.has(claim.action);
          if (sameAction || contractOverlap) others.push(theirs);
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
