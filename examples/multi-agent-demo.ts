/**
 * Multi-agent demo: one server, three agents (claude / codex / grok).
 * Run with: npx tsx examples/multi-agent-demo.ts
 *
 * Shows live messaging, conflict awareness, question/answer,
 * a decision vote, and the mandatory safety warning.
 */
import { ConclaveServer } from "../src/server/server.js";
import { ConclaveClient } from "../src/sdk/client.js";
import { formatMessage } from "../src/cli/format.js";

const server = new ConclaveServer({ dbPath: "./.conclave/demo.db" });
const port = await server.listen(0);
const url = `http://127.0.0.1:${port}`;
console.log(`server up on ${url}\n`);

function makeAgent(name: string, provider: string, model: string, role: string) {
  return new ConclaveClient({
    url,
    room: "demo-repo",
    agent: { name, provider, model, role, capabilities: ["edit", "test"] },
  });
}

const claude = makeAgent("claude", "anthropic", "claude-sonnet-5", "implementer");
const codex = makeAgent("codex", "openai", "gpt-5-codex", "implementer");
const grok = makeAgent("grok", "xai", "grok-4", "reviewer");

await claude.connect();
await codex.connect();
await grok.connect();

// grok narrates everything it sees in the room
grok.on("message", (m) => console.log(formatMessage(m)));

// codex answers questions and votes on proposals
codex.on("question", (q) => codex.answer(q.id, "users.ts is mine until the auth PR lands"));
codex.on("message", (m) => {
  if (m.kind === "proposal") codex.vote(m.id, "approve", "cleaner than the current setup");
});
grok.on("message", (m) => {
  if (m.kind === "proposal") grok.vote(m.id, "approve");
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 1. status + activity declarations
claude.status({ status: "working", intent: "auth module" });
claude.declareActivity({ action: "editing", targets: ["src/api/users.ts"] });
await sleep(150);

// 2. codex touches the same file → system conflict broadcast
codex.declareActivity({ action: "editing", targets: ["src/api/users.ts"] });
await sleep(150);

// 3. claude asks, codex answers
const answer = await claude.ask("who owns src/api/users.ts right now?", { timeoutMs: 5000 });
console.log(`\n→ claude got an answer from ${answer.from.name}\n`);

// 4. decision: proposal + votes from codex and grok
const decision = await claude.proposeAndWait(
  { title: "Move token validation into middleware", kind: "architecture" },
  10_000,
);
console.log(`\n→ decision resolved: ${decision.outcome} (${JSON.stringify(decision.tally)})\n`);

// 5. dangerous command → mandatory system warning precedes the request
grok.requestExecution({ command: "npx prisma migrate deploy", reason: "apply auth schema" });
await sleep(300);

console.log("\ntranscript persisted in ./.conclave/demo.db — inspect with:");
console.log(`  node dist/cli/index.js messages demo-repo --url ${url}\n`);

await claude.disconnect();
await codex.disconnect();
await grok.disconnect();
await server.close();
