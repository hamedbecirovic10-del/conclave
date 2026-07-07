import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Agent identity                                                      */
/* ------------------------------------------------------------------ */

export const AgentStatusSchema = z.enum([
  "idle",
  "working",
  "blocked",
  "reviewing",
  "waiting",
  "done",
  "offline",
]);

export const AgentIdentitySchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(128),
  provider: z.string().min(1).max(64), // e.g. anthropic, openai, xai
  model: z.string().min(1).max(128),
  role: z.string().min(1).max(64), // e.g. implementer, reviewer, architect, observer
  capabilities: z.array(z.string().max(64)).max(64).default([]),
  status: AgentStatusSchema.default("idle"),
  intent: z.string().max(512).nullish(), // what the agent is currently doing
});

export const AgentDescriptorSchema = AgentIdentitySchema.omit({ id: true }).extend({
  id: z.string().min(1).max(128).optional(),
});

/* ------------------------------------------------------------------ */
/* Activity claims — used for conflict awareness (never for locking)   */
/* ------------------------------------------------------------------ */

export const ActivityActionSchema = z.enum([
  "editing", // touching a file
  "api_change", // changing an API contract
  "schema_change", // changing a data schema
  "package_change", // adding/removing/upgrading dependencies
  "migration", // running a database migration
  "deploy", // deployment action
  "destructive", // deleting files, dropping tables, etc.
]);

export const ActivitySchema = z.object({
  action: ActivityActionSchema,
  targets: z.array(z.string().min(1).max(512)).min(1).max(64),
  detail: z.string().max(1024).optional(),
});

/* ------------------------------------------------------------------ */
/* Message kinds and their payloads                                    */
/* ------------------------------------------------------------------ */

export const MessageKindSchema = z.enum([
  "status",
  "thought",
  "proposal",
  "question",
  "answer",
  "warning",
  "conflict",
  "decision",
  "vote",
  "task",
  "review",
  "execution_request",
  "execution_result",
]);

export const StatusPayloadSchema = z.object({
  status: AgentStatusSchema,
  intent: z.string().max(512).optional(),
  detail: z.string().max(2048).optional(),
  activity: ActivitySchema.optional(),
});

export const ThoughtPayloadSchema = z.object({
  text: z.string().min(1).max(16384),
});

export const ProposalKindSchema = z.enum([
  "general",
  "architecture",
  "api_contract",
  "schema",
  "dependency",
  "deployment",
  "security",
]);

export const ProposalPayloadSchema = z.object({
  title: z.string().min(1).max(512),
  description: z.string().max(16384).optional(),
  kind: ProposalKindSchema.default("general"),
});

export const QuestionPayloadSchema = z.object({
  text: z.string().min(1).max(16384),
});

export const AnswerPayloadSchema = z.object({
  text: z.string().min(1).max(16384),
});

export const WarningSeveritySchema = z.enum(["info", "caution", "danger"]);

export const WarningCategorySchema = z.enum([
  "file_conflict",
  "api_contract",
  "schema_change",
  "destructive_command",
  "file_deletion",
  "env_overwrite",
  "migration",
  "deployment",
  "package_change",
  "security",
  "other",
]);

export const WarningPayloadSchema = z.object({
  severity: WarningSeveritySchema,
  category: WarningCategorySchema,
  text: z.string().min(1).max(4096),
  targets: z.array(z.string().max(512)).max(64).optional(),
});

export const ConflictPayloadSchema = z.object({
  resource: z.string().min(1).max(512),
  category: ActivityActionSchema,
  agents: z.array(z.string().max(128)).min(2).max(32),
  detail: z.string().max(2048).optional(),
});

export const VoteValueSchema = z.enum(["approve", "reject", "request_changes"]);

export const VotePayloadSchema = z.object({
  decisionId: z.string().min(1).max(128),
  vote: VoteValueSchema,
  comment: z.string().max(4096).optional(),
});

export const DecisionOutcomeSchema = z.enum([
  "approved",
  "rejected",
  "changes_requested",
]);

export const DecisionPayloadSchema = z.object({
  decisionId: z.string().min(1).max(128),
  title: z.string().min(1).max(512),
  outcome: DecisionOutcomeSchema,
  tally: z.object({
    approve: z.number().int().nonnegative(),
    reject: z.number().int().nonnegative(),
    request_changes: z.number().int().nonnegative(),
  }),
});

export const TaskStateSchema = z.enum([
  "open",
  "claimed",
  "in_progress",
  "blocked",
  "done",
]);

export const TaskPayloadSchema = z.object({
  taskId: z.string().min(1).max(128),
  title: z.string().min(1).max(512),
  description: z.string().max(16384).optional(),
  assignee: z.string().max(128).optional(), // agent id
  state: TaskStateSchema,
});

export const ReviewPayloadSchema = z.object({
  target: z.string().min(1).max(512), // file, PR, task id, message id…
  verdict: z.enum(["approve", "request_changes", "comment"]).optional(),
  comments: z.string().min(1).max(16384),
});

export const ExecutionRequestPayloadSchema = z.object({
  command: z.string().min(1).max(8192),
  cwd: z.string().max(1024).optional(),
  reason: z.string().max(2048).optional(),
});

export const ExecutionResultPayloadSchema = z.object({
  command: z.string().max(8192).optional(),
  success: z.boolean(),
  exitCode: z.number().int().optional(),
  output: z.string().max(65536).optional(),
});

