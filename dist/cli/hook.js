import { relative } from "node:path";
import { projectContext } from "../shared/project.js";
import { oneShot, resolveIdentity } from "./oneshot.js";
function readStdin(timeoutMs = 1_500) {
    return new Promise((resolve) => {
        if (process.stdin.isTTY)
            return resolve("");
        let data = "";
        const timer = setTimeout(() => resolve(data), timeoutMs);
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => (data += chunk));
        process.stdin.on("end", () => {
            clearTimeout(timer);
            resolve(data);
        });
        process.stdin.on("error", () => resolve(data));
    });
}
/**
 * Bridge for coding-agent hooks (Claude Code hook JSON on stdin).
 * Fire-and-forget: always exits 0 and never takes more than ~5s, so a
 * missing or slow server can never break the host agent. When another
 * agent's conflict/warning lands in response, it is emitted as
 * additionalContext so the host agent actually sees it.
 */
export async function runHook(event) {
    const guard = setTimeout(() => process.exit(0), 5_000);
    guard.unref();
    try {
        const raw = await readStdin();
        let payload = {};
        try {
            payload = raw ? JSON.parse(raw) : {};
        }
        catch {
            /* not JSON — proceed with defaults */
        }
        const ctx = projectContext(payload.cwd ?? process.cwd());
        const session = (payload.session_id ?? "local").slice(0, 8);
        const agent = resolveIdentity({
            id: process.env.CONCLAVE_AGENT_ID ?? `claude-${session}`,
            name: process.env.CONCLAVE_AGENT_NAME ?? `claude-${session.slice(0, 4)}`,
            provider: process.env.CONCLAVE_AGENT_PROVIDER ?? "anthropic",
            model: process.env.CONCLAVE_AGENT_MODEL ?? "claude",
        });
        if (event === "session-start") {
            await oneShot({ url: ctx.url, room: ctx.room, agent, lingerMs: 200 }, (client) => {
                client.status({ status: "working", intent: "session started" });
            });
            return;
        }
        if (event === "stop" || event === "session-end") {
            await oneShot({ url: ctx.url, room: ctx.room, agent, lingerMs: 200 }, (client) => {
                client.status({ status: "idle", intent: "session idle" });
            });
            return;
        }
        if (event === "post-edit") {
            const file = payload.tool_input?.file_path ?? payload.tool_input?.notebook_path;
            if (!file)
                return;
            const target = relative(ctx.root, file) || file;
            // Skip conclave's own artifacts to avoid noise loops.
            if (target.startsWith(".conclave") || target === "conclave.json")
                return;
            const { reactions } = await oneShot({ url: ctx.url, room: ctx.room, agent, lingerMs: 600 }, (client) => {
                client.declareActivity({ action: "editing", targets: [target] });
            });
            const alerts = reactions.filter((m) => m.kind === "conflict" || m.kind === "warning");
            if (alerts.length > 0) {
                const text = alerts
                    .map((m) => {
                    const p = m.payload;
                    return `Conclave ${m.kind.toUpperCase()}: ${p.detail ?? p.text ?? p.resource ?? ""}`;
                })
                    .join("\n");
                // Claude Code PostToolUse JSON output: surfaces as additional context.
                console.log(JSON.stringify({
                    hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: text },
                }));
            }
            return;
        }
    }
    catch {
        /* never break the host agent */
    }
    finally {
        clearTimeout(guard);
    }
}
//# sourceMappingURL=hook.js.map