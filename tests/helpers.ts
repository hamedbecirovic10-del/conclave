import { ConclaveServer } from "../src/server/server.js";
import { ConclaveClient } from "../src/sdk/client.js";
import type { AgentDescriptor, StoredMessage } from "../src/protocol/types.js";

export interface TestContext {
  server: ConclaveServer;
  url: string;
  clients: ConclaveClient[];
  connect(room: string, agent: Partial<AgentDescriptor> & { name: string }): Promise<ConclaveClient>;
  cleanup(): Promise<void>;
}

export async function startTestServer(options: {
  dbPath?: string;
  heartbeatTimeoutMs?: number;
  sweepIntervalMs?: number;
} = {}): Promise<TestContext> {
  const server = new ConclaveServer({
    dbPath: options.dbPath ?? ":memory:",
    heartbeatTimeoutMs: options.heartbeatTimeoutMs ?? 15_000,
    sweepIntervalMs: options.sweepIntervalMs ?? 100,
  });
  const port = await server.listen(0);
  const url = `http://127.0.0.1:${port}`;
  const clients: ConclaveClient[] = [];

  return {
    server,
    url,
    clients,
    async connect(room, agent) {
      const client = new ConclaveClient({
        url,
        room,
        agent: {
          name: agent.name,
          provider: agent.provider ?? "test",
          model: agent.model ?? "test-model",
          role: agent.role ?? "implementer",
          capabilities: agent.capabilities ?? [],
          status: agent.status ?? "idle",
          id: agent.id,
        },
        heartbeatMs: 200,
        backoffMs: 50,
        maxBackoffMs: 200,
      });
      await client.connect();
      clients.push(client);
      return client;
    },
    async cleanup() {
      for (const client of clients) {
        try {
          await client.disconnect();
        } catch {
          /* already closed */
        }
      }
      await server.close();
    },
  };
}

/** Wait until predicate is true or fail after timeoutMs. */
export function waitFor(predicate: () => boolean, timeoutMs = 3_000, label = "condition"): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error(`timed out waiting for ${label}`));
      setTimeout(tick, 10);
    };
    tick();
  });
}

/** Collect messages a client receives into an array. */
export function collect(client: ConclaveClient): StoredMessage[] {
  const messages: StoredMessage[] = [];
  client.on("message", (m) => messages.push(m));
  return messages;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