export const PAYLOAD_SCHEMAS = {
  status: StatusPayloadSchema,
  thought: ThoughtPayloadSchema,
  proposal: ProposalPayloadSchema,
  question: QuestionPayloadSchema,
  answer: AnswerPayloadSchema,
  warning: WarningPayloadSchema,
  conflict: ConflictPayloadSchema,
  decision: DecisionPayloadSchema,
  vote: VotePayloadSchema,
  task: TaskPayloadSchema,
  review: ReviewPayloadSchema,
  execution_request: ExecutionRequestPayloadSchema,
  execution_result: ExecutionResultPayloadSchema,
} as const;

/* ------------------------------------------------------------------ */
/* Stored message envelope                                             */
/* ------------------------------------------------------------------ */

export const MessageSenderSchema = z.object({
  agentId: z.string().min(1).max(128),
  name: z.string().min(1).max(128),
  provider: z.string().max(64),
  role: z.string().max(64),
});

export const StoredMessageSchema = z.object({
  id: z.string().min(1).max(128),
  roomId: z.string().min(1).max(256),
  from: MessageSenderSchema,
  kind: MessageKindSchema,
  payload: z.unknown(),
  to: z.string().max(128).nullish(), // direct message to a specific agent id
  refId: z.string().max(128).nullish(), // references another message (answer→question, result→request)
  ts: z.number().int().positive(),
});

/* ------------------------------------------------------------------ */
/* Client → server frames                                              */
/* ------------------------------------------------------------------ */

export const RoomIdSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[a-zA-Z0-9._\-\/]+$/, "room id may contain letters, digits, . _ - /");

export const HelloFrameSchema = z.object({
  op: z.literal("hello"),
  room: RoomIdSchema,
  agent: AgentDescriptorSchema,
  resumeToken: z.string().max(256).optional(),
});

export const PublishFrameSchema = z.object({
  op: z.literal("publish"),
  /** Optional client-generated message id (UUID). Lets the sender know the
   *  id of its own message up front (e.g. a proposal's decision id). */
  id: z.string().min(8).max(128).optional(),
  kind: MessageKindSchema,
  payload: z.unknown(),
  to: z.string().max(128).optional(),
  refId: z.string().max(128).optional(),
});

export const HeartbeatFrameSchema = z.object({
  op: z.literal("heartbeat"),
});

export const UpdateFrameSchema = z.object({
  op: z.literal("update"),
  status: AgentStatusSchema.optional(),
  intent: z.string().max(512).nullish(),
  activity: ActivitySchema.nullish(),
});

export const HistoryFrameSchema = z.object({
  op: z.literal("history"),
  limit: z.number().int().positive().max(1000).default(100),
  beforeTs: z.number().int().positive().optional(),
});

export const LeaveFrameSchema = z.object({
  op: z.literal("leave"),
});

export const ClientFrameSchema = z.discriminatedUnion("op", [
  HelloFrameSchema,
  PublishFrameSchema,
  HeartbeatFrameSchema,
  UpdateFrameSchema,
  HistoryFrameSchema,
  LeaveFrameSchema,
]);

/* ------------------------------------------------------------------ */
/* Server → client frames                                              */
/* ------------------------------------------------------------------ */

export const RoomAgentSchema = AgentIdentitySchema.extend({
  online: z.boolean(),
  lastSeen: z.number().int().positive(),
  joinedAt: z.number().int().positive(),
});

export const WelcomeFrameSchema = z.object({
  op: z.literal("welcome"),
  room: RoomIdSchema,
  agent: AgentIdentitySchema,
  sessionToken: z.string(),
  agents: z.array(RoomAgentSchema),
  recent: z.array(StoredMessageSchema),
  resumed: z.boolean(),
});

export const MessageFrameSchema = z.object({
  op: z.literal("message"),
  message: StoredMessageSchema,
});

export const PresenceEventSchema = z.enum([
  "joined",
  "left",
  "offline",
  "reconnected",
  "updated",
]);

export const PresenceFrameSchema = z.object({
  op: z.literal("presence"),
  event: PresenceEventSchema,
  agent: RoomAgentSchema,
});

export const HistoryResultFrameSchema = z.object({
  op: z.literal("history_result"),
  messages: z.array(StoredMessageSchema),
});

export const HeartbeatAckFrameSchema = z.object({
  op: z.literal("heartbeat_ack"),
  ts: z.number().int().positive(),
});

export const ErrorFrameSchema = z.object({
  op: z.literal("error"),
  code: z.string(),
  message: z.string(),
});

export const ServerFrameSchema = z.discriminatedUnion("op", [
  WelcomeFrameSchema,
  MessageFrameSchema,
  PresenceFrameSchema,
  HistoryResultFrameSchema,
  HeartbeatAckFrameSchema,
  ErrorFrameSchema,
]);

/* ------------------------------------------------------------------ */
/* Payload validation helper                                           */
/* ------------------------------------------------------------------ */

export function validatePayload(
  kind: z.infer<typeof MessageKindSchema>,
  payload: unknown,
):
  | { ok: true; payload: unknown }
  | { ok: false; error: string } {
  const schema = PAYLOAD_SCHEMAS[kind];
  const result = schema.safeParse(payload);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      ok: false,
      error: `invalid ${kind} payload: ${issue ? `${issue.path.join(".") || "(root)"} ${issue.message}` : "validation failed"}`,
    };
  }
  return { ok: true, payload: result.data };
}
