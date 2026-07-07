import { hostname } from "node:os";
import { ConclaveClient } from "../sdk/client.js";
import type { AgentDescriptor, StoredMessage } from "../protocol/types.js";
import { ensureServer } from "./daemon.js";

export interface OneShotIdentity {
  id?: string;
  name?: string;
  provider?: string;
  model?: string;
  role?: string;
}

/** Build an agent descriptor from flags + CONCLAVE_AGENT_* env + defaults. */
export function resolveIdentity(overrides: OneShotIdentity = {}): AgentDescriptor {
  return {
    id: overrides.id ?? process.env.CONCLAVE_AGENT_ID,
    name: overrides.name ?? process.env.CONCLAVE_AGENT_NAME ?? `agent-${hostname()}`,
    provider: overrides.provider ?? process.env.CONCLAVE_AGENT_PROVIDER ?? "cli",
    model: overrides.model ?? process.env.CONCLAVE_AGENT_MODEL ?? "unknown",
    role: overrides.role ?? process.env.CONCLAVE_AGENT_ROLE ?? "implementer",
  };
}

/**
 * Connect, run an action, wait linger ms for reactions (conflicts,
 * warnings, answers), then disconnect. The workhorse for one-shot CLI
 * commands and editor/agent hooks.
 */
export async function oneShot<T>(
  options: {
    url: string;
    room: string;
    agent: AgentDescriptor;
    lingerMs?: number;
    autoStart?: boolean;
  },
  action: (client: ConclaveClient, reactions: StoredMessage[]) => T | Promise<T>,
): Promise<{ result: T; reactions: StoredMessage[] }> {
  if (options.autoStart !== false) {
    const up = await ensureServer(options.url, { quiet: true });
    if (!up) throw new Error(`no conclave server reachable at ${options.url}`);
  }
  const client = new ConclaveClient({
    url: options.url,
    room: options.room,
    agent: options.agent,
    reconnect: false,
  });
  const reactions: StoredMessage[] = [];
  client.on("message", (m) => {
    if (m.from.agentId !== client.agent?.id) reactions.push(m);
  });
  client.on("error", () => {
    /* surfaced via reactions/result, never crash a hook */
  });
  await client.connect();
  try {
    const result = await action(client, reactions);
    await new Promise((r) => setTimeout(r, options.lingerMs ?? 400));
    return { result, reactions };
  } finally {
    await client.disconnect();
  }
}
