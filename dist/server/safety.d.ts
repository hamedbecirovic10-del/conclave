import type { WarningCategory, WarningSeverity } from "../protocol/types.js";
export interface SafetyAssessment {
    dangerous: boolean;
    category: WarningCategory;
    severity: WarningSeverity;
    reason: string;
}
/**
 * Classify a shell command (or task description). Used by the server to
 * broadcast a mandatory warning before dangerous execution requests are
 * relayed, and exported so agents can pre-check locally via the SDK.
 */
export declare function assessCommand(command: string): SafetyAssessment;
