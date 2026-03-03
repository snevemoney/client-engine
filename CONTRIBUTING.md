# Contributing — Client Engine

## Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 16 (or Docker)
- Redis 7 (optional, for workers)

### First-Time Setup
```bash
git clone <repo>
cd client-engine-1
cp .env.example .env         # Edit with your values
npm install
npx prisma db push           # Create/sync schema (no migrations)
npx prisma db seed            # Seed admin user + sample data
npm run dev                   # http://localhost:3000
```

### Dev Login
Set `AUTH_DEV_PASSWORD` in `.env`. Any email + that password logs in as dev-admin.

---

## Code Conventions

### File Naming
- API routes: `src/app/api/{resource}/route.ts` or `src/app/api/{resource}/[id]/route.ts`
- Pages: `src/app/dashboard/{page}/page.tsx`
- Lib modules: `src/lib/{domain}/{function}.ts`
- Components: `src/components/{domain}/{ComponentName}.tsx`

### TypeScript
- Strict mode enabled (`tsconfig.json`)
- Path alias: `@/*` → `./src/*`
- No `any` — use proper types or `unknown` with narrowing
- Prisma types used directly (no DTO layer yet — see ADR-003)

### Imports
- Use `@/lib/...` path alias, not relative paths from route files
- Group: external → `@/lib` → `@/components` → relative

### Style
- Dark theme: neutral-800/900/950 palette
- `cn()` from `@/lib/utils` for className merging (clsx + tailwind-merge)
- Sonner for toast notifications
- No emojis in code or UI

---

## How to Add a New API Route

1. Create `src/app/api/{resource}/route.ts`
2. Use this template:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/{resource}", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      // Business logic here (prefer calling src/lib service functions)
      return NextResponse.json({ data });
    } catch (err) {
      console.error("[{resource}]", err);
      return jsonError("Failed", 500);
    }
  });
}
```

3. For mutations, add Zod validation:
```typescript
import { z } from "zod";
const schema = z.object({ title: z.string().min(1) });
const body = schema.safeParse(await request.json());
if (!body.success) return jsonError("Invalid input", 400);
```

4. For summaries/aggregations, wrap in cache:
```typescript
import { withSummaryCache } from "@/lib/http/cached-handler";
return await withSummaryCache("resource/summary", async () => { ... }, 15_000);
```

### Route Checklist
- [ ] `requireAuth()` check
- [ ] `withRouteTiming()` wrapper
- [ ] Zod validation on mutations
- [ ] `jsonError()` for error responses
- [ ] `logOpsEventSafe()` for important mutations
- [ ] Rate limiting for write endpoints (`rateLimitByKey`)
- [ ] Activity logging for domain mutations

---

## How to Add a New Prisma Model

1. Add model to `prisma/schema.prisma`
2. Add appropriate indexes (`@@index`)
3. Run `npx prisma db push` (we use db push, not migrations — see ADR-003)
4. Run `npx prisma generate` (regenerate client types)
5. Create service functions in `src/lib/{domain}/service.ts`
6. Create API routes
7. Run `npm run docs:generate` to update model inventory

---

## How to Add a New Brain Tool

1. Add tool definition to `BRAIN_TOOLS` array in `src/lib/brain/tools.ts`:
```typescript
{
  name: "my_tool",
  description: "What this tool does and when to use it",
  input_schema: {
    type: "object" as const,
    properties: { ... },
    required: [...],
  },
}
```

2. Add execution handler in `src/lib/brain/executor.ts`:
```typescript
case "my_tool": return executeMyTool(input, ctx);
```

3. If it's a write tool, add to `WRITE_TOOLS` set in `tools.ts`

4. If agents should use it, add to the relevant agent's `allowedTools` in `registry.ts`

5. Run `npm run docs:generate` to update tool inventory

---

## How to Add a New Agent

1. Add agent ID to `AgentId` union in `src/lib/agents/types.ts`
2. Add config to `AGENT_REGISTRY` in `src/lib/agents/registry.ts`:
```typescript
{
  id: "my_agent",
  name: "My Agent",
  description: "What this agent does",
  systemPromptExtension: "Specialized instructions...",
  allowedTools: ["tool1", "tool2"],
  autoApprovedTools: [],  // Tools that skip approval
  scheduledRuns: [{ cronLabel: "daily_morning", taskPrompt: "Do your thing" }],
}
```

3. Test via cron: `POST /api/agents/cron` with `{agentId: "my_agent", trigger: "manual"}`
4. Monitor at `/dashboard/operator/agents`

---

## How to Add a New Dashboard Page

1. Create `src/app/dashboard/{page}/page.tsx`
2. Mark as client component if interactive: `"use client";`
3. Add intelligence bar (health + risk + NBA):
```typescript
import { useIntelligenceContext } from "@/hooks/useIntelligenceContext";
const { risk, nba, score } = useIntelligenceContext("command_center", "command_center");
```

4. Add Brain context injection:
```typescript
import { useBrainPanel } from "@/components/brain/BrainPanelContext";
const { setPageData } = useBrainPanel();
useEffect(() => { setPageData("Context string for AI..."); }, [data]);
```

5. Add to sidebar navigation in the layout component

---

## How to Add a New NBA Rule

1. Add rule function in `src/lib/next-actions/rules.ts`:
```typescript
function emitMyRule(ctx: NextActionContext, out: NextActionCandidate[]) {
  if (/* condition */) {
    out.push({
      title: "Action title",
      reason: "Why this matters",
      priority: "high",
      createdByRule: "my_rule_key",
      dedupeKey: "my_rule:unique_key",
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      // ... other fields
    });
  }
}
```

2. Call it from `produceNextActions()`
3. Add scope mapping in `src/lib/next-actions/scope.ts`
4. Optionally add template in `src/lib/next-actions/templates.ts`
5. Optionally add explanation in `src/lib/next-actions/explanations.ts`

---

## Testing

### E2E Tests (Playwright)
```bash
npx playwright test                    # Run all
npx playwright test smoke.spec.ts      # Run specific
npx playwright test --headed           # See browser
```

Tests use `AUTH_DEV_PASSWORD` for login. Config in `playwright.config.ts`.

### Type Check
```bash
npx tsc --noEmit
```

### Dev Smoke Test
After changes, verify:
1. `/dashboard/founder` — health score loads
2. `/dashboard/leads` — lead list loads
3. `/dashboard/command` — all 30+ cards render
4. Browser console: 0 errors

---

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add builder site quality check
fix: prevent double pipeline runs on same lead
refactor: extract follow-up service from route handlers
docs: add ADR for memory weight system
chore: add docs:generate npm script
perf: add composite indexes for NBA context queries
```

---

## PR Checklist

Before merging:
- [ ] `npx tsc --noEmit` passes (zero errors)
- [ ] `npx playwright test` passes (or relevant subset)
- [ ] Browser console: zero errors on key pages
- [ ] `npm run docs:generate` run if models/routes/tools changed
- [ ] CHANGELOG.md updated for user-facing changes

---

## Deploy

```bash
# Local Docker
docker compose up -d

# VPS deploy
./scripts/deploy-safe.sh

# Post-deploy
./scripts/smoke-test.sh
```

See [docs/VPS_DEPLOY_CHECKLIST.md](docs/VPS_DEPLOY_CHECKLIST.md) for full production deploy guide.
