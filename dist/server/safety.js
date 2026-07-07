const RULES = [
    {
        category: "file_deletion",
        severity: "danger",
        reason: "recursive/forced file deletion",
        pattern: /\brm\s+(-\w*[rf]\w*\s+)+|\brmdir\b|\bgit\s+clean\s+-\w*[fd]/i,
    },
    {
        category: "destructive_command",
        severity: "danger",
        reason: "discards uncommitted work or rewrites remote history",
        pattern: /\bgit\s+(reset\s+--hard|push\s+[^\n]*(--force\b|-f\b)|branch\s+-D)/i,
    },
    {
        category: "destructive_command",
        severity: "danger",
        reason: "destructive database statement",
        pattern: /\b(drop\s+(table|database|schema)|truncate\s+table|delete\s+from\s+\w+\s*;?\s*$)/i,
    },
    {
        category: "env_overwrite",
        severity: "danger",
        reason: "writes over an environment file",
        pattern: /(>\s*|\b(cp|mv)\s+[^\n]*\s)\.env(\.\w+)?\b/i,
    },
    {
        category: "migration",
        severity: "caution",
        reason: "database migration",
        pattern: /\b(prisma\s+migrate|alembic\s+(upgrade|downgrade)|knex\s+migrate|rails\s+db:migrate|drizzle-kit\s+(push|migrate)|migrate\s+(up|down|deploy))\b/i,
    },
    {
        category: "deployment",
        severity: "danger",
        reason: "deployment action",
        pattern: /\b(vercel(\s+deploy)?\s+--prod|vercel\s+promote|kubectl\s+(apply|delete|rollout)|terraform\s+(apply|destroy)|fly\s+deploy|serverless\s+deploy|eb\s+deploy|gcloud\s+(app|run)\s+deploy|firebase\s+deploy|netlify\s+deploy\s+--prod)\b/i,
    },
    {
        category: "package_change",
        severity: "caution",
        reason: "dependency change",
        pattern: /\b(npm\s+(install|i|add|remove|rm|uninstall|update|upgrade|audit\s+fix)|pnpm\s+(add|remove|install|update|up)|yarn\s+(add|remove|upgrade|install)|bun\s+(add|remove|install|update)|pip3?\s+install|cargo\s+(add|install)|go\s+get)\b/i,
    },
    {
        category: "security",
        severity: "danger",
        reason: "permission or credential-sensitive operation",
        pattern: /\b(chmod\s+(-\w+\s+)?0?777|chown\s+[^\n]*root|sudo\s+|ssh-keygen|openssl\s+(genrsa|req)|gh\s+secret\s+set|vault\s+write)\b/i,
    },
];
/**
 * Classify a shell command (or task description). Used by the server to
 * broadcast a mandatory warning before dangerous execution requests are
 * relayed, and exported so agents can pre-check locally via the SDK.
 */
export function assessCommand(command) {
    for (const rule of RULES) {
        if (rule.pattern.test(command)) {
            return {
                dangerous: true,
                category: rule.category,
                severity: rule.severity,
                reason: rule.reason,
            };
        }
    }
    return { dangerous: false, category: "other", severity: "info", reason: "no dangerous pattern detected" };
}
//# sourceMappingURL=safety.js.map