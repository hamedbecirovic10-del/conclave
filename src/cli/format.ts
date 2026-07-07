import type { RoomAgent, StoredMessage } from "../protocol/types.js";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code: number) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);

export const dim = wrap(2);
export const bold = wrap(1);
export const red = wrap(31);
export const green = wrap(32);
export const yellow = wrap(33);
export const blue = wrap(34);
export const magenta = wrap(35);
export const cyan = wrap(36);

const KIND_COLOR: Record<string, (s: string) => string> = {
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

function payloadSummary(message: StoredMessage): string {
  const p = message.payload as Record<string, unknown>;
  switch (message.kind) {
    case "thought":
    case "question":
    case "answer":
      return String(p.text ?? "");
    case "status": {
      const activity = p.activity as { action?: string; targets?: string[] } | undefined;
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
      const tally = p.tally as Record<string, number> | undefined;
      return `${p.title}: ${String(p.outcome).toUpperCase()} (${tally?.approve ?? 0} approve / ${tally?.reject ?? 0} reject / ${tally?.request_changes ?? 0} changes)`;
    }
    case "warning":
      return `[${p.severity}/${p.category}] ${p.text}`;
    case "conflict":
      return `${p.resource}: ${p.detail ?? (p.agents as string[])?.join(" vs ")}`;
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

export function formatMessage(message: StoredMessage): string {
  const time = new Date(message.ts).toLocaleTimeString("en-GB");
  const color = KIND_COLOR[message.kind] ?? ((s: string) => s);
  const direct = message.to ? dim(` → ${message.to}`) : "";
  const sender = message.from.agentId === "system" ? yellow("⚙ conclave") : bold(message.from.name);
  return `${dim(time)} ${sender}${direct} ${color(`[${message.kind}]`)} ${payloadSummary(message)}`;
}

export function formatAgent(agent: RoomAgent): string {
  const presence = agent.online ? green("●") : dim("○");
  const intent = agent.intent ? dim(` — ${agent.intent}`) : "";
  return `${presence} ${bold(agent.name)} ${dim(`(${agent.id})`)} ${agent.provider}/${agent.model} · ${agent.role} · ${agent.status}${intent}`;
}
