const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
export const dim = wrap(2);
export const bold = wrap(1);
export const red = wrap(31);
export const green = wrap(32);
export const yellow = wrap(33);
export const blue = wrap(34);
export const magenta = wrap(35);
export const cyan = wrap(36);
const KIND_COLOR = {
    status: dim,
    thought: cyan,
    proposal: magenta,
    question: blue,
    answer: blue,
    warning: yellow,
    conflict: red,
    decision: green,
    vote: magenta,
    task: cyan,
    review: cyan,
    execution_request: yellow,
    execution_result: dim,
};
function payloadSummary(message) {
    const p = message.payload;
    switch (message.kind) {
        case "thought":
        case "question":
        case "answer":
            return String(p.text ?? "");
        case "status": {
            const activity = p.activity;
            return [
                String(p.status ?? ""),
                p.intent ? `— ${p.intent}` : "",
                activity ? `[${activity.action}: ${(activity.targets ?? []).join(", ")}]` : "",
            ]
                .filter(Boolean)
                .join(" ");
        }
        case "proposal":
            return `${p.title}${p.kind && p.kind !== "general" ? ` (${p.kind})` : ""} — decision ${message.id}`;
        case "vote":
            return `${p.vote} on ${p.decisionId}${p.comment ? ` — ${p.comment}` : ""}`;
        case "decision": {
            const tally = p.tally;
            return `${p.title}: ${String(p.outcome).toUpperCase()} (${tally?.approve ?? 0} approve / ${tally?.reject ?? 0} reject / ${tally?.request_changes ?? 0} changes)`;
        }
        case "warning":
            return `[${p.severity}/${p.category}] ${p.text}`;
        case "conflict":
            return `${p.resource}: ${p.detail ?? p.agents?.join(" vs ")}`;
        case "task":
            return `${p.taskId} ${p.state}: ${p.title}${p.assignee ? ` → ${p.assignee}` : ""}`;
        case "review":
            return `${p.target}${p.verdict ? ` [${p.verdict}]` : ""}: ${p.comments}`;
        case "execution_request":
            return `$ ${p.command}${p.reason ? ` (${p.reason})` : ""}`;
        case "execution_result":
            return `${p.success ? "ok" : "FAILED"}${p.exitCode !== undefined ? ` exit=${p.exitCode}` : ""}${p.output ? ` — ${String(p.output).slice(0, 200)}` : ""}`;
        default:
            return JSON.stringify(p);
    }
}
export function formatMessage(message) {
    const time = new Date(message.ts).toLocaleTimeString("en-GB");
    const color = KIND_COLOR[message.kind] ?? ((s) => s);
    const direct = message.to ? dim(` → ${message.to}`) : "";
    const sender = message.from.agentId === "system" ? yellow("⚙ conclave") : bold(message.from.name);
    return `${dim(time)} ${sender}${direct} ${color(`[${message.kind}]`)} ${payloadSummary(message)}`;
}
export function formatAgent(agent) {
    const presence = agent.online ? green("●") : dim("○");
    const intent = agent.intent ? dim(` — ${agent.intent}`) : "";
    return `${presence} ${bold(agent.name)} ${dim(`(${agent.id})`)} ${agent.provider}/${agent.model} · ${agent.role} · ${agent.status}${intent}`;
}
//# sourceMappingURL=format.js.map