import { describe, expect, it } from "vitest";
import { assessCommand } from "../src/server/safety.js";

describe("assessCommand", () => {
  const dangerous: [string, string][] = [
    ["rm -rf node_modules", "file_deletion"],
    ["git clean -fd", "file_deletion"],
    ["git reset --hard HEAD~3", "destructive_command"],
    ["git push origin main --force", "destructive_command"],
    ["psql -c 'DROP TABLE users'", "destructive_command"],
    ["echo SECRET > .env", "env_overwrite"],
    ["cp env.backup .env", "env_overwrite"],
    ["npx prisma migrate deploy", "migration"],
    ["vercel deploy --prod", "deployment"],
    ["kubectl apply -f prod.yaml", "deployment"],
    ["terraform apply", "deployment"],
    ["npm install left-pad", "package_change"],
    ["pnpm add zod@4", "package_change"],
    ["pip install requests", "package_change"],
    ["chmod 777 /etc/secrets", "security"],
    ["sudo rm /var/log/app.log", "security"],
  ];

  it.each(dangerous)("flags %s as %s", (command, category) => {
    const assessment = assessCommand(command);
    expect(assessment.dangerous).toBe(true);
    expect(assessment.category).toBe(category);
  });

  const safe = [
    "npm test",
    "git status",
    "ls -la src",
    "node scripts/build.js",
    "git commit -m 'feat: add login'",
    "cat .env.example",
    "grep -r formula src/",
  ];

  it.each(safe)("does not flag %s", (command) => {
    expect(assessCommand(command).dangerous).toBe(false);
  });
});
