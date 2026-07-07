export declare function instructionsBlock(room: string): string;
/** Insert or refresh the marker-delimited block in a markdown file. */
export declare function upsertBlock(path: string, block: string): "created" | "updated" | "unchanged";
/** Merge conclave hooks into .claude/settings.json without disturbing existing ones. */
export declare function installClaudeHooks(root: string): "created" | "updated" | "unchanged";
export interface InitResult {
    root: string;
    room: string;
    config: "created" | "updated" | "unchanged";
    claudeMd: "created" | "updated" | "unchanged";
    agentsMd: "created" | "updated" | "unchanged";
    claudeHooks: "created" | "updated" | "unchanged" | "skipped";
}
export declare function initProject(root: string, options?: {
    hooks?: boolean;
    room?: string;
}): InitResult;
