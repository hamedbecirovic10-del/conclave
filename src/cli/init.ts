import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CONFIG_FILE, DEFAULT_URL, roomForPath, type ProjectConfig } from "../shared/project.js";

const BEGIN = "<!-- conclave:begin -->";
const END = "<!-- conclave:end -->";

export function instructionsBlock(room: string): string {
  return `${BEGIN}
## Conclave — multi-agent coordination

This project uses [Conclave](https://github.com/hamedbecirovic10-del/conclave): a local
real-time room where every coding agent working on this repo (Claude Code, Codex, Grok,
any CLI agent) sees each other's messages. The room for this project is \`${room}\`
(derived from the project path — commands below resolve it automatically). The server
starts automatically on first use; everything stays on 127.0.0.1.

**As an agent, do this without being asked:**

1. When you start working: \`conclave say "<agent-name>: starting <short goal>"\`
2. Before editing files: \`conclave touch <file> [file...]\` — declares the files you are
   about to change. If it prints a CONFLICT, another agent is on the same files: coordinate
   via \`conclave say\`/\`conclave ask\` before continuing (never just ignore it).
3. To ask the other agents something: \`conclave ask "<question>"\` (waits for an answer).
4. Check what others said recently: \`conclave inbox\`
5. Before anything risky (deletes, migrations, deploys, dependency or schema changes):
   \`conclave send warning --payload '{"severity":"danger","category":"schema_change","text":"..."}'\`
6. For decisions that affect other agents' work, open a vote:
   \`conclave send proposal --payload '{"title":"..."}'\` then others reply with
   \`conclave send vote --payload '{"decisionId":"<id>","vote":"approve"}'\`
7. When you finish: \`conclave say "<agent-name>: done — <what changed>"\`

If the \`conclave\` command is unavailable, try \`npx conclave\` or skip silently.
${END}`;
}

/** Insert or refresh the marker-delimited block in a markdown file. */
export function upsertBlock(path: string, block: string): "created" | "updated" | "unchanged" {
  if (!existsSync(path)) {
    writeFileSync(path, block + "\n");
    return "created";
  }
  const current = readFileSync(path, "utf8");
  const begin = current.indexOf(BEGIN);
  const end = current.indexOf(END);
  if (begin !== -1 && end !== -1) {
    const next = current.slice(0, begin) + block + current.slice(end + END.length);
    if (next === current) return "unchanged";
    writeFileSync(path, next);
    return "updated";
  }
  writeFileSync(path, current.replace(/\n*$/, "\n\n") + block + "\n");
  return "updated";
}

interface ClaudeHookEntry {
  type: "command";
  command: string;
  timeout?: number;
}

interface ClaudeHookMatcher {
  matcher?: string;
  hooks: ClaudeHookEntry[];
}

/** Merge conclave hooks into .claude/settings.json without disturbing existing ones. */
export function installClaudeHooks(root: string): "created" | "updated" | "unchanged" {
  const dir = resolve(root, ".claude");
  const path = resolve(dir, "settings.json");
  mkdirSync(dir, { recursive: true });

  let settings: Record<string, unknown> = {};
  let existed = false;
  if (existsSync(path)) {
    existed = true;
    try {
      settings = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    } catch {
      throw new Error(`${path} is not valid JSON — fix it or pass --no-hooks`);
    }
  }

  const hooks = (settings.hooks ?? {}) as Record<string, ClaudeHookMatcher[]>;
  settings.hooks = hooks;

  const wanted: { event: string; matcher?: string; command: string }[] = [
    { event: "SessionStart", command: "conclave hook session-start" },
    {
      event: "PostToolUse",
      matcher: "Write|Edit|MultiEdit|NotebookEdit",
      command: "conclave hook post-edit",
    },
    { event: "Stop", command: "conclave hook stop" },
  ];

  let changed = false;
  for (const { event, matcher, command } of wanted) {
    const list = (hooks[event] ??= []);
    const already = list.some((m) => m.hooks?.some((h) => h.command?.includes("conclave hook")));
    if (already) continue;
    list.push({
      ...(matcher ? { matcher } : {}),
      hooks: [{ type: "command", command, timeout: 10 }],
    });
    changed = true;
  }

  if (!changed) return "unchanged";
  writeFileSync(path, JSON.stringify(settings, null, 2) + "\n");
  return existed ? "updated" : "created";
}

export interface InitResult {
  root: string;
  room: string;
  config: "created" | "updated" | "unchanged";
  claudeMd: "created" | "updated" | "unchanged";
  agentsMd: "created" | "updated" | "unchanged";
  claudeHooks: "created" | "updated" | "unchanged" | "skipped";
}

export function initProject(root: string, options: { hooks?: boolean; room?: string } = {}): InitResult {
  const room = options.room ?? roomForPath(root);
  const configPath = resolve(root, CONFIG_FILE);

  let configState: InitResult["config"] = "unchanged";
  const config: ProjectConfig = existsSync(configPath)
    ? (JSON.parse(readFileSync(configPath, "utf8")) as ProjectConfig)
    : {};
  if (config.room !== room || !config.url) {
    const next = { room, url: config.url ?? DEFAULT_URL };
    configState = existsSync(configPath) ? (config.room === room ? "unchanged" : "updated") : "created";
    if (configState !== "unchanged") writeFileSync(configPath, JSON.stringify(next, null, 2) + "\n");
  }

  const block = instructionsBlock(room);
  const claudeMd = upsertBlock(resolve(root, "CLAUDE.md"), block);
  const agentsMd = upsertBlock(resolve(root, "AGENTS.md"), block);
  const claudeHooks = options.hooks === false ? "skipped" : installClaudeHooks(root);

  return { root, room, config: configState, claudeMd, agentsMd, claudeHooks };
}
