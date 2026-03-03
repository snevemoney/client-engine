/**
 * Auto-generate documentation from source code.
 *
 * Usage:
 *   npx tsx scripts/generate-docs.ts          # Generate docs
 *   npx tsx scripts/generate-docs.ts --check   # Check if docs are stale (exit 1 if so)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, relative, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "docs", "generated");
const CHECK_MODE = process.argv.includes("--check");

// ── Helpers ──────────────────────────────────────────────────

function glob(dir: string, pattern: RegExp, results: string[] = []): string[] {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const stat = statSync(full);
    if (stat.isDirectory()) glob(full, pattern, results);
    else if (pattern.test(entry)) results.push(full);
  }
  return results;
}

function writeOrCheck(filename: string, content: string) {
  const path = join(OUT, filename);
  if (CHECK_MODE) {
    if (!existsSync(path)) {
      console.error(`STALE: ${filename} does not exist. Run: npm run docs:generate`);
      process.exitCode = 1;
      return;
    }
    const existing = readFileSync(path, "utf-8");
    if (existing !== content) {
      console.error(`STALE: ${filename} is outdated. Run: npm run docs:generate`);
      process.exitCode = 1;
    }
    return;
  }
  writeFileSync(path, content, "utf-8");
  console.log(`  wrote ${filename}`);
}

// ── 1. API Routes ────────────────────────────────────────────

function generateApiRoutes(): string {
  const files = glob(join(ROOT, "src", "app", "api"), /^route\.ts$/);
  const routes: { path: string; methods: string[] }[] = [];

  for (const file of files.sort()) {
    const rel = relative(join(ROOT, "src", "app"), file);
    const apiPath = "/" + rel.replace(/\/route\.ts$/, "").replace(/\\/g, "/");

    const content = readFileSync(file, "utf-8");
    const methods: string[] = [];
    if (/export\s+(async\s+)?function\s+GET/m.test(content)) methods.push("GET");
    if (/export\s+(async\s+)?function\s+POST/m.test(content)) methods.push("POST");
    if (/export\s+(async\s+)?function\s+PATCH/m.test(content)) methods.push("PATCH");
    if (/export\s+(async\s+)?function\s+PUT/m.test(content)) methods.push("PUT");
    if (/export\s+(async\s+)?function\s+DELETE/m.test(content)) methods.push("DELETE");

    routes.push({ path: apiPath, methods });
  }

  const lines = [
    "# API Routes",
    "",
    `> Auto-generated on ${new Date().toISOString().split("T")[0]}. ${routes.length} route files.`,
    "",
    "| Path | Methods |",
    "|------|---------|",
    ...routes.map(r => `| \`${r.path}\` | ${r.methods.join(", ")} |`),
    "",
  ];
  return lines.join("\n");
}

// ── 2. Prisma Models ─────────────────────────────────────────

function generatePrismaModels(): string {
  const schema = readFileSync(join(ROOT, "prisma", "schema.prisma"), "utf-8");
  const models: { name: string; fields: number }[] = [];

  const modelRegex = /^model\s+(\w+)\s*\{([^}]*)\}/gm;
  let match;
  while ((match = modelRegex.exec(schema)) !== null) {
    const name = match[1];
    const body = match[2];
    const fields = body.split("\n").filter(l => {
      const trimmed = l.trim();
      return trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("@@") && !trimmed.startsWith("/");
    }).length;
    models.push({ name, fields });
  }

  const enums: string[] = [];
  const enumRegex = /^enum\s+(\w+)\s*\{/gm;
  while ((match = enumRegex.exec(schema)) !== null) {
    enums.push(match[1]);
  }

  const lines = [
    "# Prisma Models",
    "",
    `> Auto-generated on ${new Date().toISOString().split("T")[0]}. ${models.length} models, ${enums.length} enums.`,
    "",
    "## Models",
    "",
    "| Model | Fields |",
    "|-------|--------|",
    ...models.map(m => `| ${m.name} | ${m.fields} |`),
    "",
    "## Enums",
    "",
    enums.map(e => `- \`${e}\``).join("\n"),
    "",
  ];
  return lines.join("\n");
}

// ── 3. Brain Tools ───────────────────────────────────────────

function generateBrainTools(): string {
  const file = join(ROOT, "src", "lib", "brain", "tools.ts");
  const content = readFileSync(file, "utf-8");

  const tools: { name: string; description: string }[] = [];
  const toolRegex = /name:\s*"([^"]+)"[\s\S]*?description:\s*\n?\s*"([^"]+)/g;
  let match;
  while ((match = toolRegex.exec(content)) !== null) {
    tools.push({ name: match[1], description: match[2].slice(0, 120) });
  }

  const writeMatch = content.match(/WRITE_TOOLS\s*=\s*new\s+Set\(\[([\s\S]+?)\]\)/);
  const writeTools = writeMatch
    ? writeMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, "")) ?? []
    : [];

  const lines = [
    "# Brain Tools",
    "",
    `> Auto-generated on ${new Date().toISOString().split("T")[0]}. ${tools.length} tools (${writeTools.length} write).`,
    "",
    "## All Tools",
    "",
    "| Tool | Type | Description |",
    "|------|------|-------------|",
    ...tools.map(t => `| \`${t.name}\` | ${writeTools.includes(t.name) ? "write" : "read"} | ${t.description} |`),
    "",
    "## Write Tools (require approval in agent mode)",
    "",
    writeTools.map(t => `- \`${t}\``).join("\n"),
    "",
  ];
  return lines.join("\n");
}

// ── 4. Agents ────────────────────────────────────────────────

function generateAgents(): string {
  const file = join(ROOT, "src", "lib", "agents", "registry.ts");
  const content = readFileSync(file, "utf-8");

  const agents: { id: string; name: string }[] = [];
  const idRegex = /id:\s*"([^"]+)"/g;
  const nameRegex = /name:\s*"([^"]+)"/g;

  let idMatch, nameMatch;
  while ((idMatch = idRegex.exec(content)) !== null) {
    nameMatch = nameRegex.exec(content);
    agents.push({ id: idMatch[1], name: nameMatch?.[1] ?? idMatch[1] });
  }

  const lines = [
    "# Agent Registry",
    "",
    `> Auto-generated on ${new Date().toISOString().split("T")[0]}. ${agents.length} agents.`,
    "",
    "| ID | Name |",
    "|----|------|",
    ...agents.map(a => `| \`${a.id}\` | ${a.name} |`),
    "",
  ];
  return lines.join("\n");
}

// ── 5. Dashboard Pages ───────────────────────────────────────

function generatePages(): string {
  const files = glob(join(ROOT, "src", "app", "dashboard"), /^page\.tsx$/);
  const pages = files.sort().map(f => {
    const rel = relative(join(ROOT, "src", "app"), f);
    return "/" + rel.replace(/\/page\.tsx$/, "").replace(/\\/g, "/");
  });

  const lines = [
    "# Dashboard Pages",
    "",
    `> Auto-generated on ${new Date().toISOString().split("T")[0]}. ${pages.length} pages.`,
    "",
    ...pages.map(p => `- \`${p}\``),
    "",
  ];
  return lines.join("\n");
}

// ── 6. Env Vars ──────────────────────────────────────────────

function generateEnvVars(): string {
  const file = join(ROOT, ".env.example");
  if (!existsSync(file)) return "# Environment Variables\n\nNo .env.example found.\n";

  const content = readFileSync(file, "utf-8");
  const vars: { name: string; comment: string }[] = [];
  let lastComment = "";

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      lastComment = trimmed.replace(/^#\s*/, "");
    } else if (trimmed.includes("=")) {
      const name = trimmed.split("=")[0].trim();
      if (name) {
        vars.push({ name, comment: lastComment });
        lastComment = "";
      }
    } else {
      lastComment = "";
    }
  }

  const lines = [
    "# Environment Variables",
    "",
    `> Auto-generated from .env.example on ${new Date().toISOString().split("T")[0]}. ${vars.length} variables.`,
    "",
    "| Variable | Description |",
    "|----------|-------------|",
    ...vars.map(v => `| \`${v.name}\` | ${v.comment || "—"} |`),
    "",
  ];
  return lines.join("\n");
}

// ── Main ─────────────────────────────────────────────────────

console.log(CHECK_MODE ? "Checking docs freshness..." : "Generating docs...");

writeOrCheck("api-routes.md", generateApiRoutes());
writeOrCheck("prisma-models.md", generatePrismaModels());
writeOrCheck("brain-tools.md", generateBrainTools());
writeOrCheck("agents.md", generateAgents());
writeOrCheck("pages.md", generatePages());
writeOrCheck("env-vars.md", generateEnvVars());

if (!CHECK_MODE) {
  console.log("\nDone. Generated 6 files in docs/generated/");
} else if (process.exitCode !== 1) {
  console.log("All docs are up to date.");
}
