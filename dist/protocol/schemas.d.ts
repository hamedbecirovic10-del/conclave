import { z } from "zod";
export declare const AgentStatusSchema: z.ZodEnum<["idle", "working", "blocked", "reviewing", "waiting", "done", "offline"]>;
export declare const AgentIdentitySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    provider: z.ZodString;
    model: z.ZodString;
    role: z.ZodString;
    capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodDefault<z.ZodEnum<["idle", "working", "blocked", "reviewing", "waiting", "done", "offline"]>>;
    intent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    provider: string;
    model: string;
    role: string;
    status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
    capabilities: string[];
    intent?: string | null | undefined;
}, {
    id: string;
    name: string;
    provider: string;
    model: string;
    role: string;
    status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
    capabilities?: string[] | undefined;
    intent?: string | null | undefined;
}>;
export declare const AgentDescriptorSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    name: z.ZodString;
    provider: z.ZodString;
    model: z.ZodString;
    role: z.ZodString;
    capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodDefault<z.ZodEnum<["idle", "working", "blocked", "reviewing", "waiting", "done", "offline"]>>;
    intent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "id"> & {
    id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    provider: string;
    model: string;
    role: string;
    status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
    capabilities: string[];
    id?: string | undefined;
    intent?: string | null | undefined;
}, {
    name: string;
    provider: string;
    model: string;
    role: string;
    id?: string | undefined;
    status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
    capabilities?: string[] | undefined;
    intent?: string | null | undefined;
}>;
export declare const ActivityActionSchema: z.ZodEnum<["editing", "api_change", "schema_change", "package_change", "migration", "deploy", "destructive"]>;
export declare const ActivitySchema: z.ZodObject<{
    action: z.ZodEnum<["editing", "api_change", "schema_change", "package_change", "migration", "deploy", "destructive"]>;
    targets: z.ZodArray<z.ZodString, "many">;
    detail: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
    targets: string[];
    detail?: string | undefined;
}, {
    action: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
    targets: string[];
    detail?: string | undefined;
}>;
export declare const MessageKindSchema: z.ZodEnum<["status", "thought", "proposal", "question", "answer", "warning", "conflict", "decision", "vote", "task", "review", "execution_request", "execution_result"]>;
export declare const StatusPayloadSchema: z.ZodObject<{
    status: z.ZodEnum<["idle", "working", "blocked", "reviewing", "waiting", "done", "offline"]>;
    intent: z.ZodOptional<z.ZodString>;
    detail: z.ZodOptional<z.ZodString>;
    activity: z.ZodOptional<z.ZodObject<{
        action: z.ZodEnum<["editing", "api_change", "schema_change", "package_change", "migration", "deploy", "destructive"]>;
        targets: z.ZodArray<z.ZodString, "many">;
        detail: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        action: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
        targets: string[];
        detail?: string | undefined;
    }, {
        action: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
        targets: string[];
        detail?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
    intent?: string | undefined;
    detail?: string | undefined;
    activity?: {
        action: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
        targets: string[];
        detail?: string | undefined;
    } | undefined;
}, {
    status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
    intent?: string | undefined;
    detail?: string | undefined;
    activity?: {
        action: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
        targets: string[];
        detail?: string | undefined;
    } | undefined;
}>;
export declare const ThoughtPayloadSchema: z.ZodObject<{
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    text: string;
}, {
    text: string;
}>;
export declare const ProposalKindSchema: z.ZodEnum<["general", "architecture", "api_contract", "schema", "dependency", "deployment", "security"]>;
export declare const ProposalPayloadSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    kind: z.ZodDefault<z.ZodEnum<["general", "architecture", "api_contract", "schema", "dependency", "deployment", "security"]>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    kind: "general" | "architecture" | "api_contract" | "schema" | "dependency" | "deployment" | "security";
    description?: string | undefined;
}, {
    title: string;
    description?: string | undefined;
    kind?: "general" | "architecture" | "api_contract" | "schema" | "dependency" | "deployment" | "security" | undefined;
}>;
export declare const QuestionPayloadSchema: z.ZodObject<{
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    text: string;
}, {
    text: string;
}>;
export declare const AnswerPayloadSchema: z.ZodObject<{
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    text: string;
}, {
    text: string;
}>;
export declare const WarningSeveritySchema: z.ZodEnum<["info", "caution", "danger"]>;
export declare const WarningCategorySchema: z.ZodEnum<["file_conflict", "api_contract", "schema_change", "destructive_command", "file_deletion", "env_overwrite", "migration", "deployment", "package_change", "security", "other"]>;
export declare const WarningPayloadSchema: z.ZodObject<{
    severity: z.ZodEnum<["info", "caution", "danger"]>;
    category: z.ZodEnum<["file_conflict", "api_contract", "schema_change", "destructive_command", "file_deletion", "env_overwrite", "migration", "deployment", "package_change", "security", "other"]>;
    text: z.ZodString;
    targets: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    text: string;
    severity: "info" | "caution" | "danger";
    category: "schema_change" | "package_change" | "migration" | "api_contract" | "deployment" | "security" | "file_conflict" | "destructive_command" | "file_deletion" | "env_overwrite" | "other";
    targets?: string[] | undefined;
}, {
    text: string;
    severity: "info" | "caution" | "danger";
    category: "schema_change" | "package_change" | "migration" | "api_contract" | "deployment" | "security" | "file_conflict" | "destructive_command" | "file_deletion" | "env_overwrite" | "other";
    targets?: string[] | undefined;
}>;
export declare const ConflictPayloadSchema: z.ZodObject<{
    resource: z.ZodString;
    category: z.ZodEnum<["editing", "api_change", "schema_change", "package_change", "migration", "deploy", "destructive"]>;
    agents: z.ZodArray<z.ZodString, "many">;
    detail: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    category: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
    resource: string;
    agents: string[];
    detail?: string | undefined;
}, {
    category: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
    resource: string;
    agents: string[];
    detail?: string | undefined;
}>;
export declare const VoteValueSchema: z.ZodEnum<["approve", "reject", "request_changes"]>;
export declare const VotePayloadSchema: z.ZodObject<{
    decisionId: z.ZodString;
    vote: z.ZodEnum<["approve", "reject", "request_changes"]>;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    vote: "approve" | "reject" | "request_changes";
    decisionId: string;
    comment?: string | undefined;
}, {
    vote: "approve" | "reject" | "request_changes";
    decisionId: string;
    comment?: string | undefined;
}>;
export declare const DecisionOutcomeSchema: z.ZodEnum<["approved", "rejected", "changes_requested"]>;
export declare const DecisionPayloadSchema: z.ZodObject<{
    decisionId: z.ZodString;
    title: z.ZodString;
    outcome: z.ZodEnum<["approved", "rejected", "changes_requested"]>;
    tally: z.ZodObject<{
        approve: z.ZodNumber;
        reject: z.ZodNumber;
        request_changes: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        approve: number;
        reject: number;
        request_changes: number;
    }, {
        approve: number;
        reject: number;
        request_changes: number;
    }>;
}, "strip", z.ZodTypeAny, {
    title: string;
    decisionId: string;
    outcome: "approved" | "rejected" | "changes_requested";
    tally: {
        approve: number;
        reject: number;
        request_changes: number;
    };
}, {
    title: string;
    decisionId: string;
    outcome: "approved" | "rejected" | "changes_requested";
    tally: {
        approve: number;
        reject: number;
        request_changes: number;
    };
}>;
export declare const TaskStateSchema: z.ZodEnum<["open", "claimed", "in_progress", "blocked", "done"]>;
export declare const TaskPayloadSchema: z.ZodObject<{
    taskId: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    assignee: z.ZodOptional<z.ZodString>;
    state: z.ZodEnum<["open", "claimed", "in_progress", "blocked", "done"]>;
}, "strip", z.ZodTypeAny, {
    title: string;
    taskId: string;
    state: "blocked" | "done" | "open" | "claimed" | "in_progress";
    description?: string | undefined;
    assignee?: string | undefined;
}, {
    title: string;
    taskId: string;
    state: "blocked" | "done" | "open" | "claimed" | "in_progress";
    description?: string | undefined;
    assignee?: string | undefined;
}>;
export declare const ReviewPayloadSchema: z.ZodObject<{
    target: z.ZodString;
    verdict: z.ZodOptional<z.ZodEnum<["approve", "request_changes", "comment"]>>;
    comments: z.ZodString;
}, "strip", z.ZodTypeAny, {
    target: string;
    comments: string;
    verdict?: "approve" | "request_changes" | "comment" | undefined;
}, {
    target: string;
    comments: string;
    verdict?: "approve" | "request_changes" | "comment" | undefined;
}>;
export declare const ExecutionRequestPayloadSchema: z.ZodObject<{
    command: z.ZodString;
    cwd: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    command: string;
    cwd?: string | undefined;
    reason?: string | undefined;
}, {
    command: string;
    cwd?: string | undefined;
    reason?: string | undefined;
}>;
export declare const ExecutionResultPayloadSchema: z.ZodObject<{
    command: z.ZodOptional<z.ZodString>;
    success: z.ZodBoolean;
    exitCode: z.ZodOptional<z.ZodNumber>;
    output: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    command?: string | undefined;
    exitCode?: number | undefined;
    output?: string | undefined;
}, {
    success: boolean;
    command?: string | undefined;
    exitCode?: number | undefined;
    output?: string | undefined;
}>;
export declare const PAYLOAD_SCHEMAS: {
    readonly status: z.ZodObject<{
        status: z.ZodEnum<["idle", "working", "blocked", "reviewing", "waiting", "done", "offline"]>;
        intent: z.ZodOptional<z.ZodString>;
        detail: z.ZodOptional<z.ZodString>;
        activity: z.ZodOptional<z.ZodObject<{
            action: z.ZodEnum<["editing", "api_change", "schema_change", "package_change", "migration", "deploy", "destructive"]>;
            targets: z.ZodArray<z.ZodString, "many">;
            detail: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            action: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
            targets: string[];
            detail?: string | undefined;
        }, {
            action: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
            targets: string[];
            detail?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        intent?: string | undefined;
        detail?: string | undefined;
        activity?: {
            action: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
            targets: string[];
            detail?: string | undefined;
        } | undefined;
    }, {
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        intent?: string | undefined;
        detail?: string | undefined;
        activity?: {
            action: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
            targets: string[];
            detail?: string | undefined;
        } | undefined;
    }>;
    readonly thought: z.ZodObject<{
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        text: string;
    }, {
        text: string;
    }>;
    readonly proposal: z.ZodObject<{
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        kind: z.ZodDefault<z.ZodEnum<["general", "architecture", "api_contract", "schema", "dependency", "deployment", "security"]>>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        kind: "general" | "architecture" | "api_contract" | "schema" | "dependency" | "deployment" | "security";
        description?: string | undefined;
    }, {
        title: string;
        description?: string | undefined;
        kind?: "general" | "architecture" | "api_contract" | "schema" | "dependency" | "deployment" | "security" | undefined;
    }>;
    readonly question: z.ZodObject<{
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        text: string;
    }, {
        text: string;
    }>;
    readonly answer: z.ZodObject<{
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        text: string;
    }, {
        text: string;
    }>;
    readonly warning: z.ZodObject<{
        severity: z.ZodEnum<["info", "caution", "danger"]>;
        category: z.ZodEnum<["file_conflict", "api_contract", "schema_change", "destructive_command", "file_deletion", "env_overwrite", "migration", "deployment", "package_change", "security", "other"]>;
        text: z.ZodString;
        targets: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        severity: "info" | "caution" | "danger";
        category: "schema_change" | "package_change" | "migration" | "api_contract" | "deployment" | "security" | "file_conflict" | "destructive_command" | "file_deletion" | "env_overwrite" | "other";
        targets?: string[] | undefined;
    }, {
        text: string;
        severity: "info" | "caution" | "danger";
        category: "schema_change" | "package_change" | "migration" | "api_contract" | "deployment" | "security" | "file_conflict" | "destructive_command" | "file_deletion" | "env_overwrite" | "other";
        targets?: string[] | undefined;
    }>;
    readonly conflict: z.ZodObject<{
        resource: z.ZodString;
        category: z.ZodEnum<["editing", "api_change", "schema_change", "package_change", "migration", "deploy", "destructive"]>;
        agents: z.ZodArray<z.ZodString, "many">;
        detail: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        category: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
        resource: string;
        agents: string[];
        detail?: string | undefined;
    }, {
        category: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
        resource: string;
        agents: string[];
        detail?: string | undefined;
    }>;
    readonly decision: z.ZodObject<{
        decisionId: z.ZodString;
        title: z.ZodString;
        outcome: z.ZodEnum<["approved", "rejected", "changes_requested"]>;
        tally: z.ZodObject<{
            approve: z.ZodNumber;
            reject: z.ZodNumber;
            request_changes: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            approve: number;
            reject: number;
            request_changes: number;
        }, {
            approve: number;
            reject: number;
            request_changes: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        decisionId: string;
        outcome: "approved" | "rejected" | "changes_requested";
        tally: {
            approve: number;
            reject: number;
            request_changes: number;
        };
    }, {
        title: string;
        decisionId: string;
        outcome: "approved" | "rejected" | "changes_requested";
        tally: {
            approve: number;
            reject: number;
            request_changes: number;
        };
    }>;
    readonly vote: z.ZodObject<{
        decisionId: z.ZodString;
        vote: z.ZodEnum<["approve", "reject", "request_changes"]>;
        comment: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        vote: "approve" | "reject" | "request_changes";
        decisionId: string;
        comment?: string | undefined;
    }, {
        vote: "approve" | "reject" | "request_changes";
        decisionId: string;
        comment?: string | undefined;
    }>;
    readonly task: z.ZodObject<{
        taskId: z.ZodString;
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        assignee: z.ZodOptional<z.ZodString>;
        state: z.ZodEnum<["open", "claimed", "in_progress", "blocked", "done"]>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        taskId: string;
        state: "blocked" | "done" | "open" | "claimed" | "in_progress";
        description?: string | undefined;
        assignee?: string | undefined;
    }, {
        title: string;
        taskId: string;
        state: "blocked" | "done" | "open" | "claimed" | "in_progress";
        description?: string | undefined;
        assignee?: string | undefined;
    }>;
    readonly review: z.ZodObject<{
        target: z.ZodString;
        verdict: z.ZodOptional<z.ZodEnum<["approve", "request_changes", "comment"]>>;
        comments: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        target: string;
        comments: string;
        verdict?: "approve" | "request_changes" | "comment" | undefined;
    }, {
        target: string;
        comments: string;
        verdict?: "approve" | "request_changes" | "comment" | undefined;
    }>;
    readonly execution_request: z.ZodObject<{
        command: z.ZodString;
        cwd: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        command: string;
        cwd?: string | undefined;
        reason?: string | undefined;
    }, {
        command: string;
        cwd?: string | undefined;
        reason?: string | undefined;
    }>;
    readonly execution_result: z.ZodObject<{
        command: z.ZodOptional<z.ZodString>;
        success: z.ZodBoolean;
        exitCode: z.ZodOptional<z.ZodNumber>;
        output: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        success: boolean;
        command?: string | undefined;
        exitCode?: number | undefined;
        output?: string | undefined;
    }, {
        success: boolean;
        command?: string | undefined;
        exitCode?: number | undefined;
        output?: string | undefined;
    }>;
};
export declare const MessageSenderSchema: z.ZodObject<{
    agentId: z.ZodString;
    name: z.ZodString;
    provider: z.ZodString;
    role: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    provider: string;
    role: string;
    agentId: string;
}, {
    name: string;
    provider: string;
    role: string;
    agentId: string;
}>;
export declare const StoredMessageSchema: z.ZodObject<{
    id: z.ZodString;
    roomId: z.ZodString;
    from: z.ZodObject<{
        agentId: z.ZodString;
        name: z.ZodString;
        provider: z.ZodString;
        role: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        provider: string;
        role: string;
        agentId: string;
    }, {
        name: string;
        provider: string;
        role: string;
        agentId: string;
    }>;
    kind: z.ZodEnum<["status", "thought", "proposal", "question", "answer", "warning", "conflict", "decision", "vote", "task", "review", "execution_request", "execution_result"]>;
    payload: z.ZodUnknown;
    to: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    refId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    ts: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
    roomId: string;
    from: {
        name: string;
        provider: string;
        role: string;
        agentId: string;
    };
    ts: number;
    payload?: unknown;
    to?: string | null | undefined;
    refId?: string | null | undefined;
}, {
    id: string;
    kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
    roomId: string;
    from: {
        name: string;
        provider: string;
        role: string;
        agentId: string;
    };
    ts: number;
    payload?: unknown;
    to?: string | null | undefined;
    refId?: string | null | undefined;
}>;
export declare const RoomIdSchema: z.ZodString;
export declare const HelloFrameSchema: z.ZodObject<{
    op: z.ZodLiteral<"hello">;
    room: z.ZodString;
    agent: z.ZodObject<Omit<{
        id: z.ZodString;
        name: z.ZodString;
        provider: z.ZodString;
        model: z.ZodString;
        role: z.ZodString;
        capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        status: z.ZodDefault<z.ZodEnum<["idle", "working", "blocked", "reviewing", "waiting", "done", "offline"]>>;
        intent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "id"> & {
        id: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        provider: string;
        model: string;
        role: string;
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        capabilities: string[];
        id?: string | undefined;
        intent?: string | null | undefined;
    }, {
        name: string;
        provider: string;
        model: string;
        role: string;
        id?: string | undefined;
        status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
        capabilities?: string[] | undefined;
        intent?: string | null | undefined;
    }>;
    resumeToken: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    op: "hello";
    room: string;
    agent: {
        name: string;
        provider: string;
        model: string;
        role: string;
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        capabilities: string[];
        id?: string | undefined;
        intent?: string | null | undefined;
    };
    resumeToken?: string | undefined;
}, {
    op: "hello";
    room: string;
    agent: {
        name: string;
        provider: string;
        model: string;
        role: string;
        id?: string | undefined;
        status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
        capabilities?: string[] | undefined;
        intent?: string | null | undefined;
    };
    resumeToken?: string | undefined;
}>;
export declare const PublishFrameSchema: z.ZodObject<{
    op: z.ZodLiteral<"publish">;
    /** Optional client-generated message id (UUID). Lets the sender know the
     *  id of its own message up front (e.g. a proposal's decision id). */
    id: z.ZodOptional<z.ZodString>;
    kind: z.ZodEnum<["status", "thought", "proposal", "question", "answer", "warning", "conflict", "decision", "vote", "task", "review", "execution_request", "execution_result"]>;
    payload: z.ZodUnknown;
    to: z.ZodOptional<z.ZodString>;
    refId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
    op: "publish";
    id?: string | undefined;
    payload?: unknown;
    to?: string | undefined;
    refId?: string | undefined;
}, {
    kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
    op: "publish";
    id?: string | undefined;
    payload?: unknown;
    to?: string | undefined;
    refId?: string | undefined;
}>;
export declare const HeartbeatFrameSchema: z.ZodObject<{
    op: z.ZodLiteral<"heartbeat">;
}, "strip", z.ZodTypeAny, {
    op: "heartbeat";
}, {
    op: "heartbeat";
}>;
export declare const UpdateFrameSchema: z.ZodObject<{
    op: z.ZodLiteral<"update">;
    status: z.ZodOptional<z.ZodEnum<["idle", "working", "blocked", "reviewing", "waiting", "done", "offline"]>>;
    intent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    activity: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        action: z.ZodEnum<["editing", "api_change", "schema_change", "package_change", "migration", "deploy", "destructive"]>;
        targets: z.ZodArray<z.ZodString, "many">;
        detail: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        action: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
        targets: string[];
        detail?: string | undefined;
    }, {
        action: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
        targets: string[];
        detail?: string | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    op: "update";
    status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
    intent?: string | null | undefined;
    activity?: {
        action: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
        targets: string[];
        detail?: string | undefined;
    } | null | undefined;
}, {
    op: "update";
    status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
    intent?: string | null | undefined;
    activity?: {
        action: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
        targets: string[];
        detail?: string | undefined;
    } | null | undefined;
}>;
export declare const HistoryFrameSchema: z.ZodObject<{
    op: z.ZodLiteral<"history">;
    limit: z.ZodDefault<z.ZodNumber>;
    beforeTs: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    op: "history";
    limit: number;
    beforeTs?: number | undefined;
}, {
    op: "history";
    limit?: number | undefined;
    beforeTs?: number | undefined;
}>;
export declare const LeaveFrameSchema: z.ZodObject<{
    op: z.ZodLiteral<"leave">;
}, "strip", z.ZodTypeAny, {
    op: "leave";
}, {
    op: "leave";
}>;
export declare const ClientFrameSchema: z.ZodDiscriminatedUnion<"op", [z.ZodObject<{
    op: z.ZodLiteral<"hello">;
    room: z.ZodString;
    agent: z.ZodObject<Omit<{
        id: z.ZodString;
        name: z.ZodString;
        provider: z.ZodString;
        model: z.ZodString;
        role: z.ZodString;
        capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        status: z.ZodDefault<z.ZodEnum<["idle", "working", "blocked", "reviewing", "waiting", "done", "offline"]>>;
        intent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "id"> & {
        id: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        provider: string;
        model: string;
        role: string;
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        capabilities: string[];
        id?: string | undefined;
        intent?: string | null | undefined;
    }, {
        name: string;
        provider: string;
        model: string;
        role: string;
        id?: string | undefined;
        status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
        capabilities?: string[] | undefined;
        intent?: string | null | undefined;
    }>;
    resumeToken: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    op: "hello";
    room: string;
    agent: {
        name: string;
        provider: string;
        model: string;
        role: string;
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        capabilities: string[];
        id?: string | undefined;
        intent?: string | null | undefined;
    };
    resumeToken?: string | undefined;
}, {
    op: "hello";
    room: string;
    agent: {
        name: string;
        provider: string;
        model: string;
        role: string;
        id?: string | undefined;
        status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
        capabilities?: string[] | undefined;
        intent?: string | null | undefined;
    };
    resumeToken?: string | undefined;
}>, z.ZodObject<{
    op: z.ZodLiteral<"publish">;
    /** Optional client-generated message id (UUID). Lets the sender know the
     *  id of its own message up front (e.g. a proposal's decision id). */
    id: z.ZodOptional<z.ZodString>;
    kind: z.ZodEnum<["status", "thought", "proposal", "question", "answer", "warning", "conflict", "decision", "vote", "task", "review", "execution_request", "execution_result"]>;
    payload: z.ZodUnknown;
    to: z.ZodOptional<z.ZodString>;
    refId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
    op: "publish";
    id?: string | undefined;
    payload?: unknown;
    to?: string | undefined;
    refId?: string | undefined;
}, {
    kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
    op: "publish";
    id?: string | undefined;
    payload?: unknown;
    to?: string | undefined;
    refId?: string | undefined;
}>, z.ZodObject<{
    op: z.ZodLiteral<"heartbeat">;
}, "strip", z.ZodTypeAny, {
    op: "heartbeat";
}, {
    op: "heartbeat";
}>, z.ZodObject<{
    op: z.ZodLiteral<"update">;
    status: z.ZodOptional<z.ZodEnum<["idle", "working", "blocked", "reviewing", "waiting", "done", "offline"]>>;
    intent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    activity: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        action: z.ZodEnum<["editing", "api_change", "schema_change", "package_change", "migration", "deploy", "destructive"]>;
        targets: z.ZodArray<z.ZodString, "many">;
        detail: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        action: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
        targets: string[];
        detail?: string | undefined;
    }, {
        action: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
        targets: string[];
        detail?: string | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    op: "update";
    status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
    intent?: string | null | undefined;
    activity?: {
        action: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
        targets: string[];
        detail?: string | undefined;
    } | null | undefined;
}, {
    op: "update";
    status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
    intent?: string | null | undefined;
    activity?: {
        action: "editing" | "api_change" | "schema_change" | "package_change" | "migration" | "deploy" | "destructive";
        targets: string[];
        detail?: string | undefined;
    } | null | undefined;
}>, z.ZodObject<{
    op: z.ZodLiteral<"history">;
    limit: z.ZodDefault<z.ZodNumber>;
    beforeTs: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    op: "history";
    limit: number;
    beforeTs?: number | undefined;
}, {
    op: "history";
    limit?: number | undefined;
    beforeTs?: number | undefined;
}>, z.ZodObject<{
    op: z.ZodLiteral<"leave">;
}, "strip", z.ZodTypeAny, {
    op: "leave";
}, {
    op: "leave";
}>]>;
export declare const RoomAgentSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    provider: z.ZodString;
    model: z.ZodString;
    role: z.ZodString;
    capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodDefault<z.ZodEnum<["idle", "working", "blocked", "reviewing", "waiting", "done", "offline"]>>;
    intent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
} & {
    online: z.ZodBoolean;
    lastSeen: z.ZodNumber;
    joinedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    provider: string;
    model: string;
    role: string;
    status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
    capabilities: string[];
    online: boolean;
    lastSeen: number;
    joinedAt: number;
    intent?: string | null | undefined;
}, {
    id: string;
    name: string;
    provider: string;
    model: string;
    role: string;
    online: boolean;
    lastSeen: number;
    joinedAt: number;
    status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
    capabilities?: string[] | undefined;
    intent?: string | null | undefined;
}>;
export declare const WelcomeFrameSchema: z.ZodObject<{
    op: z.ZodLiteral<"welcome">;
    room: z.ZodString;
    agent: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        provider: z.ZodString;
        model: z.ZodString;
        role: z.ZodString;
        capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        status: z.ZodDefault<z.ZodEnum<["idle", "working", "blocked", "reviewing", "waiting", "done", "offline"]>>;
        intent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        capabilities: string[];
        intent?: string | null | undefined;
    }, {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
        capabilities?: string[] | undefined;
        intent?: string | null | undefined;
    }>;
    sessionToken: z.ZodString;
    agents: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        provider: z.ZodString;
        model: z.ZodString;
        role: z.ZodString;
        capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        status: z.ZodDefault<z.ZodEnum<["idle", "working", "blocked", "reviewing", "waiting", "done", "offline"]>>;
        intent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    } & {
        online: z.ZodBoolean;
        lastSeen: z.ZodNumber;
        joinedAt: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        capabilities: string[];
        online: boolean;
        lastSeen: number;
        joinedAt: number;
        intent?: string | null | undefined;
    }, {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        online: boolean;
        lastSeen: number;
        joinedAt: number;
        status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
        capabilities?: string[] | undefined;
        intent?: string | null | undefined;
    }>, "many">;
    recent: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        roomId: z.ZodString;
        from: z.ZodObject<{
            agentId: z.ZodString;
            name: z.ZodString;
            provider: z.ZodString;
            role: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        }, {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        }>;
        kind: z.ZodEnum<["status", "thought", "proposal", "question", "answer", "warning", "conflict", "decision", "vote", "task", "review", "execution_request", "execution_result"]>;
        payload: z.ZodUnknown;
        to: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        refId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        ts: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }, {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }>, "many">;
    resumed: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    agents: {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        capabilities: string[];
        online: boolean;
        lastSeen: number;
        joinedAt: number;
        intent?: string | null | undefined;
    }[];
    op: "welcome";
    room: string;
    agent: {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        capabilities: string[];
        intent?: string | null | undefined;
    };
    sessionToken: string;
    recent: {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }[];
    resumed: boolean;
}, {
    agents: {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        online: boolean;
        lastSeen: number;
        joinedAt: number;
        status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
        capabilities?: string[] | undefined;
        intent?: string | null | undefined;
    }[];
    op: "welcome";
    room: string;
    agent: {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
        capabilities?: string[] | undefined;
        intent?: string | null | undefined;
    };
    sessionToken: string;
    recent: {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }[];
    resumed: boolean;
}>;
export declare const MessageFrameSchema: z.ZodObject<{
    op: z.ZodLiteral<"message">;
    message: z.ZodObject<{
        id: z.ZodString;
        roomId: z.ZodString;
        from: z.ZodObject<{
            agentId: z.ZodString;
            name: z.ZodString;
            provider: z.ZodString;
            role: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        }, {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        }>;
        kind: z.ZodEnum<["status", "thought", "proposal", "question", "answer", "warning", "conflict", "decision", "vote", "task", "review", "execution_request", "execution_result"]>;
        payload: z.ZodUnknown;
        to: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        refId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        ts: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }, {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    message: {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    };
    op: "message";
}, {
    message: {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    };
    op: "message";
}>;
export declare const PresenceEventSchema: z.ZodEnum<["joined", "left", "offline", "reconnected", "updated"]>;
export declare const PresenceFrameSchema: z.ZodObject<{
    op: z.ZodLiteral<"presence">;
    event: z.ZodEnum<["joined", "left", "offline", "reconnected", "updated"]>;
    agent: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        provider: z.ZodString;
        model: z.ZodString;
        role: z.ZodString;
        capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        status: z.ZodDefault<z.ZodEnum<["idle", "working", "blocked", "reviewing", "waiting", "done", "offline"]>>;
        intent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    } & {
        online: z.ZodBoolean;
        lastSeen: z.ZodNumber;
        joinedAt: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        capabilities: string[];
        online: boolean;
        lastSeen: number;
        joinedAt: number;
        intent?: string | null | undefined;
    }, {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        online: boolean;
        lastSeen: number;
        joinedAt: number;
        status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
        capabilities?: string[] | undefined;
        intent?: string | null | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    op: "presence";
    agent: {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        capabilities: string[];
        online: boolean;
        lastSeen: number;
        joinedAt: number;
        intent?: string | null | undefined;
    };
    event: "offline" | "joined" | "left" | "reconnected" | "updated";
}, {
    op: "presence";
    agent: {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        online: boolean;
        lastSeen: number;
        joinedAt: number;
        status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
        capabilities?: string[] | undefined;
        intent?: string | null | undefined;
    };
    event: "offline" | "joined" | "left" | "reconnected" | "updated";
}>;
export declare const HistoryResultFrameSchema: z.ZodObject<{
    op: z.ZodLiteral<"history_result">;
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        roomId: z.ZodString;
        from: z.ZodObject<{
            agentId: z.ZodString;
            name: z.ZodString;
            provider: z.ZodString;
            role: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        }, {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        }>;
        kind: z.ZodEnum<["status", "thought", "proposal", "question", "answer", "warning", "conflict", "decision", "vote", "task", "review", "execution_request", "execution_result"]>;
        payload: z.ZodUnknown;
        to: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        refId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        ts: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }, {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    op: "history_result";
    messages: {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }[];
}, {
    op: "history_result";
    messages: {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }[];
}>;
export declare const HeartbeatAckFrameSchema: z.ZodObject<{
    op: z.ZodLiteral<"heartbeat_ack">;
    ts: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    ts: number;
    op: "heartbeat_ack";
}, {
    ts: number;
    op: "heartbeat_ack";
}>;
export declare const ErrorFrameSchema: z.ZodObject<{
    op: z.ZodLiteral<"error">;
    code: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    message: string;
    op: "error";
}, {
    code: string;
    message: string;
    op: "error";
}>;
export declare const ServerFrameSchema: z.ZodDiscriminatedUnion<"op", [z.ZodObject<{
    op: z.ZodLiteral<"welcome">;
    room: z.ZodString;
    agent: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        provider: z.ZodString;
        model: z.ZodString;
        role: z.ZodString;
        capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        status: z.ZodDefault<z.ZodEnum<["idle", "working", "blocked", "reviewing", "waiting", "done", "offline"]>>;
        intent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        capabilities: string[];
        intent?: string | null | undefined;
    }, {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
        capabilities?: string[] | undefined;
        intent?: string | null | undefined;
    }>;
    sessionToken: z.ZodString;
    agents: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        provider: z.ZodString;
        model: z.ZodString;
        role: z.ZodString;
        capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        status: z.ZodDefault<z.ZodEnum<["idle", "working", "blocked", "reviewing", "waiting", "done", "offline"]>>;
        intent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    } & {
        online: z.ZodBoolean;
        lastSeen: z.ZodNumber;
        joinedAt: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        capabilities: string[];
        online: boolean;
        lastSeen: number;
        joinedAt: number;
        intent?: string | null | undefined;
    }, {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        online: boolean;
        lastSeen: number;
        joinedAt: number;
        status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
        capabilities?: string[] | undefined;
        intent?: string | null | undefined;
    }>, "many">;
    recent: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        roomId: z.ZodString;
        from: z.ZodObject<{
            agentId: z.ZodString;
            name: z.ZodString;
            provider: z.ZodString;
            role: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        }, {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        }>;
        kind: z.ZodEnum<["status", "thought", "proposal", "question", "answer", "warning", "conflict", "decision", "vote", "task", "review", "execution_request", "execution_result"]>;
        payload: z.ZodUnknown;
        to: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        refId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        ts: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }, {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }>, "many">;
    resumed: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    agents: {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        capabilities: string[];
        online: boolean;
        lastSeen: number;
        joinedAt: number;
        intent?: string | null | undefined;
    }[];
    op: "welcome";
    room: string;
    agent: {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        capabilities: string[];
        intent?: string | null | undefined;
    };
    sessionToken: string;
    recent: {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }[];
    resumed: boolean;
}, {
    agents: {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        online: boolean;
        lastSeen: number;
        joinedAt: number;
        status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
        capabilities?: string[] | undefined;
        intent?: string | null | undefined;
    }[];
    op: "welcome";
    room: string;
    agent: {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
        capabilities?: string[] | undefined;
        intent?: string | null | undefined;
    };
    sessionToken: string;
    recent: {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }[];
    resumed: boolean;
}>, z.ZodObject<{
    op: z.ZodLiteral<"message">;
    message: z.ZodObject<{
        id: z.ZodString;
        roomId: z.ZodString;
        from: z.ZodObject<{
            agentId: z.ZodString;
            name: z.ZodString;
            provider: z.ZodString;
            role: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        }, {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        }>;
        kind: z.ZodEnum<["status", "thought", "proposal", "question", "answer", "warning", "conflict", "decision", "vote", "task", "review", "execution_request", "execution_result"]>;
        payload: z.ZodUnknown;
        to: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        refId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        ts: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }, {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    message: {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    };
    op: "message";
}, {
    message: {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    };
    op: "message";
}>, z.ZodObject<{
    op: z.ZodLiteral<"presence">;
    event: z.ZodEnum<["joined", "left", "offline", "reconnected", "updated"]>;
    agent: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        provider: z.ZodString;
        model: z.ZodString;
        role: z.ZodString;
        capabilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        status: z.ZodDefault<z.ZodEnum<["idle", "working", "blocked", "reviewing", "waiting", "done", "offline"]>>;
        intent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    } & {
        online: z.ZodBoolean;
        lastSeen: z.ZodNumber;
        joinedAt: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        capabilities: string[];
        online: boolean;
        lastSeen: number;
        joinedAt: number;
        intent?: string | null | undefined;
    }, {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        online: boolean;
        lastSeen: number;
        joinedAt: number;
        status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
        capabilities?: string[] | undefined;
        intent?: string | null | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    op: "presence";
    agent: {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        status: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline";
        capabilities: string[];
        online: boolean;
        lastSeen: number;
        joinedAt: number;
        intent?: string | null | undefined;
    };
    event: "offline" | "joined" | "left" | "reconnected" | "updated";
}, {
    op: "presence";
    agent: {
        id: string;
        name: string;
        provider: string;
        model: string;
        role: string;
        online: boolean;
        lastSeen: number;
        joinedAt: number;
        status?: "idle" | "working" | "blocked" | "reviewing" | "waiting" | "done" | "offline" | undefined;
        capabilities?: string[] | undefined;
        intent?: string | null | undefined;
    };
    event: "offline" | "joined" | "left" | "reconnected" | "updated";
}>, z.ZodObject<{
    op: z.ZodLiteral<"history_result">;
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        roomId: z.ZodString;
        from: z.ZodObject<{
            agentId: z.ZodString;
            name: z.ZodString;
            provider: z.ZodString;
            role: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        }, {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        }>;
        kind: z.ZodEnum<["status", "thought", "proposal", "question", "answer", "warning", "conflict", "decision", "vote", "task", "review", "execution_request", "execution_result"]>;
        payload: z.ZodUnknown;
        to: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        refId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        ts: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }, {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    op: "history_result";
    messages: {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }[];
}, {
    op: "history_result";
    messages: {
        id: string;
        kind: "status" | "thought" | "proposal" | "question" | "answer" | "warning" | "conflict" | "decision" | "vote" | "task" | "review" | "execution_request" | "execution_result";
        roomId: string;
        from: {
            name: string;
            provider: string;
            role: string;
            agentId: string;
        };
        ts: number;
        payload?: unknown;
        to?: string | null | undefined;
        refId?: string | null | undefined;
    }[];
}>, z.ZodObject<{
    op: z.ZodLiteral<"heartbeat_ack">;
    ts: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    ts: number;
    op: "heartbeat_ack";
}, {
    ts: number;
    op: "heartbeat_ack";
}>, z.ZodObject<{
    op: z.ZodLiteral<"error">;
    code: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    message: string;
    op: "error";
}, {
    code: string;
    message: string;
    op: "error";
}>]>;
export declare function validatePayload(kind: z.infer<typeof MessageKindSchema>, payload: unknown): {
    ok: true;
    payload: unknown;
} | {
    ok: false;
    error: string;
};
