/**
 * Generate a single AI context file that can be pasted into any AI chat
 * (ChatGPT, Gemini, Copilot, etc.) to give full codebase understanding.
 *
 * Usage:
 *   npx tsx scripts/generate-ai-context.ts              # Generate context file
 *   npx tsx scripts/generate-ai-context.ts --clipboard   # Also copy to clipboard (macOS)
 *
 * Output: docs/generated/AI_CONTEXT.md (single file, paste-ready)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

function readIfExists(path: string): string {
  const full = join(ROOT, path);
  if (!existsSync(full)) return `<!-- ${path} not found -->\n`;
  return readFileSync(full, "utf-8");
}

function readGenerated(name: string): string {
  const full = join(ROOT, "docs", "generated", name);
  if (!existsSync(full)) return `<!-- docs/generated/${name} not found — run npm run docs:generate -->\n`;
  return readFileSync(full, "utf-8");
}

function getLatestSession(): string {
  const sessionsDir = join(ROOT, "docs", "sessions");
  if (!existsSync(sessionsDir)) return "No session journals yet.\n";
  const files = readdirSync(sessionsDir)
    .filter((f: string) => f.endsWith(".md"))
    .sort()
    .reverse();
  if (files.length === 0) return "No session journals yet.\n";
  return readFileSync(join(sessionsDir, files[0]), "utf-8");
}

const context = `# AI Context — Client Engine
> Generated on ${new Date().toISOString().split("T")[0]}. Paste this into any AI chat for full codebase understanding.
> Source repo has detailed docs — this is the condensed version for external AI tools.

---

${readIfExists("CLAUDE.md")}

---

# Coding Patterns (Follow These Exactly)

${readIfExists("docs/ai-rules/coding-patterns.md")}

---

# Domain Knowledge

${readIfExists("docs/ai-rules/domain-knowledge.md")}

---

# Infrastructure (Dev/Prod/VPS/Docker)

${readIfExists("docs/ai-rules/infrastructure.md")}

---

# Common Tasks (Step-by-Step)

${readIfExists("docs/ai-rules/common-tasks.md")}

---

# Current State

## Roadmap
${readIfExists("ROADMAP.md")}

## Recent Changes
${readIfExists("CHANGELOG.md")}

---

# Auto-Generated Inventories

## API Routes
${readGenerated("api-routes.md")}

## Database Models
${readGenerated("prisma-models.md")}

## Brain Tools
${readGenerated("brain-tools.md")}

## Agents
${readGenerated("agents.md")}

## Dashboard Pages
${readGenerated("pages.md")}

## Environment Variables
${readGenerated("env-vars.md")}

---

# Latest Session Journal

${getLatestSession()}

---

# Session Rules

When we finish working:
1. Summarize what we discussed, decided, and built
2. List any files that were created or modified
3. Note key insights and trade-offs
4. List next steps / open questions
5. I will paste this summary into docs/sessions/YYYY-MM-DD-topic.md in the repo

When writing code for this project:
- Follow the coding patterns above exactly
- Use the existing utilities (jsonError, requireAuth, withRouteTiming, withSummaryCache, etc.)
- Dark theme: bg-neutral-900, text-neutral-100, border-neutral-800
- Never auto-send proposals or auto-start builds — human approval required
- Never use \`any\` — use proper types
- Always parallelize independent Prisma queries with Promise.all
`;

const outPath = join(ROOT, "docs", "generated", "AI_CONTEXT.md");
writeFileSync(outPath, context, "utf-8");

const lineCount = context.split("\n").length;
const charCount = context.length;
console.log(`Generated AI_CONTEXT.md (${lineCount} lines, ${Math.round(charCount / 1024)}KB)`);
console.log(`  → ${outPath}`);

if (process.argv.includes("--clipboard")) {
  try {
    execFileSync("pbcopy", [], { input: context });
    console.log("  → Copied to clipboard (pbcopy)");
  } catch {
    console.log("  → Could not copy to clipboard");
  }
}

console.log("\nPaste this file into ChatGPT, Gemini, or any AI chat for full context.");
