/**
 * Bridge for coding-agent hooks (Claude Code hook JSON on stdin).
 * Fire-and-forget: always exits 0 and never takes more than ~5s, so a
 * missing or slow server can never break the host agent. When another
 * agent's conflict/warning lands in response, it is emitted as
 * additionalContext so the host agent actually sees it.
 */
export declare function runHook(event: string): Promise<void>;
