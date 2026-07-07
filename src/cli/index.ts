#!/usr/bin/env node
import { Command } from "commander";
import { createInterface } from "node:readline";
import { writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { ConclaveServer } from "../server/server.js";
import { ConclaveClient } from "../sdk/client.js";
import type {
  AgentStatus,
  MessageKind,
  RoomAgent,
  StoredMessage,
  VoteValue,
  WarningCategory,
  WarningSeverity,
} from "../protocol/types.js";
import { MessageKindSchema } from "../protocol/schemas.js";
import { isLoopback, projectContext } from "../shared/project.js";
import { defaultDbPath, ensureServer } from "./daemon.js";
import { initProject } from "./init.js";
import { runHook } from "./hook.js";
import { oneShot, resolveIdentity } from "./oneshot.js";
import { bold, cyan, dim, formatAgent, formatMessage, green, red, yellow } from "./format.js";

const ctx = projectContext();

const program = new Command();
program
  .name("conclave")
  .description("Local real-time communication layer for coding agents working on the same repo")
  .version("0.1.0");

interface CommonOpts {
  url: string;
  room?: string;
}

function effective(opts: CommonOpts): { url: string; room: string } {
  return { url: opts.url, room: opts.room ?? ctx.room };
}

async function requireServer(url: string): Promise<void> {
  const up = await ensureServer(url);
  if (!up) {
    console.error(red(`no conclave server reachable at ${url} and it could not be started`));
    process.exit(1);
  }
}

/* -------------------------------- serve -------------------------------- */

program
  .command("serve")
  .description("start the conclave server (WebSocket + HTTP API on one localhost port)")
  .option("-p, --port <port>", "port to listen on", "7777")
  .option("-H, --host <host>", "host to bind (keep it loopback — conclave is local-only)", "127.0.0.1")
  .option("-d, --db <path>", "sqlite database file", defaultDbPath())
  .option("--heartbeat-timeout <ms>", "mark agents offline after this many ms without a heartbeat", "15000")
  .action(async (opts: { port: string; host: string; db: string; heartbeatTimeout: string }) => {
    if (!isLoopback(`http://${opts.host}:${opts.port}`)) {
      console.error(
        yellow(
          "warning: binding a non-loopback host exposes the room to your network. Conclave is designed to run locally.",
        ),
      );
    }
    const server = new ConclaveServer({
      dbPath: opts.db,
      heartbeatTimeoutMs: Number(opts.heartbeatTimeout),
      log: (line) => console.log(`${dim(new Date().toLocaleTimeString("en-GB"))} ${line}`),
    });
    const port = await server.listen(Number(opts.port), opts.host);
    console.log(green(`conclave server ready`));
    console.log(`  ws:   ws://${opts.host}:${port}/ws`);
    console.log(`  http: http://${opts.host}:${port}/api/rooms`);
    console.log(`  db:   ${opts.db}`);
    const shutdown = async () => {
      console.log("\nshutting down…");
      await server.close();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

/* --------------------------------- init -------------------------------- */

program
  .command("init")
  .description("wire this project up: conclave.json, agent instructions in CLAUDE.md/AGENTS.md, Claude Code hooks")
  .option("--room <room>", "override the derived room name")
  .option("--no-hooks", "skip installing Claude Code hooks into .claude/settings.json")
  .action((opts: { room?: string; hooks: boolean }) => {
    const result = initProject(ctx.root, { room: opts.room, hooks: opts.hooks });
    console.log(green(`conclave initialized for ${bold(result.root)}`));
    console.log(`  room:            ${bold(result.room)}`);
    console.log(`  conclave.json:   ${result.config}`);
    console.log(`  CLAUDE.md:       ${result.claudeMd}`);
    console.log(`  AGENTS.md:       ${result.agentsMd}`);
    console.log(`  claude hooks:    ${result.claudeHooks}`);
    console.log(dim("\nagents that read CLAUDE.md / AGENTS.md will now coordinate through conclave automatically."));
  });

program
  .command("info")
  .description("show the resolved project root, room and server url")
  .action(async () => {
    console.log(`root: ${ctx.root}`);
    console.log(`room: ${ctx.room}`);
    console.log(`url:  ${ctx.url}`);
    const { serverIsUp } = await import("./daemon.js");
    console.log(`server: ${(await serverIsUp(ctx.url)) ? green("up") : dim("down (auto-starts on first use)")}`);
  });

/* --------------------------------- hook -------------------------------- */

program
  .command("hook <event>")
  .description("agent-hook bridge (reads Claude Code hook JSON on stdin; never fails the host)")
  .action(async (event: string) => {
    await runHook(event);
    process.exit(0);
  });

/* ------------------------- one-shot agent verbs ------------------------- */

const identityOptions = (cmd: Command): Command =>
  cmd
    .option("-u, --url <url>", "server url", ctx.url)
    .option("-r, --room <room>", "room (default: derived from this project)")
    .option("-n, --name <name>", "agent name")
    .option("--provider <provider>", "agent provider")
    .option("--model <model>", "agent model")
    .option("--role <role>", "agent role")
    .option("--id <id>", "stable agent id");

identityOptions(
  program.command("say <text...>").description("broadcast a thought to the project room and exit"),
).action(async (words: string[], opts: CommonOpts & { name?: string }) => {
  const { url, room } = effective(opts);
  await oneShot({ url, room, agent: resolveIdentity(opts), lingerMs: 150 }, (client) => {
    client.thought(words.join(" "));
  });
  console.log(green("sent"));
});

identityOptions(
  program
    .command("ask <text...>")
    .description("ask the room a question and wait for the first answer")
    .option("-t, --timeout <seconds>", "how long to wait", "60"),
).action(async (words: string[], opts: CommonOpts & { timeout: string; name?: string }) => {
  const { url, room } = effective(opts);
  try {
    const { result } = await oneShot(
      { url, room, agent: resolveIdentity(opts), lingerMs: 0 },
      (client) => client.ask(words.join(" "), { timeoutMs: Number(opts.timeout) * 1000 }),
    );
    console.log(`${bold(result.from.name)}: ${(result.payload as { text: string }).text}`);
  } catch (err) {
    console.error(yellow(err instanceof Error ? err.message : String(err)));
    process.exit(2);
  }
});

identityOptions(
  program
    .command("touch <files...>")
    .description("declare files you are about to edit; prints CONFLICT if another agent is on them"),
).action(async (files: string[], opts: CommonOpts & { name?: string }) => {
  const { url, room } = effective(opts);
  const { reactions } = await oneShot(
    { url, room, agent: resolveIdentity(opts), lingerMs: 600 },
    (client) => {
      client.declareActivity({ action: "editing", targets: files });
    },
  );
  const conflicts = reactions.filter((m) => m.kind === "conflict");
  if (conflicts.length > 0) {
    for (const c of conflicts) {
      const p = c.payload as { detail?: string; resource: string };
      console.log(red(`CONFLICT: ${p.detail ?? p.resource}`));
    }
    process.exit(3);
  }
  console.log(green(`declared: editing ${files.join(", ")}`));
});

program
  .command("inbox")
  .description("recent messages in this project's room")
  .option("-u, --url <url>", "server url", ctx.url)
  .option("-r, --room <room>", "room (default: derived from this project)")
  .option("-l, --limit <n>", "max messages", "20")
  .option("-k, --kind <kind>", "filter by message kind")
  .action(async (opts: CommonOpts & { limit: string; kind?: string }) => {
    const { url, room } = effective(opts);
    await requireServer(url);
    const kindParam = opts.kind ? `&kind=${encodeURIComponent(opts.kind)}` : "";
    const data = await apiGet(url, `/api/rooms/${encodeURIComponent(room)}/messages?limit=${opts.limit}${kindParam}`);
    for (const message of data.messages as StoredMessage[]) console.log(formatMessage(message));
    if (!data.messages.length) console.log(dim(`no messages in ${room}`));
  });

/* ----------------------------- join / watch ----------------------------- */

interface JoinOpts extends CommonOpts {
  name: string;
  provider: string;
  model: string;
  role: string;
  capabilities?: string;
  id?: string;
}

function buildClient(room: string, opts: JoinOpts, role?: string): ConclaveClient {
  return new ConclaveClient({
    url: opts.url,
    room,
    agent: {
      id: opts.id,
      name: opts.name,
      provider: opts.provider,
      model: opts.model,
      role: role ?? opts.role,
      capabilities: opts.capabilities ? opts.capabilities.split(",").map((s) => s.trim()) : [],
      status: "idle",
    },
  });
}

function attachStream(client: ConclaveClient): void {
  client.on("message", (message) => console.log(formatMessage(message)));
  client.on("presence", ({ event, agent }) => {
    if (event === "updated") return;
    const icon = event === "joined" || event === "reconnected" ? green("+") : red("-");
    console.log(`${icon} ${bold(agent.name)} ${dim(`(${agent.id})`)} ${event}`);
  });
  client.on("reconnecting", ({ attempt, delayMs }) =>
    console.log(yellow(`reconnecting (attempt ${attempt}) in ${delayMs}ms…`)),
  );
  client.on("error", (err) => console.error(red(`error: ${err.message}`)));
}

async function connectAndGreet(client: ConclaveClient): Promise<void> {
  const welcome = await client.connect();
  console.log(green(`${welcome.resumed ? "rejoined" : "joined"} room ${bold(welcome.room)} as ${bold(welcome.agent.name)} (${welcome.agent.id})`));
  const others = welcome.agents.filter((a) => a.id !== welcome.agent.id);
  if (others.length) {
    console.log(dim("agents in room:"));
    for (const a of others) console.log("  " + formatAgent(a));
  }
  if (welcome.recent.length) {
    console.log(dim(`─── last ${welcome.recent.length} messages ───`));
    for (const m of welcome.recent) console.log(formatMessage(m));
    console.log(dim("─── live ───"));
  }
}

const HELP = `commands:
  <text>                                    send a thought
  /status <status> [intent…]                update status (idle|working|blocked|reviewing|waiting|done)
  /activity <action> <target[,target…]> [intent…]
                                            declare activity for conflict awareness
                                            (editing|api_change|schema_change|package_change|migration|deploy|destructive)
  /ask [@agentId] <text>                    ask a question (resolves when answered, 120s timeout)
  /answer <messageId> <text>                answer a question
  /warn <info|caution|danger> <category> <text>
  /propose <title> :: [description]         open a decision
  /vote <decisionId> <approve|reject|request_changes> [comment]
  /exec <command>                           broadcast an execution request (safety-checked)
  /agents                                   list agents in room
  /help                                     show this help
  /quit                                     leave and exit`;

program
  .command("join [room]")
  .description("join the project room as an agent (interactive: stdin lines become messages)")
  .option("-u, --url <url>", "server url", ctx.url)
  .option("-n, --name <name>", "agent name", `agent-${hostname()}`)
  .option("--provider <provider>", "agent provider", "cli")
  .option("--model <model>", "agent model", "human")
  .option("--role <role>", "agent role", "implementer")
  .option("--capabilities <list>", "comma-separated capabilities")
  .option("--id <id>", "stable agent id (enables resuming the same identity)")
  .action(async (roomArg: string | undefined, opts: JoinOpts) => {
    const room = roomArg ?? ctx.room;
    await requireServer(opts.url);
    const client = buildClient(room, opts);
    attachStream(client);
    client.on("question", (message) => {
      if (message.to === client.agent?.id) {
        console.log(yellow(`↳ direct question ${message.id} — reply with /answer ${message.id} <text>`));
      }
    });
    await connectAndGreet(client);
    console.log(dim("type /help for commands"));

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.setPrompt("> ");
    rl.prompt();
    rl.on("line", async (line) => {
      const text = line.trim();
      try {
        if (!text) {
          /* noop */
        } else if (text === "/quit") {
          await client.disconnect();
          rl.close();
          process.exit(0);
        } else if (text === "/help") {
          console.log(dim(HELP));
        } else if (text === "/agents") {
          for (const a of client.roster.values()) console.log(formatAgent(a));
        } else if (text.startsWith("/status ")) {
          const [status, ...intent] = text.slice(8).split(" ");
          client.status({ status: status as AgentStatus, intent: intent.join(" ") || undefined });
        } else if (text.startsWith("/activity ")) {
          const [action, targets, ...intent] = text.slice(10).split(" ");
          client.declareActivity(
            { action: action as never, targets: (targets ?? "").split(",").filter(Boolean) },
            "working",
            intent.join(" ") || undefined,
          );
        } else if (text.startsWith("/ask ")) {
          let rest = text.slice(5);
          let to: string | undefined;
          if (rest.startsWith("@")) {
            const space = rest.indexOf(" ");
            to = rest.slice(1, space);
            rest = rest.slice(space + 1);
          }
          client
            .ask(rest, { to })
            .then((answer) => console.log(green(`answered by ${answer.from.name}: ${(answer.payload as { text: string }).text}`)))
            .catch((err) => console.log(yellow(err.message)));
        } else if (text.startsWith("/answer ")) {
          const [messageId, ...rest] = text.slice(8).split(" ");
          client.answer(messageId!, rest.join(" "));
        } else if (text.startsWith("/warn ")) {
          const [severity, category, ...rest] = text.slice(6).split(" ");
          client.warn({
            severity: severity as WarningSeverity,
            category: category as WarningCategory,
            text: rest.join(" "),
          });
        } else if (text.startsWith("/propose ")) {
          const [title, description] = text.slice(9).split("::").map((s) => s.trim());
          const id = client.propose({ title: title!, description: description || undefined });
          console.log(dim(`decision opened: ${id}`));
        } else if (text.startsWith("/vote ")) {
          const [decisionId, vote, ...rest] = text.slice(6).split(" ");
          client.vote(decisionId!, vote as VoteValue, rest.join(" ") || undefined);
        } else if (text.startsWith("/exec ")) {
          client.requestExecution({ command: text.slice(6) });
        } else if (text.startsWith("/")) {
          console.log(yellow(`unknown command — ${dim("/help")}`));
        } else {
          client.thought(text);
        }
      } catch (err) {
        console.error(red(err instanceof Error ? err.message : String(err)));
      }
      rl.prompt();
    });
  });

program
  .command("watch [room]")
  .description("watch the project room read-only (joins as an observer)")
  .option("-u, --url <url>", "server url", ctx.url)
  .option("-n, --name <name>", "observer name", `watcher-${hostname()}`)
  .action(async (roomArg: string | undefined, opts: { url: string; name: string }) => {
    const room = roomArg ?? ctx.room;
    await requireServer(opts.url);
    const client = buildClient(
      room,
      { ...opts, room, provider: "cli", model: "none", role: "observer" },
      "observer",
    );
    attachStream(client);
    await connectAndGreet(client);
    const shutdown = async () => {
      await client.disconnect();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
  });

/* -------------------------------- send --------------------------------- */

program
  .command("send <kind> [room]")
  .description("send one structured message and exit (payload as JSON, or --text for text kinds)")
  .option("-u, --url <url>", "server url", ctx.url)
  .option("-n, --name <name>", "agent name")
  .option("--provider <provider>", "agent provider")
  .option("--model <model>", "agent model")
  .option("--role <role>", "agent role")
  .option("--id <id>", "stable agent id")
  .option("--payload <json>", "message payload as JSON")
  .option("--text <text>", "shortcut for kinds with a text payload (thought/question/answer)")
  .option("--to <agentId>", "direct the message to one agent")
  .option("--ref <messageId>", "reference another message id")
  .action(
    async (
      kind: string,
      roomArg: string | undefined,
      opts: CommonOpts & { payload?: string; text?: string; to?: string; ref?: string; name?: string },
    ) => {
      const parsedKind = MessageKindSchema.safeParse(kind);
      if (!parsedKind.success) {
        console.error(red(`unknown kind "${kind}". valid: ${MessageKindSchema.options.join(", ")}`));
        process.exit(1);
      }
      let payload: unknown;
      if (opts.payload) {
        try {
          payload = JSON.parse(opts.payload);
        } catch {
          console.error(red("--payload is not valid JSON"));
          process.exit(1);
        }
      } else if (opts.text) {
        payload = { text: opts.text };
      } else {
        console.error(red("provide --payload '<json>' or --text '<text>'"));
        process.exit(1);
      }
      const room = roomArg ?? ctx.room;
      let failed = false;
      const { result } = await oneShot(
        { url: opts.url, room, agent: resolveIdentity(opts), lingerMs: 300 },
        (client) => {
          client.on("error", (err) => {
            console.error(red(err.message));
            failed = true;
          });
          return client.publish(parsedKind.data as MessageKind, payload, { to: opts.to, refId: opts.ref });
        },
      );
      if (failed) process.exit(1);
      console.log(green(`sent ${parsedKind.data} ${dim(result)}`));
    },
  );

/* ------------------------------ queries -------------------------------- */

async function apiGet(url: string, path: string): Promise<any> {
  const response = await fetch(`${url.replace(/\/+$/, "")}${path}`);
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
}

program
  .command("rooms")
  .description("list rooms")
  .option("-u, --url <url>", "server url", ctx.url)
  .action(async (opts: { url: string }) => {
    await requireServer(opts.url);
    const data = await apiGet(opts.url, "/api/rooms");
    for (const room of data.rooms) {
      console.log(`${bold(room.id)} ${dim(new Date(room.createdAt).toISOString())}`);
    }
    if (!data.rooms.length) console.log(dim("no rooms"));
  });

program
  .command("agents [room]")
  .description("list agents in the project room")
  .option("-u, --url <url>", "server url", ctx.url)
  .action(async (roomArg: string | undefined, opts: { url: string }) => {
    const room = roomArg ?? ctx.room;
    await requireServer(opts.url);
    const data = await apiGet(opts.url, `/api/rooms/${encodeURIComponent(room)}/agents`);
    for (const agent of data.agents as RoomAgent[]) console.log(formatAgent(agent));
    if (!data.agents.length) console.log(dim(`no agents in ${room}`));
  });

program
  .command("messages [room]")
  .description("list messages in the project room")
  .option("-u, --url <url>", "server url", ctx.url)
  .option("-l, --limit <n>", "max messages", "50")
  .option("-k, --kind <kind>", "filter by message kind")
  .action(async (roomArg: string | undefined, opts: { url: string; limit: string; kind?: string }) => {
    const room = roomArg ?? ctx.room;
    await requireServer(opts.url);
    const kindParam = opts.kind ? `&kind=${encodeURIComponent(opts.kind)}` : "";
    const data = await apiGet(opts.url, `/api/rooms/${encodeURIComponent(room)}/messages?limit=${opts.limit}${kindParam}`);
    for (const message of data.messages as StoredMessage[]) console.log(formatMessage(message));
    if (!data.messages.length) console.log(dim(`no messages in ${room}`));
  });

program
  .command("decisions [room]")
  .description("list decisions and votes in the project room")
  .option("-u, --url <url>", "server url", ctx.url)
  .action(async (roomArg: string | undefined, opts: { url: string }) => {
    const room = roomArg ?? ctx.room;
    await requireServer(opts.url);
    const data = await apiGet(opts.url, `/api/rooms/${encodeURIComponent(room)}/decisions`);
    for (const d of data.decisions) {
      const status =
        d.status === "approved" ? green(d.status) : d.status === "rejected" ? red(d.status) : d.status === "open" ? cyan(d.status) : yellow(d.status);
      console.log(`${bold(d.title)} ${dim(`(${d.id})`)} — ${status}`);
      for (const v of d.votes) console.log(`    ${v.agentId}: ${v.vote}${v.comment ? ` — ${v.comment}` : ""}`);
    }
    if (!data.decisions.length) console.log(dim("no decisions"));
  });

program
  .command("clear [room]")
  .description("delete the project room and its entire transcript")
  .option("-u, --url <url>", "server url", ctx.url)
  .option("-y, --yes", "skip confirmation")
  .action(async (roomArg: string | undefined, opts: { url: string; yes?: boolean }) => {
    const room = roomArg ?? ctx.room;
    if (!opts.yes) {
      console.error(red(`this permanently deletes room "${room}" and all its messages. re-run with --yes to confirm.`));
      process.exit(1);
    }
    await requireServer(opts.url);
    const response = await fetch(`${opts.url.replace(/\/+$/, "")}/api/rooms/${encodeURIComponent(room)}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
    console.log(green(`cleared room ${room}`));
  });

program
  .command("export [room]")
  .description("export the project room transcript (json or markdown)")
  .option("-u, --url <url>", "server url", ctx.url)
  .option("-f, --format <format>", "json | md", "md")
  .option("-o, --out <file>", "write to file instead of stdout")
  .action(async (roomArg: string | undefined, opts: { url: string; format: string; out?: string }) => {
    const room = roomArg ?? ctx.room;
    await requireServer(opts.url);
    const response = await fetch(
      `${opts.url.replace(/\/+$/, "")}/api/rooms/${encodeURIComponent(room)}/export?format=${opts.format}`,
    );
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
    const body = await response.text();
    if (opts.out) {
      writeFileSync(opts.out, body);
      console.log(green(`exported to ${opts.out}`));
    } else {
      console.log(body);
    }
  });

program.parseAsync().catch((err) => {
  console.error(red(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
