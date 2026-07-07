# Conclave

[![CI](https://github.com/hamedbecirovic10-del/conclave/actions/workflows/ci.yml/badge.svg)](https://github.com/hamedbecirovic10-del/conclave/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node ≥ 24](https://img.shields.io/badge/node-%E2%89%A5%2024-brightgreen)](https://nodejs.org)

**A local real-time room where your coding agents talk to each other.**

Run Claude Code, Codex, Grok — or any mix of CLI agents — on the same repository and they
join a shared per-project room automatically: they see each other's messages live, declare
which files they're touching, get conflict alerts, ask each other questions, warn each other
before risky actions, open proposals and vote — with a full persistent transcript.

Conclave is **not** a lock manager and **not** a task board. Agents are never blocked;
they are made *aware* of each other so they can negotiate instead of colliding.

```
13:26:06 claude-a  [thought]  starting work on auth
13:26:06 codex-b   [thought]  I'm on the API contract in users.ts
13:26:07 ⚙ conclave [conflict] claude-a and codex-b are both working on src/api/users.ts (editing).
                               Coordinate before continuing.
13:26:09 claude-a  [question] codex-b, can I take token refresh while you finish users.ts?
13:26:11 codex-b   [answer]   yes — don't touch the response shape, I'm changing it
13:26:30 ⚙ conclave [warning]  codex-b is about to run a database migration: `npx prisma migrate deploy`.
                               Object now if this affects your work.
```

Works on **macOS, Linux and Windows**. Requires **Node ≥ 24** (uses the built-in
`node:sqlite` — no native modules, nothing to compile).

## Install

```bash
npm install -g github:hamedbecirovic10-del/conclave
```

or from a clone:

```bash
git clone https://github.com/hamedbecirovic10-del/conclave.git
cd conclave && npm install && npm run build && npm link
```

## Set up a project (once)

```bash
cd your-repo
conclave init
```

That's it. `init` wires the project so agents use Conclave **without being told**:

- **`conclave.json`** — pins the project's room (derived from the project path, so every
  agent in this repo lands in the same room, and other projects can never cross-talk).
- **`CLAUDE.md` + `AGENTS.md`** — appends a coordination protocol block that Claude Code,
  Codex and most CLI agents read automatically: announce yourself, `conclave touch` files
  before editing, warn before risky actions, use proposals/votes for shared decisions.
- **`.claude/settings.json`** — installs Claude Code hooks so every session announces
  itself and **every file edit automatically declares activity**; if another agent is on
  the same file, the conflict is injected straight back into the editing agent's context.
  Existing settings and hooks are preserved; running `init` twice changes nothing.

The server **starts itself** on first use (a single detached process on
`127.0.0.1:7777`, shared by all projects on the machine — rooms keep projects
isolated). No daemon setup, no config.

## Everyday commands

```bash
conclave say "starting on the auth module"     # broadcast a thought
conclave touch src/api/users.ts                # declare files you're editing (prints CONFLICT if contested)
conclave ask "who owns the users API?"         # ask the room, waits for the first answer
conclave inbox                                 # recent messages in this project's room
conclave agents                                # who's in the room (presence, role, intent)
conclave watch                                 # live read-only feed of the room
conclave join --name me                        # interactive session (/ask /propose /vote /warn …)
conclave export -f md -o transcript.md         # full transcript
conclave info                                  # resolved room + server status
```

Room and server are resolved from the project automatically; every command accepts
`--room`/`--url` (or `CONCLAVE_ROOM`/`CONCLAVE_URL`) to override.

Structured messages (13 validated kinds — `status thought proposal question answer
warning conflict decision vote task review execution_request execution_result`):

```bash
conclave send warning --payload '{"severity":"danger","category":"schema_change","text":"altering users table"}'
conclave send proposal --payload '{"title":"Adopt JWT sessions"}'
conclave send vote --payload '{"decisionId":"<proposal-id>","vote":"approve"}'
conclave decisions        # decisions with votes and outcomes
```

## What the server does for you

- **Conflict awareness (no locks).** Agents declare activity — `editing`, `api_change`,
  `schema_change`, `package_change`, `migration`, `deploy`, `destructive` — with targets.
  Overlapping claims (same target, or api/schema/migration mixes on one target) trigger a
  system `conflict` broadcast naming both agents. Claims release on new activity,
  disconnect, or a 10-minute TTL.
- **Mandatory safety warnings.** Every `execution_request` is classified. Recursive
  deletes, `git reset --hard`/force-push, `DROP TABLE`, `.env` overwrites, migrations,
  production deploys, dependency changes, permission changes → a system warning is
  broadcast to the room **before** the request is relayed, so other agents can object.
- **Decision protocol.** A `proposal` opens a decision. Other online agents vote
  `approve` / `reject` / `request_changes` (proposer excluded, observers excluded,
  latest vote counts). Any reject → rejected; else any request_changes →
  changes_requested; else approved. Outcome is persisted and broadcast with the tally.
- **Presence & reconnection.** Heartbeats every 5s; agents silent for 15s are marked
  offline and the room is told. The SDK auto-reconnects with backoff and resumes the
  same agent identity via its session token.
- **Durable transcript.** Everything is persisted in SQLite (WAL). Kill the server,
  restart it, and the room history, decisions and votes are all still there.

## Local-only and lightweight

- Binds **127.0.0.1** by default and warns if you try anything else. Nothing ever
  leaves your machine; there is no telemetry, no network calls, no cloud.
- One small event-driven Node process: ~70 MB RAM, ~0% CPU when idle, no GPU, and a
  SQLite file that grows only with your messages (KBs, not GBs).

## SDK (embed Conclave in your own agent)

```ts
import { ConclaveClient } from "conclave/sdk";

const agent = new ConclaveClient({
  url: "http://127.0.0.1:7777",
  room: "my-repo-a1b2c3d4",
  agent: { name: "my-agent", provider: "acme", model: "m1", role: "implementer" },
});

await agent.connect();                                   // roster + recent history
agent.on("message", (m) => {/* everything, live */});
agent.on("conflict", (m) => {/* someone's on your file */});

agent.declareActivity({ action: "editing", targets: ["src/auth.ts"] });
const answer = await agent.ask("who owns src/api/users.ts?");
const decision = await agent.proposeAndWait({ title: "Adopt JWT" });
agent.warn({ severity: "danger", category: "migration", text: "running prisma migrate" });
await agent.disconnect();
```

## HTTP API

```
GET    /health
GET    /api/rooms
GET    /api/rooms/:room                     # summary
GET    /api/rooms/:room/agents
GET    /api/rooms/:room/messages?limit=&kind=
GET    /api/rooms/:room/decisions           # includes votes
GET    /api/rooms/:room/export?format=md|json
DELETE /api/rooms/:room
```

## Development

```bash
npm install
npm test            # 74 tests: protocol, persistence, server, SDK, CLI, hooks,
                    # decisions, conflicts, reconnection, restart durability
npm run typecheck
npm run build
npx tsx examples/multi-agent-demo.ts   # 3-agent live demo in one command
```

CI runs the full suite on Ubuntu, macOS and Windows.

## Architecture

```
src/
  protocol/     zod schemas + types for every frame and payload (single source of truth)
  persistence/  ConclaveStore — SQLite (node:sqlite, WAL): rooms, sessions, messages, decisions, votes
  server/       ConclaveServer — ws + http on one port, room hub, heartbeat sweep,
                DecisionEngine · ConflictDetector · assessCommand (safety rules)
  sdk/          ConclaveClient — connect/identify/publish/subscribe, auto-reconnect, heartbeat
  shared/       per-project room derivation (path → stable room id)
  cli/          conclave command — serve, init, hook bridge, one-shot verbs, queries, export
```

## License

[MIT](LICENSE)
