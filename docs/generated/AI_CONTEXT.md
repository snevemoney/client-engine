# AI Context — Client Engine
> Generated on 2026-03-02. Paste this into any AI chat for full codebase understanding.
> Source repo has detailed docs — this is the condensed version for external AI tools.

---

# Client Engine

Private AI-powered business OS for evenslouis.ca. Manages the full client lifecycle: lead capture → enrichment → scoring → positioning → proposal → delivery → proof → retention. The AI proposes, the human decides.

## AI Session Rules (MANDATORY)

**During the session:**
- Update CHANGELOG.md as you make changes (not at the end)
- Run `npm run docs:generate` after modifying routes, models, tools, agents, or pages

**At session end:**
- Create `docs/sessions/YYYY-MM-DD-topic.md` with: goal, decisions, what was built, insights, next steps
- Update ROADMAP.md if milestones were completed or new tasks identified
- Create `docs/decisions/NNN-topic.md` if an architectural decision was made

Do NOT wait to be asked. Do NOT skip this. See [docs/ai-rules/session-journal.md](docs/ai-rules/session-journal.md) for the full template.

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router, standalone) |
| Language | TypeScript strict, `@/*` alias |
| Database | PostgreSQL 16 + Prisma 6 (`prisma db push`, no migrations) |
| Auth | NextAuth v5 (JWT, Credentials + Google OAuth) |
| AI Brain/Agents | Claude `claude-sonnet-4-20250514` via `@anthropic-ai/sdk` |
| AI Pipeline | OpenAI GPT-4o-mini (enrich/score/position/propose) |
| Queue | Postgres-backed (JobRun model) |
| Deploy | Docker Compose (5 services) + Caddy on Hostinger VPS |

## Money Path (Non-Negotiable)

```
CAPTURE → ENRICH → SCORE → POSITION → PROPOSE → [HUMAN APPROVAL] → BUILD
```

- No proposal without positioning. No build without acceptance.
- `PATCH /api/leads/[id]` cannot set status/outcome fields — use dedicated routes.
- Pipeline orchestrator: `src/lib/pipeline/orchestrator.ts` (Postgres advisory locks, idempotent).

## Project Structure

```
src/app/api/          340 route files (~500+ HTTP endpoints)
src/app/dashboard/    83 dashboard pages
src/lib/brain/        AI Brain (Claude tool loop, 25 tools)
src/lib/agents/       Multi-agent system (10 workers, approval gates)
src/lib/memory/       Memory pipeline (weight learning → NBA ranking)
src/lib/next-actions/ NBA system (15 rules, ranking formula)
src/lib/risk/         Risk engine (8 rules)
src/lib/scoring/      Score engine (0-100, bands: healthy/warning/critical)
src/lib/growth/       Growth engine (outreach templates, deals)
src/lib/notifications/ Notification pipeline (events → deliveries → escalations)
src/lib/pipeline/     AI pipeline orchestrator (enrich → score → position → propose)
src/lib/signals/      RSS signal engine (scoring, prospect matching)
src/lib/ops-events/   Observability (logOpsEventSafe, sanitizeMeta)
prisma/schema.prisma  75+ models (2600+ lines)
scripts/              28 deploy, backfill, seed, ops scripts
tests/e2e/            30 Playwright specs
docs/                 80+ feature/phase/runbook docs
```

## Key Files by Domain

| Domain | Files to Read |
|--------|--------------|
| Brain (AI chat) | `src/lib/brain/engine.ts`, `tools.ts`, `executor.ts`, `system-prompt.ts`, `stream.ts` |
| Agents | `src/lib/agents/types.ts`, `registry.ts`, `runner.ts`, `approval.ts`, `scheduler.ts` |
| Memory | `src/lib/memory/ingest.ts`, `weights.ts`, `policy.ts`, `attribution.ts` |
| NBA | `src/lib/next-actions/rules.ts`, `ranking.ts`, `delivery-actions.ts`, `fetch-context.ts` |
| Risk | `src/lib/risk/rules.ts`, `fetch-context.ts`, `service.ts` |
| Scoring | `src/lib/scoring/engine.ts`, `compute-and-store.ts`, `adapters/` |
| Notifications | `src/lib/notifications/service.ts`, `channels/`, `escalations.ts` |
| Growth | `src/lib/growth/templates.ts`, `summary.ts` |
| Niche | `src/lib/niche/context.ts` (target audience, positioning) |
| Auth | `src/lib/auth.ts` (NextAuth config, dev bypass, Google OAuth) |
| Shared utils | `src/lib/api-utils.ts`, `src/lib/db.ts`, `src/lib/http/cached-handler.ts` |
| Config/axioms | `SYSTEM_MANIFEST.md`, `docs/CLIENT_ENGINE_AXIOMS.md` |

## Database (75+ Models)

Key models: `Lead` (50+ fields, full sales OS), `IntakeLead` (CRM intake), `Proposal` (lifecycle + versions), `DeliveryProject` (80+ fields, milestones, handoff, retention, builder), `ProofRecord`/`ProofCandidate`, `NextBestAction`, `RiskFlag`, `ScoreSnapshot`/`ScoreEvent`, `AgentRun`/`AgentApproval`, `NotificationEvent`/`NotificationDelivery`, `JobRun`/`JobSchedule`, `CopilotSession`, `OperatorLearnedWeight`, `ClientInteraction`, `Deal`/`Prospect`, `StrategyWeek`, `FounderQuarter`/`FounderWeek`.

## AI Systems

### Brain (25 tools)
Claude chat via `/api/brain/chat` (SSE streaming). Max 10 iterations. `ToolContext = {userId, baseUrl, entityType, entityId}`. Pages inject context via `setPageData()`.

### Agents (10 workers)
Each agent = config in `registry.ts` (system prompt + tool allowlist). Reuse Brain's Claude loop. Limits: 50k tokens, 15 tool calls, 2 concurrent, 24h approval expiry. Circuit breaker after 2 failures.

Agents: `commander` (6h), `signal_scout`, `outreach_writer`, `distribution_ops`, `followup_enforcer` (2x/day), `proposal_architect`, `scope_risk_ctrl`, `proof_producer` (weekly), `conversion_analyst` (weekly), `qa_sentinel` (6h).

### Write Tools (require approval in agent mode)
`run_risk_rules`, `run_next_actions`, `recompute_score`, `execute_nba`, `draft_outreach`, `update_lead`, `update_proposal`, `update_delivery_project`, `manage_deal`, `send_operator_alert`, `schedule_content_post`, `delegate_to_agent`

### Memory Pipeline
Actions → weight deltas (success +1, failure -1, dismiss -0.5, snooze -0.25) → `OperatorLearnedWeight` (clamped [-10, +10]) → feeds into NBA ranking: `learnedBoost = ruleWeight × 2 + actionWeight × 1`.

## API Patterns

Every route uses:
- `requireAuth()` — session check
- `withRouteTiming("METHOD /path", handler)` — timing + slow logging (500ms)
- `rateLimitByKey()` — per-route rate limits
- `withSummaryCache(key, fn, ttlMs)` — in-memory TTL cache for GETs (15-30s)
- Zod validation on mutations
- `jsonError(message, status)` for errors
- `logOpsEventSafe()` for observability
- Activity logging per domain (LeadActivity, ProposalActivity, DeliveryActivity)
- Cron auth: Bearer token (`AGENT_CRON_SECRET`) + session fallback

## Niche

Target: high-ticket local service businesses with follow-up leakage (med spas, dental, contractors, legal, real estate, coaching). Avg deal: $3k–$15k. Positioning: "We build websites that close the follow-up gap."

## Required Env Vars

`DATABASE_URL`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`

Optional: `REDIS_URL`, `RESEND_API_KEY`, `AGENT_CRON_SECRET`, `GOOGLE_CLIENT_ID`/`SECRET`, `META_*`, `IMAP_*`

Full list: `.env.example`

## Run

```bash
npm install && npx prisma db push && npm run dev    # Dev
npx playwright test                                  # E2E tests
npx tsc --noEmit                                     # Type check
npm run docs:generate                                # Regenerate docs from code
docker compose up -d                                 # Production
```

## AI Rules (Read Before Writing Code)

- [docs/ai-rules/coding-patterns.md](docs/ai-rules/coding-patterns.md) — Route templates, query patterns, component patterns, naming, imports, things to never do
- [docs/ai-rules/domain-knowledge.md](docs/ai-rules/domain-knowledge.md) — Business model, niche, money path, scoring, NBA, agent safety, vocabulary
- [docs/ai-rules/common-tasks.md](docs/ai-rules/common-tasks.md) — Step-by-step for adding routes, models, tools, agents, pages, rules
- [docs/ai-rules/infrastructure.md](docs/ai-rules/infrastructure.md) — Dev/prod environments, Docker, VPS, domains, networking, deploy, monitoring, cron
- [docs/ai-rules/session-journal.md](docs/ai-rules/session-journal.md) — After each session, summarize decisions + update docs (say "journal this session")

## Session History

Past work sessions with full thinking process: [docs/sessions/](docs/sessions/)

## Deep Dives

- [ARCHITECTURE.md](ARCHITECTURE.md) — Full system design, data flows, all models and endpoints
- [CONTRIBUTING.md](CONTRIBUTING.md) — How to add features, conventions, checklists
- [CHANGELOG.md](CHANGELOG.md) — What changed
- [ROADMAP.md](ROADMAP.md) — What's next
- [docs/decisions/](docs/decisions/) — Architecture Decision Records (why we chose X)
- [docs/generated/](docs/generated/) — Auto-generated inventories (routes, models, tools)
- [SYSTEM_MANIFEST.md](SYSTEM_MANIFEST.md) — Core philosophy and money path
- [docs/CLIENT_ENGINE_AXIOMS.md](docs/CLIENT_ENGINE_AXIOMS.md) — Behavioral contract
- [docs/RUNBOOK.md](docs/RUNBOOK.md) — E2E test guide
- [docs/VPS_DEPLOY_CHECKLIST.md](docs/VPS_DEPLOY_CHECKLIST.md) — Production deploy


---

# Coding Patterns (Follow These Exactly)

# Coding Patterns — AI Rules

When writing code in this codebase, follow these patterns exactly. Do not invent new patterns.

## API Route Pattern

Every route handler MUST use this structure:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/{resource}", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      const data = await db.model.findMany({ ... });
      return NextResponse.json({ data });
    } catch (err) {
      console.error("[{resource}]", err);
      return jsonError("Failed to load", 500);
    }
  });
}
```

**Rules:**
- Always wrap in `withRouteTiming()`
- Always `requireAuth()` first (returns null = unauthorized)
- Use `jsonError()` for all error responses, never raw `new Response()`
- Use `try/catch` — log error with `console.error("[route-name]", err)`
- Never return raw Prisma errors to the client

## Mutation Pattern

```typescript
import { z } from "zod";

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/{resource}", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid input", 400);

    // Rate limit for write endpoints
    const rl = rateLimit(`{resource}:${session.user.id}`, 20, 60_000);
    if (!rl.ok) return jsonError("Rate limited", 429);

    try {
      const result = await db.model.create({ data: parsed.data });
      logOpsEventSafe({ category: "api_action", eventKey: "resource.created", ... });
      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      console.error("[{resource}]", err);
      return jsonError("Failed", 500);
    }
  });
}
```

## Summary/Aggregation Endpoint Pattern

```typescript
import { withSummaryCache } from "@/lib/http/cached-handler";

export async function GET() {
  return withRouteTiming("GET /api/{resource}/summary", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      return await withSummaryCache(
        "resource/summary",
        async () => {
          const [count1, count2] = await Promise.all([
            db.model.count({ where: { ... } }),
            db.model.count({ where: { ... } }),
          ]);
          return { count1, count2 };
        },
        15_000  // 15 second cache
      );
    } catch (err) {
      console.error("[{resource}/summary]", err);
      return jsonError("Failed", 500);
    }
  });
}
```

## Component Pattern

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { AsyncState } from "@/components/ui/AsyncState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export function MyComponent({ entityId }: { entityId: string }) {
  const { data, error, loading, refetch } = useRetryableFetch<MyType>(
    `/api/resource/${entityId}`
  );

  if (loading || error) return <AsyncState loading={loading} error={error} />;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-100">Title</h2>
      {/* Dark theme: bg-neutral-900, text-neutral-100/300/400, border-neutral-800 */}
    </div>
  );
}
```

## Prisma Query Patterns

**Always use `select` when you only need specific fields:**
```typescript
// GOOD
const lead = await db.lead.findFirst({
  where: { id },
  select: { id: true, title: true, score: true },
});

// BAD — fetches all 50+ fields including JSON blobs
const lead = await db.lead.findFirst({ where: { id } });
```

**Parallelize independent queries:**
```typescript
// GOOD
const [leads, proposals, projects] = await Promise.all([
  db.lead.count({ where: { status: "NEW" } }),
  db.proposal.count({ where: { status: "sent" } }),
  db.deliveryProject.count({ where: { status: "in_progress" } }),
]);

// BAD — sequential when independent
const leads = await db.lead.count({ where: { status: "NEW" } });
const proposals = await db.proposal.count({ where: { status: "sent" } });
```

**Use count() for aggregations, not findMany + .length:**
```typescript
// GOOD
const count = await db.lead.count({ where: { status: "NEW" } });

// BAD — fetches all rows just to count
const leads = await db.lead.findMany({ where: { status: "NEW" } });
const count = leads.length;
```

## Error Handling

- Use `jsonError(message, status)` from `@/lib/api-utils` — never raw Response
- Log with `console.error("[route-name]", err)` — always include route context
- Never return raw error messages to clients — sanitize with `sanitizeErrorMessage(err)`
- For fire-and-forget logging: `logOpsEventSafe()` (never await, never throw)

## Naming

- API routes: kebab-case paths (`/api/delivery-projects/[id]/handoff/complete`)
- Lib modules: camelCase filenames (`fetchContext.ts`, `computeAndStore.ts`)
- Components: PascalCase (`ScoreBadge.tsx`, `DeliveryChecklist.tsx`)
- Types/interfaces: PascalCase (`NextActionCandidate`, `BrainStreamEvent`)
- Constants: UPPER_SNAKE_CASE (`AGENT_LIMITS`, `SHARP_DROP_THRESHOLD`)
- Database enums: PascalCase enum name, snake_case or camelCase values

## Imports

```typescript
// 1. External packages
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// 2. @/lib modules
import { db } from "@/lib/db";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { logOpsEventSafe } from "@/lib/ops-events/log";

// 3. @/components
import { Badge } from "@/components/ui/Badge";

// 4. Relative (rare — prefer @/ paths)
import { computeScore } from "./engine";
```

## Things to NEVER Do

- Never use `any` — use `unknown` with type narrowing
- Never `as never` to bypass Prisma enums — validate with Zod
- Never put business logic in route handlers — call `src/lib/` service functions
- Never call the app's own API routes from server code — call services directly
- Never use dynamic `import()` for server-side lib modules — use static imports
- Never fetch all rows when you only need a count
- Never `PATCH /api/leads/[id]` to set status/dealOutcome — use dedicated routes
- Never auto-send proposals or auto-start builds — human approval required


---

# Domain Knowledge

# Domain Knowledge — AI Rules

Context an AI needs to give good advice and write correct code in this codebase.

## Business Model

This is a **solo freelance web development business** targeting high-ticket local service businesses. The operator (Evens Louis) works a 9-5 and runs this business OS in the background.

**Revenue model:** Project-based ($3,000–$15,000 per website/system build)

**Niche:** Local service businesses losing revenue to slow follow-up:
- Med spas, dental practices, home renovation contractors
- Legal firms (personal injury, family law)
- Real estate teams
- Coaching and consulting practices

**Value proposition:** "We build websites that close the follow-up gap for local service businesses."

## The Money Path

```
CAPTURE → ENRICH → SCORE → POSITION → PROPOSE → [HUMAN] → BUILD
```

This is the non-negotiable core flow. Every feature should support this path.

**Key rules:**
- No proposal without positioning (the blue-ocean angle, felt problem, language map)
- No build without human approval of the proposal
- No auto-send, no auto-build — the AI proposes, the human decides
- Rejected leads stop immediately — no pipeline progression
- `PATCH /api/leads/[id]` CANNOT set status or dealOutcome — use dedicated routes

## Lead Qualification

**Driver types (PBD framework):** survival, status, freedom, cause, competition, enemy

**Qualification score:** 0-12 (Pain, Urgency, Budget, Responsiveness, Decision Maker, Fit — 2 pts each)

**Sales stages:** prospecting → first_contact → needs_analysis → proposal → negotiation → won → lost

## Scoring System

**Health scores:** 0-100 composite from weighted factors
- healthy ≥ 80 (green)
- warning ≥ 50 (yellow)
- critical < 50 (red)

**Events that trigger notifications:**
- threshold_breach: entered critical band
- sharp_drop: delta ≤ -15 points
- recovery: entered healthy band

## NBA (Next Best Actions)

The NBA system ranks recommendations. Key concepts:
- **Priority levels:** critical > high > medium > low
- **Score formula:** base + boosts - penalties + learnedBoost
- **Learned weights:** Memory pipeline adjusts rankings based on what the operator actually executes vs dismisses
- **Suppression:** Operator can suppress specific rules for 7d/30d

## Agent System

10 autonomous agents run on cron schedules. They:
- Can use the same 25 tools as the Brain
- Have filtered tool allowlists per agent
- Require operator approval for write tools
- Are limited to 50k tokens and 15 tool calls per run

**Critical safety rules:**
- Circuit breaker: stop after 2 consecutive failures
- Max 2 concurrent agent runs
- Approval expires after 24 hours
- Stale runs reaped after 15 minutes

## Proof Engine

Proof is NDA-safe and observational:
- "Today I saw..." patterns
- Specific, outcome-based (not vague)
- No client identifiers in public content
- No hype, superiority, or invented metrics

**Flow:** Delivery complete → ProofCandidate (draft → ready) → promote to ProofRecord → generate ContentPost drafts → schedule/post

## Notification Severity

| Severity | When |
|----------|------|
| info | Score recovery, routine events |
| warning | Sharp drop, overdue follow-ups |
| critical | Score threshold breach, failed deliveries, dead-letter alerts |

## Key Business Metrics

- **Cash collected** — actual revenue received
- **Revenue won (30d)** — deal value of won leads
- **Turnaround → proposal** — days from intake to proposal sent
- **Turnaround → close** — days from intake to deal won
- **Follow-up discipline** — overdue count, touches per lead
- **Leverage score** — reusable assets %, outcomes tracked %, failure visibility

## Vocabulary

| Term | Meaning |
|------|---------|
| Brain | Claude AI chat with tools (slide-over panel) |
| Agent | Autonomous Claude worker on cron schedule |
| NBA | Next Best Action (ranked recommendation) |
| Flywheel | End-to-end lead processing (capture → propose) |
| Workday Run | Morning automation (research → pipeline → retries) |
| Positioning | Blue-ocean angle, felt problem, language map |
| Proof | NDA-safe case study content from delivered work |
| Leverage Score | 0-100 measuring reusable output extraction |
| Driver | Lead motivation type (PBD framework) |
| Artifact | Content piece linked to a lead (notes, score, positioning, proposal) |


---

# Infrastructure (Dev/Prod/VPS/Docker)

# Infrastructure — AI Rules

Complete infrastructure reference for development, production, networking, domains, and VPS.

## Environments

### Development (Local)

| Component | URL / Config |
|-----------|-------------|
| Next.js app | `http://localhost:3000` |
| PostgreSQL | `localhost:5432` (or Docker) |
| Redis | `localhost:6379` (optional) |
| Builder service | `http://localhost:3001` (optional) |

**Start dev:**
```bash
npm run dev              # Next.js dev server
npm run worker           # Background workers (separate terminal)
```

**Database:**
```bash
npx prisma db push       # Sync schema
npx prisma studio        # GUI browser
npm run db:seed           # Seed admin + sample data
```

**Auth bypass:** Set `AUTH_DEV_PASSWORD` in `.env` — any email + that password logs in.

### Production (VPS)

| Component | URL / Config |
|-----------|-------------|
| Public URL | `https://evenslouis.ca` |
| App (Docker) | `127.0.0.1:3200` → container port 3000 |
| Builder (Docker) | `127.0.0.1:3001` → container port 3001 |
| PostgreSQL | Docker internal network (`postgres:5432`) |
| Redis | Docker internal network (`redis:6379`) |
| Reverse proxy | Caddy (auto HTTPS) |

---

## Docker Compose Architecture

```yaml
services:
  app:        # Next.js standalone, port 3200→3000
  worker:     # Background workers (email, monitor, BullMQ)
  postgres:   # PostgreSQL 16 Alpine, persistent volume
  redis:      # Redis 7 Alpine, persistent volume
  builder:    # Website builder service, port 3001→3001
```

**Network:** All services on default Docker bridge network. Services reference each other by name (`postgres`, `redis`).

**Volumes:**
- `pgdata` — PostgreSQL data (persistent)
- `redisdata` — Redis data (persistent)

**Health checks:**
- postgres: `pg_isready -U postgres`
- redis: `redis-cli ping`

---

## VPS Details

| Property | Value |
|----------|-------|
| Provider | Hostinger |
| OS | Ubuntu |
| Access | SSH |
| Reverse proxy | Caddy (auto-HTTPS via Let's Encrypt) |
| Firewall | UFW (ports 22, 80, 443) |

**SSH access:**
```bash
ssh user@evenslouis.ca
```

**Service management:**
```bash
docker compose up -d           # Start all services
docker compose down            # Stop all services
docker compose logs -f app     # Follow app logs
docker compose restart app     # Restart app only
```

**Disk management:**
```bash
./scripts/check-space.sh       # Check disk usage
./scripts/vps-disk-cleanup.sh  # Clean old images/caches
./scripts/run-vps-cleanup.sh   # Full cleanup routine
```

---

## Domains & DNS

| Domain | Purpose | Status |
|--------|---------|--------|
| `evenslouis.ca` | Main site + app | Active |
| `evenslouis.pro` | Available for future use | Reserved |

**DNS:** Pointed to Hostinger VPS IP. Caddy handles HTTPS certificates automatically.

**Subdomains (potential):**
- `app.evenslouis.ca` — Dashboard (if separated from public site)
- `api.evenslouis.ca` — API (currently same origin)
- `builder.evenslouis.ca` — Builder service (currently internal only)

---

## Networking

### External Access
```
Internet → Caddy (:443) → app container (:3000)
                        → (future: builder if public)
```

### Internal (Docker Network)
```
app ──→ postgres:5432
app ──→ redis:6379
app ──→ builder:3001
worker ──→ postgres:5432
worker ──→ redis:6379
```

### Ports

| Port | Service | External? |
|------|---------|-----------|
| 22 | SSH | Yes (UFW) |
| 80 | Caddy HTTP (→ HTTPS redirect) | Yes |
| 443 | Caddy HTTPS | Yes |
| 3000 | Next.js app (Docker internal) | No |
| 3001 | Builder service (Docker internal) | No |
| 3200 | App published port (host) | Localhost only |
| 5432 | PostgreSQL (Docker internal) | No |
| 6379 | Redis (Docker internal) | No |

### Security
- All services bound to `127.0.0.1` (not `0.0.0.0`) except Caddy
- PostgreSQL and Redis not exposed externally
- Caddy handles TLS termination
- Auth required on all API routes (except `/api/site/leads` and `/api/health`)
- Rate limiting on all write endpoints

---

## Deploy Process

### Quick Deploy
```bash
npm run deploy                 # scripts/deploy-remote.sh
```

### Safe Deploy (recommended)
```bash
npm run ops:deploy:safe        # scripts/deploy-safe.sh
```

### What deploy does:
1. SSH into VPS
2. `git pull` latest code
3. `docker compose build app worker`
4. `docker compose up -d`
5. Wait for health check (`/api/health`)
6. Run smoke test

### Post-Deploy Verification
```bash
npm run ops:health             # Check /api/health
./scripts/smoke-test.sh        # Full smoke test
```

### Rollback
```bash
./scripts/rollback-help.sh     # Shows rollback options
# Typically: git revert + redeploy
```

---

## Backup

```bash
./backup.sh                    # Runs pg_dump, stores in backups/
```

**What's backed up:**
- PostgreSQL full dump (compressed)
- Stored in `backups/` directory

**What's NOT backed up (managed by Docker volumes):**
- Redis data (ephemeral, acceptable loss)
- .next build cache (rebuilt on deploy)

---

## Monitoring

### Health Endpoint
```bash
curl https://evenslouis.ca/api/health
```
Returns: DB ping status, env vars present, service status.

### Logs
```bash
npm run ops:logs               # scripts/watch-prod.sh
docker compose logs -f app     # Direct Docker logs
docker compose logs -f worker  # Worker logs
```

### Observability (In-App)
- `/dashboard/observability` — OpsEvents, errors, slow routes
- `/dashboard/ops-health` — System health dashboard
- `/dashboard/jobs` — Job queue monitoring
- `/dashboard/system` — Execution metrics

### Slow Query Detection
The `db` singleton logs queries over 300ms:
```
[SLOW] area=db name=Lead.findMany ms=450
```

The `withRouteTiming()` wrapper logs routes over 500ms:
```
[SLOW] area=api name=GET /api/command-center ms=1200
```

---

## Environment Variable Groups

### Dev-Only
| Var | Purpose |
|-----|---------|
| `AUTH_DEV_PASSWORD` | Bypass login in development |
| `OAUTH_SIMULATION` | Show "Simulate Google" on login |
| `PIPELINE_DRY_RUN` | Placeholder artifacts (no API calls) |
| `LEARNING_USE_MOCK_TRANSCRIPT` | Mock YouTube transcripts |

### Production-Required
| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | `postgresql://user:pass@postgres:5432/db` |
| `AUTH_SECRET` | JWT secret (openssl rand -base64 32) |
| `NEXTAUTH_URL` | `https://evenslouis.ca` |
| `ANTHROPIC_API_KEY` | Claude API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `REDIS_URL` | `redis://redis:6379` |

### Production-Optional
| Var | Purpose |
|-----|---------|
| `GOOGLE_CLIENT_ID` / `SECRET` | Google OAuth |
| `RESEND_API_KEY` | Email notifications |
| `AGENT_CRON_SECRET` | Agent cron auth |
| `META_ACCESS_TOKEN` | Meta Ads API |
| `IMAP_*` | Email ingestion |

---

## Cron Jobs

External cron (VPS crontab or external service) hits these endpoints:

| Endpoint | Schedule | Auth |
|----------|----------|------|
| `POST /api/agents/cron` | Per agent schedule | Bearer `AGENT_CRON_SECRET` |
| `POST /api/jobs/tick` | Every 1-5 minutes | Bearer or session |
| `POST /api/ops/workday-run` | Daily morning | Bearer `RESEARCH_CRON_SECRET` |
| `POST /api/meta-ads/scheduler/run-cron` | Per settings | `x-cron-key` header |
| `POST /api/notifications/run-escalations` | Every 15 minutes | Session |

### Example crontab entry:
```cron
*/5 * * * * curl -sf -X POST https://evenslouis.ca/api/jobs/tick -H "Authorization: Bearer $AGENT_CRON_SECRET"
0 8 * * * curl -sf -X POST https://evenslouis.ca/api/ops/workday-run -H "Authorization: Bearer $RESEARCH_CRON_SECRET"
```


---

# Common Tasks (Step-by-Step)

# Common Tasks — AI Rules

Step-by-step guides for tasks an AI commonly helps with in this codebase.

## Task: Add a New API Endpoint

1. Create file at `src/app/api/{namespace}/route.ts`
2. Use the standard route pattern from `coding-patterns.md`
3. Add Zod schema for mutations
4. Add `rateLimitByKey()` for write endpoints
5. Add `logOpsEventSafe()` for important mutations
6. Add `withSummaryCache()` for summary/aggregation GETs
7. Update `docs/generated/` by running `npm run docs:generate`

## Task: Add a New Database Model

1. Add model to `prisma/schema.prisma`
2. Add `@@index` for fields used in WHERE clauses
3. Add composite indexes for multi-field queries (see existing patterns)
4. Run `npx prisma db push` (NOT `prisma migrate`)
5. Run `npx prisma generate`
6. Create service functions in `src/lib/{domain}/`
7. Create API routes
8. Run `npm run docs:generate`

## Task: Add a New Brain Tool

1. Add definition to `BRAIN_TOOLS` in `src/lib/brain/tools.ts`
2. Add handler in `src/lib/brain/executor.ts` (switch case)
3. If write tool: add to `WRITE_TOOLS` set in `tools.ts`
4. If agents should use it: add to `allowedTools` in agent config (`registry.ts`)
5. Test via Brain chat panel — ask it to use the tool
6. Run `npm run docs:generate`

## Task: Add a New Agent

1. Add ID to `AgentId` type in `src/lib/agents/types.ts`
2. Add config to `AGENT_REGISTRY` in `src/lib/agents/registry.ts`
3. Create system prompt extension (what the agent should do)
4. Define `allowedTools` (minimal set needed)
5. Define `autoApprovedTools` (read tools that skip approval)
6. Define `scheduledRuns` with cron labels and task prompts
7. Test: `POST /api/agents/cron` with `{agentId: "my_agent", trigger: "manual"}`
8. Monitor at `/dashboard/operator/agents`

## Task: Add a New Dashboard Page

1. Create `src/app/dashboard/{page}/page.tsx`
2. Add `"use client";` if interactive
3. Import and use intelligence context for health bar
4. Call `setPageData()` to give Brain context about this page
5. Use existing components from `src/components/ui/`
6. Follow dark theme: `bg-neutral-900`, `text-neutral-100`
7. Add to sidebar navigation in layout

## Task: Add a New NBA Rule

1. Add rule function in `src/lib/next-actions/rules.ts`
2. It receives `NextActionContext` and pushes to output array
3. Set `createdByRule` to a unique rule key (snake_case)
4. Set `dedupeKey` for idempotent upsert
5. Call it from `produceNextActions()`
6. Add scope mapping in `scope.ts`
7. Optionally add template in `templates.ts`
8. Test: `POST /api/next-actions/run` → check `/dashboard/next-actions`

## Task: Add a New Risk Rule

1. Add rule function in `src/lib/risk/rules.ts`
2. It receives `RiskRuleContext` and returns `RiskCandidate[]`
3. Set `dedupeKey` for deduplication
4. Call it from `evaluateRiskRules()`
5. Test: `POST /api/risk/run-rules` → check `/dashboard/risk`

## Task: Add a Notification Channel

1. Create adapter in `src/lib/notifications/channels/{name}.ts`
2. Implement `ChannelAdapter` interface (send function)
3. Register in channel selection logic
4. Create `NotificationChannel` record in DB
5. Test via `/api/notification-channels/[id]/test`

## Task: Fix a Slow Page

1. Check browser console for `[SLOW]` warnings (>300ms queries)
2. Look for missing `select` clauses (overfetching)
3. Look for sequential `await` that could be `Promise.all`
4. Check if summary endpoint needs `withSummaryCache()`
5. Check `prisma/schema.prisma` for missing composite indexes
6. Reference `docs/PERFORMANCE_TRIAGE.md` for deeper optimization

## Task: Deploy to Production

1. Run `npx tsc --noEmit` — must pass
2. Run `npx playwright test` — key specs must pass
3. Run `npm run docs:generate` if models/routes changed
4. Commit changes
5. Run `./scripts/deploy-safe.sh`
6. Run `./scripts/smoke-test.sh` post-deploy
7. Check `/api/health` on production
8. Reference `docs/VPS_DEPLOY_CHECKLIST.md` for full guide

## Task: Debug a Failed Agent Run

1. Check `/dashboard/operator/agents` for recent runs
2. Look at the `AgentRun` record — check `status`, `errorMessage`, `toolCallsJson`
3. Check if it hit circuit breaker (2 consecutive failures)
4. Check if it hit token limit (50k max)
5. Check if an approval was pending but expired
6. Look at `OpsEvent` logs for the timeframe
7. Try running the agent manually: `POST /api/agents/cron` with trigger "manual"

## Task: Debug a Failed Pipeline Run

1. Check `/dashboard/leads/[id]` for the lead
2. Look at `PipelineRun` + `PipelineStepRun` records
3. Common errors:
   - `OPENAI_4XX` — OpenAI API error (rate limit, bad request)
   - `VALIDATION` — Input validation failed
   - `TIMEOUT` — Step took too long
4. Check if `PIPELINE_DRY_RUN=1` should be set (no real API calls)
5. Retry: `POST /api/pipeline/retry/[leadId]`

## Task: Understand a Dashboard Page

When reading a dashboard page, look for:
1. `useRetryableFetch()` calls — what API endpoints it fetches
2. `useIntelligenceContext()` — the health bar data source
3. `useBrainPanel().setPageData()` — what context the Brain gets
4. `useAsyncAction()` calls — what mutations it performs
5. The API routes referenced — read them for the full data flow


---

# Current State

## Roadmap
# Roadmap — Client Engine

## Current State (March 2026)

Phase 9+ complete. Full business OS operational with AI Brain, 10 agents, memory pipeline, NBA system, risk engine, scoring, notifications, growth engine, signal engine, builder integration, and 91 dashboard pages.

## Active Work

### Performance Refactor (Phase 1 — Done, pending production deploy)
- [x] Add 6 composite database indexes
- [x] Fix unbounded queries in metrics
- [x] Parallelize sequential queries (3 files)
- [x] Add select to overfetching queries
- [x] Convert dynamic imports to static
- [x] Add cache to fetchBottlenecks
- [x] Fix LIKE pattern full scan
- [x] Playwright review: all pages pass, zero console errors
- [ ] Apply indexes to production (`prisma db push` on VPS)

### Documentation System — Done
- [x] CLAUDE.md, ARCHITECTURE.md, CONTRIBUTING.md, CHANGELOG.md, ROADMAP.md
- [x] Architecture Decision Records (6 initial ADRs)
- [x] AI rules: coding-patterns, domain-knowledge, common-tasks, infrastructure
- [x] Session journal system (docs/sessions/ + docs/ai-rules/session-journal.md)
- [x] Auto-generated docs script (scripts/generate-docs.ts)
- [x] npm scripts (docs:generate, docs:check)

## Next Up

### Architecture Refactor (Phase 2)
Extract business logic from route handlers into service modules:
- [ ] Extract Brain executor CRUD into domain services (leads, proposals, delivery, proof, signals)
- [ ] Extract heavy route logic into services (promote, mark-won, complete, capture, simulate, founder-summary)
- [ ] Break brain/executor ↔ agents/runner circular dependency
- [ ] Fix coach-tools HTTP self-calls → direct service calls

### Code Quality (Phase 3)
- [ ] Create shared follow-up service (deduplicate intake/proposal/delivery patterns)
- [ ] Centralize env var access (META_AD_ACCOUNT_ID, OPENAI_API_KEY)
- [ ] Extract agent prompts from registry into separate .md files
- [ ] Standardize error types (AppError, NotFoundError, ValidationError)
- [ ] Fix type safety issues (as never, as any, 55 files with JSON casts)
- [ ] Clean up magic numbers into constants
- [ ] Consolidate cron auth pattern

### Route Consolidation (Phase 4)
- [ ] Extract delivery project route handlers into service layer (34+ routes)
- [ ] Normalize /api/internal/ vs /api/ops/ namespaces
- [ ] Merge duplicate summary endpoints

## Future Ideas (Backlog)

- Builder service scaffolding (directory doesn't exist yet)
- OAuth flows for integrations (currently placeholder)
- Per-route Zod error messages
- Artifact provenance (promptVersion, model, pipelineRunId)
- Prisma migration history (currently using db push)
- Real content post dispatch (currently stub)
- Client portal for delivery project visibility

## Completed Phases

| Phase | What | Docs |
|-------|------|------|
| 0 | Baseline + context | PROJECT_CONTEXT.md |
| 1 | Pipeline metrics | docs/PHASE1.2_INTAKE_PIPELINE.md |
| 2 | Positioning engine + follow-ups + revenue | docs/PHASE_2_*.md |
| 3 | Safety hardening (build gate, error classifier) | PROJECT_CONTEXT.md |
| 4 | Risk + NBA system | docs/PHASE_4_0_RISK_NBA.md |
| 5 | Coach mode + copilot | docs/PHASE_5_1_COACH_MODE.md |
| 6 | Founder OS + scoring + forecasting | docs/PHASE_6_1_FOUNDER_MODE.md |
| 7 | Memory pipeline V1 | docs/PHASE_7_1_MEMORY_V1.md |
| 8 | App audit + production hardening | docs/PHASE_8_0_APP_AUDIT_MATRIX.md |
| 9 | Multi-agent system + builder integration | — |


## Recent Changes
# Changelog

All notable changes to Client Engine are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

## [Unreleased]

### Added
- Documentation system: CLAUDE.md (AI entry point), ARCHITECTURE.md (system design), CONTRIBUTING.md (dev playbook), CHANGELOG.md, ROADMAP.md
- AI rules for code assistants: docs/ai-rules/ (coding-patterns, domain-knowledge, common-tasks, infrastructure, session-journal)
- 6 Architecture Decision Records in docs/decisions/ (Postgres queue, Claude vs OpenAI, db push, memory weights, approval gates, Docker VPS)
- Session journal system: docs/sessions/ with template for preserving thinking process across AI sessions
- Auto-generated docs from code: scripts/generate-docs.ts → docs/generated/ (api-routes, prisma-models, brain-tools, agents, pages, env-vars)
- npm scripts: docs:generate, docs:check (CI-friendly staleness check)
- 6 composite database indexes for NBA/risk query performance (WeeklyMetricSnapshot, NotificationDelivery, OpsReminder, Proposal, DeliveryProject, ClientInteraction)

### Changed
- Command Center data fetching: 6 serial async blocks → parallel Promise.all via computeExtendedCommandCenterData()
- Dynamic imports → static imports in fetch-data.ts (classifyRetentionBucket, classifyReminderBucket, operator-score, forecasting)
- fetchRevenueInput: now date-bounded by weekStart/weekEnd (was fetching all-time data on every request)
- fetchBottlenecks: added 30s withSummaryCache to /api/metrics/bottlenecks route
- Founder summary: nextActionRun query moved from sequential into 13-way Promise.all; added select to scoreSnapshot (was fetching full JSON blobs)
- Score computation: getFactors + getPreviousSnapshot now parallel via Promise.all

### Fixed
- Founder summary: LIKE '%pattern%' full table scan → startsWith prefix match on nextActionRun.runKey
- Score event dedup: shouldSuppressEvent overfetching full ScoreEvent row → select only createdAt

---

## [1.0.0] - 2026-03-02

### Summary
Initial documented version. Client Engine is a full-stack AI-powered business OS with:

- 75+ Prisma models, 340 API route files (~500+ HTTP endpoints), 91 dashboard pages
- AI Brain (Claude, 25 tools, SSE streaming)
- Multi-agent system (10 workers with approval gates)
- Memory pipeline (learned weights → NBA ranking feedback)
- NBA system (15 rules, delivery actions, attribution)
- Risk engine (8 rules), Score engine (0-100)
- Notification pipeline (events → deliveries → escalations)
- Growth engine (outreach templates, deals)
- Signal engine (RSS → prospect matching)
- Meta Ads monitor, YouTube ingest, Knowledge engine
- Docker Compose deployment (5 services) on Hostinger VPS


---

# Auto-Generated Inventories

## API Routes
# API Routes

> Auto-generated on 2026-03-02. 340 route files.

| Path | Methods |
|------|---------|
| `/api/agents/approvals` | GET, POST |
| `/api/agents/cron` | POST |
| `/api/agents/run` | POST |
| `/api/agents/runs` | GET |
| `/api/artifacts/[id]` | GET, PATCH |
| `/api/audit-actions` | GET |
| `/api/audit-actions/summary` | GET |
| `/api/auth/[...nextauth]` |  |
| `/api/automation-suggestions/[id]/apply` | POST |
| `/api/automation-suggestions/[id]` | PATCH |
| `/api/automation-suggestions/generate` | POST |
| `/api/automation-suggestions` | GET |
| `/api/automation-suggestions/summary` | GET |
| `/api/brain/chat` | POST |
| `/api/brief` | GET |
| `/api/build-tasks/[id]` | GET, PATCH |
| `/api/build-tasks` | GET, POST |
| `/api/build/[id]` | POST |
| `/api/capture` | POST |
| `/api/checklist/generate` | POST |
| `/api/checklist` | GET |
| `/api/command-center` | GET |
| `/api/content-assets/[id]` | PATCH |
| `/api/content-assets` | GET, POST |
| `/api/content-posts/[id]` | PATCH |
| `/api/content-posts` | GET |
| `/api/delivery-milestones/[id]` | PATCH |
| `/api/delivery-projects/[id]/activity` | POST |
| `/api/delivery-projects/[id]/builder/create` | POST |
| `/api/delivery-projects/[id]/builder/deploy` | POST |
| `/api/delivery-projects/[id]/builder/feedback` | GET |
| `/api/delivery-projects/[id]/builder/regenerate` | POST |
| `/api/delivery-projects/[id]/builder/sections` | GET, PATCH |
| `/api/delivery-projects/[id]/builder/status` | GET |
| `/api/delivery-projects/[id]/builder/support/[requestId]` | PATCH |
| `/api/delivery-projects/[id]/builder/support` | GET |
| `/api/delivery-projects/[id]/checklist/toggle` | POST |
| `/api/delivery-projects/[id]/client-confirm` | POST |
| `/api/delivery-projects/[id]/complete` | POST |
| `/api/delivery-projects/[id]/create-proof-candidate` | POST |
| `/api/delivery-projects/[id]/handoff/complete` | POST |
| `/api/delivery-projects/[id]/handoff/start` | POST |
| `/api/delivery-projects/[id]/milestones/[milestoneId]` | PATCH |
| `/api/delivery-projects/[id]/milestones` | POST |
| `/api/delivery-projects/[id]/referral/decline` | POST |
| `/api/delivery-projects/[id]/referral/receive` | POST |
| `/api/delivery-projects/[id]/referral/request` | POST |
| `/api/delivery-projects/[id]/request-proof` | POST |
| `/api/delivery-projects/[id]/retention/complete` | POST |
| `/api/delivery-projects/[id]/retention/log-call` | POST |
| `/api/delivery-projects/[id]/retention/log-email` | POST |
| `/api/delivery-projects/[id]/retention/schedule` | POST |
| `/api/delivery-projects/[id]/retention/snooze` | POST |
| `/api/delivery-projects/[id]/retention/status` | POST |
| `/api/delivery-projects/[id]/review/receive` | POST |
| `/api/delivery-projects/[id]/review/request` | POST |
| `/api/delivery-projects/[id]` | GET, PATCH |
| `/api/delivery-projects/[id]/status` | POST |
| `/api/delivery-projects/[id]/testimonial/decline` | POST |
| `/api/delivery-projects/[id]/testimonial/receive` | POST |
| `/api/delivery-projects/[id]/testimonial/request` | POST |
| `/api/delivery-projects/[id]/upsell` | POST |
| `/api/delivery-projects/gaps-summary` | GET |
| `/api/delivery-projects/handoff-queue` | GET |
| `/api/delivery-projects/handoff-summary` | GET |
| `/api/delivery-projects/handoff-weekly` | GET |
| `/api/delivery-projects/retention-gaps-summary` | GET |
| `/api/delivery-projects/retention-queue` | GET |
| `/api/delivery-projects/retention-summary` | GET |
| `/api/delivery-projects/retention-weekly` | GET |
| `/api/delivery-projects` | GET, POST |
| `/api/delivery-projects/summary` | GET |
| `/api/enrich/[id]` | POST |
| `/api/flywheel/batch` | GET, POST |
| `/api/flywheel/simulate` | POST |
| `/api/flywheel/trigger` | POST |
| `/api/followup/[leadId]` | GET, POST |
| `/api/followups` | GET |
| `/api/followups/summary` | GET |
| `/api/forecast/current` | GET |
| `/api/forecast/history` | GET |
| `/api/forecast/snapshot` | POST |
| `/api/forecast/targets` | GET |
| `/api/health` | GET |
| `/api/in-app-notifications/[id]/read` | POST |
| `/api/in-app-notifications/read-all` | POST |
| `/api/in-app-notifications` | GET |
| `/api/intake-leads/[id]/activity` | POST |
| `/api/intake-leads/[id]/delivery` | POST |
| `/api/intake-leads/[id]/draft` | POST |
| `/api/intake-leads/[id]/followup-complete` | POST |
| `/api/intake-leads/[id]/followup-log-call` | POST |
| `/api/intake-leads/[id]/followup-log-email` | POST |
| `/api/intake-leads/[id]/followup-snooze` | POST |
| `/api/intake-leads/[id]/mark-lost` | POST |
| `/api/intake-leads/[id]/mark-sent` | POST |
| `/api/intake-leads/[id]/mark-won` | POST |
| `/api/intake-leads/[id]/promote` | POST |
| `/api/intake-leads/[id]/proof-candidate` | POST |
| `/api/intake-leads/[id]/proposal` | POST |
| `/api/intake-leads/[id]` | GET, PATCH |
| `/api/intake-leads/[id]/score` | POST |
| `/api/intake-leads/[id]/set-followup` | POST |
| `/api/intake-leads/[id]/sync-pipeline` | POST |
| `/api/intake-leads/action-summary` | GET |
| `/api/intake-leads/bulk-promote` | POST |
| `/api/intake-leads/bulk-score` | POST |
| `/api/intake-leads` | GET, POST |
| `/api/intake-leads/summary` | GET |
| `/api/integrations/[provider]/disconnect` | POST |
| `/api/integrations/[provider]` | PATCH |
| `/api/integrations/[provider]/test` | POST |
| `/api/integrations/data` | GET |
| `/api/integrations/registry` | GET |
| `/api/integrations` | GET |
| `/api/integrations/usage` | GET |
| `/api/intelligence/context` | GET |
| `/api/internal/copilot/coach/action` | POST |
| `/api/internal/copilot/coach` | POST |
| `/api/internal/copilot/sessions/[id]/close` | POST |
| `/api/internal/copilot/sessions/[id]` | GET |
| `/api/internal/copilot/sessions` | GET |
| `/api/internal/delivery/context` | GET |
| `/api/internal/execution/metrics` | GET |
| `/api/internal/flywheel` | POST |
| `/api/internal/founder/os/quarter/kpis` | GET, PUT |
| `/api/internal/founder/os/quarter` | GET, PUT |
| `/api/internal/founder/os/week` | GET, PUT |
| `/api/internal/founder/os/week/suggest` | POST |
| `/api/internal/founder/summary` | GET |
| `/api/internal/growth/context` | GET |
| `/api/internal/growth/deals/[id]/events` | POST |
| `/api/internal/growth/deals/[id]/outreach/preview` | POST |
| `/api/internal/growth/deals/[id]/outreach/send` | POST |
| `/api/internal/growth/deals/[id]` | GET, PATCH |
| `/api/internal/growth/deals` | GET, POST |
| `/api/internal/growth/followups/schedule` | POST |
| `/api/internal/growth/outreach/draft` | POST |
| `/api/internal/growth/outreach/send` | POST |
| `/api/internal/growth/prospects` | GET, POST |
| `/api/internal/growth/summary` | GET |
| `/api/internal/leads/context` | GET |
| `/api/internal/memory/apply` | POST |
| `/api/internal/memory/attribution` | GET |
| `/api/internal/memory/run` | POST |
| `/api/internal/memory/summary` | GET |
| `/api/internal/ops/metrics-summary` | GET |
| `/api/internal/retention/context` | GET |
| `/api/internal/revenue/portfolio` | GET |
| `/api/internal/scores/alerts/preferences` | GET, PUT |
| `/api/internal/scores/compute` | POST |
| `/api/internal/scores/history` | GET |
| `/api/internal/scores/latest` | GET |
| `/api/internal/scores/summary` | GET |
| `/api/internal/sidebar-counts` | GET |
| `/api/internal/system/check` | GET |
| `/api/job-schedules/[id]` | GET, PATCH |
| `/api/job-schedules/[id]/run-now` | POST |
| `/api/job-schedules` | GET, POST |
| `/api/jobs/[id]/cancel` | POST |
| `/api/jobs/[id]/retry` | POST |
| `/api/jobs/[id]` | GET |
| `/api/jobs/recover-stale` | POST |
| `/api/jobs/retry-failed` | POST |
| `/api/jobs` | GET |
| `/api/jobs/run` | POST |
| `/api/jobs/summary` | GET |
| `/api/jobs/tick` | POST |
| `/api/knowledge/ingest` | POST |
| `/api/knowledge/queue` | GET, POST |
| `/api/knowledge` | GET |
| `/api/knowledge/search` | GET |
| `/api/knowledge/suggestions/[id]` | PATCH |
| `/api/leads/[id]/approve` | POST |
| `/api/leads/[id]/artifacts` | GET, POST |
| `/api/leads/[id]/client-success` | GET, POST |
| `/api/leads/[id]/copilot` | POST |
| `/api/leads/[id]/deal-outcome` | POST |
| `/api/leads/[id]/driver/ai-fill` | POST |
| `/api/leads/[id]/driver` | PATCH |
| `/api/leads/[id]/opportunity-brief` | GET |
| `/api/leads/[id]/proposal-sent` | POST |
| `/api/leads/[id]/proposal/revise` | POST |
| `/api/leads/[id]/qualification` | PATCH |
| `/api/leads/[id]/referrals` | GET, POST |
| `/api/leads/[id]/reject` | POST |
| `/api/leads/[id]/reusable-assets` | GET, POST |
| `/api/leads/[id]/roi` | GET, POST |
| `/api/leads/[id]` | GET, PATCH, DELETE |
| `/api/leads/[id]/status` | PATCH |
| `/api/leads/[id]/timeline` | GET |
| `/api/leads/[id]/touches` | GET, POST |
| `/api/leads/bulk-pipeline-run` | POST |
| `/api/leads/driver-summary` | GET |
| `/api/leads/followup-queue` | GET |
| `/api/leads` | GET, POST |
| `/api/learning/ingest` | POST |
| `/api/learning/proposal/[artifactId]` | PATCH |
| `/api/learning` | GET |
| `/api/meta-ads/actions` | GET |
| `/api/meta-ads/actions/status` | POST |
| `/api/meta-ads/asset-health` | GET |
| `/api/meta-ads/dashboard` | GET |
| `/api/meta-ads/mode` | GET |
| `/api/meta-ads/recommendations/[id]/apply` | POST |
| `/api/meta-ads/recommendations/[id]` | PATCH |
| `/api/meta-ads/recommendations/generate` | POST |
| `/api/meta-ads/recommendations` | GET |
| `/api/meta-ads/scheduler/run-cron` | POST |
| `/api/meta-ads/scheduler/run` | POST |
| `/api/meta-ads/scheduler/runs` | GET |
| `/api/meta-ads/settings` | GET, PATCH |
| `/api/metrics/bottlenecks` | GET |
| `/api/metrics/conversion` | GET |
| `/api/metrics/cycle-times` | GET |
| `/api/metrics/revenue` | GET |
| `/api/metrics/snapshot` | POST |
| `/api/metrics/snapshots` | GET |
| `/api/metrics/source-performance` | GET |
| `/api/metrics/summary` | GET |
| `/api/metrics/trends` | GET |
| `/api/networking-events` | GET, POST |
| `/api/next-actions/[id]/execute` | POST |
| `/api/next-actions/[id]` | PATCH |
| `/api/next-actions/[id]/template` | GET |
| `/api/next-actions/preferences/[id]` | GET, PATCH, DELETE |
| `/api/next-actions/preferences` | GET, POST |
| `/api/next-actions` | GET |
| `/api/next-actions/run` | POST |
| `/api/next-actions/summary` | GET |
| `/api/notification-channels/[id]` | GET, PATCH |
| `/api/notification-channels/[id]/test` | POST |
| `/api/notification-channels` | GET, POST |
| `/api/notifications/[id]/retry-failed` | POST |
| `/api/notifications/dispatch` | POST |
| `/api/notifications` | GET |
| `/api/notifications/run-escalations` | POST |
| `/api/notifications/summary` | GET |
| `/api/operator-score/current` | GET |
| `/api/operator-score/history` | GET |
| `/api/operator-score/snapshot` | POST |
| `/api/ops-events/page-view` | POST |
| `/api/ops-events` | GET |
| `/api/ops-events/slow` | GET |
| `/api/ops-events/summary` | GET |
| `/api/ops-events/trends` | GET |
| `/api/ops/brief` | GET, POST |
| `/api/ops/chat/execute` | POST |
| `/api/ops/chat` | POST |
| `/api/ops/command` | GET |
| `/api/ops/feedback` | GET, POST |
| `/api/ops/monetization` | GET, PATCH |
| `/api/ops/orphan-check` | GET |
| `/api/ops/planning-themes` | GET, POST |
| `/api/ops/scoreboard` | GET |
| `/api/ops/settings/recommend` | POST |
| `/api/ops/settings` | GET, POST |
| `/api/ops/strategy-week/ai-fill` | POST |
| `/api/ops/strategy-week/history` | GET |
| `/api/ops/strategy-week/priorities/[id]` | PATCH, DELETE |
| `/api/ops/strategy-week/priorities` | POST |
| `/api/ops/strategy-week/review` | PATCH |
| `/api/ops/strategy-week` | GET, POST |
| `/api/ops/weekly-snapshot` | POST |
| `/api/ops/workday-run` | POST |
| `/api/owned-audience` | GET, POST |
| `/api/pipeline/retry/[leadId]` | POST |
| `/api/pipeline/run/[leadId]` | POST |
| `/api/pipeline/run` | POST |
| `/api/portfolio/[id]` | POST |
| `/api/position/[id]` | POST |
| `/api/projects/[id]` | GET, PATCH |
| `/api/projects/github` | POST |
| `/api/proof-assets` | GET, POST |
| `/api/proof-candidates/[id]/mark-ready` | POST |
| `/api/proof-candidates/[id]/promote` | POST |
| `/api/proof-candidates/[id]/reject` | POST |
| `/api/proof-candidates/[id]` | GET, PATCH |
| `/api/proof-candidates` | GET, POST |
| `/api/proof-candidates/summary` | GET |
| `/api/proof-gaps/summary` | GET |
| `/api/proof-records/[id]` | PATCH |
| `/api/proof-records` | GET |
| `/api/proof/generate` | POST |
| `/api/proof/lead-options` | GET |
| `/api/proof` | GET |
| `/api/proposals/[id]/accept` | POST |
| `/api/proposals/[id]/duplicate` | POST |
| `/api/proposals/[id]/followup-complete` | POST |
| `/api/proposals/[id]/followup-log-call` | POST |
| `/api/proposals/[id]/followup-log-email` | POST |
| `/api/proposals/[id]/followup-schedule` | POST |
| `/api/proposals/[id]/followup-snooze` | POST |
| `/api/proposals/[id]/mark-ready` | POST |
| `/api/proposals/[id]/mark-sent` | POST |
| `/api/proposals/[id]/mark-viewed` | POST |
| `/api/proposals/[id]/reject` | POST |
| `/api/proposals/[id]/response` | POST |
| `/api/proposals/[id]` | GET, PATCH |
| `/api/proposals/[id]/snapshot` | POST |
| `/api/proposals/action-summary` | GET |
| `/api/proposals/followup-summary` | GET |
| `/api/proposals/followups` | GET |
| `/api/proposals/gaps-summary` | GET |
| `/api/proposals` | GET, POST |
| `/api/proposals/summary` | GET |
| `/api/propose/[id]` | POST |
| `/api/prospect/ai` | POST |
| `/api/prospect` | POST |
| `/api/referrals/[referralId]` | PATCH |
| `/api/reminders/[id]/complete` | POST |
| `/api/reminders/[id]` | PATCH |
| `/api/reminders` | GET, POST |
| `/api/reminders/run-rules` | POST |
| `/api/reminders/summary` | GET |
| `/api/research/run` | POST |
| `/api/research/web` | POST |
| `/api/research/web/save-to` | POST |
| `/api/results-ledger` | GET |
| `/api/risk/[id]` | PATCH |
| `/api/risk` | GET |
| `/api/risk/run-rules` | POST |
| `/api/risk/summary` | GET |
| `/api/score/[id]` | POST |
| `/api/search` | GET |
| `/api/signals/items/[id]` | PATCH |
| `/api/signals/items` | GET |
| `/api/signals/sources/[id]` | PATCH, DELETE |
| `/api/signals/sources/[id]/sync` | POST |
| `/api/signals/sources` | GET, POST |
| `/api/site/leads` | POST |
| `/api/youtube/ingest/channel` | POST |
| `/api/youtube/ingest/playlist` | POST |
| `/api/youtube/ingest/video` | POST |
| `/api/youtube/jobs` | GET |
| `/api/youtube/learning/[id]/promote` | POST |
| `/api/youtube/learning/[id]/reject` | POST |
| `/api/youtube/learning` | GET |
| `/api/youtube/transcripts/[id]` | DELETE |
| `/api/youtube/transcripts` | GET |


## Database Models
# Prisma Models

> Auto-generated on 2026-03-02. 93 models, 58 enums.

## Models

| Model | Fields |
|-------|--------|
| User | 5 |
| Lead | 17 |
| Artifact | 8 |
| Project | 15 |
| PipelineRun | 12 |
| PipelineStepRun | 11 |
| LeadTouch | 12 |
| LeadReferral | 11 |
| ContentAsset | 16 |
| LeadAttribution | 8 |
| OwnedAudienceLedger | 9 |
| NetworkingEvent | 11 |
| ProofAsset | 8 |
| BuildTask | 15 |
| ReusableAssetLog | 13 |
| OperatorActionRun | 3 |
| YouTubeSource | 13 |
| YouTubeIngestJob | 12 |
| YouTubeTranscript | 19 |
| LearningProposal | 16 |
| MetaAdsRecommendation | 12 |
| MetaAdsActionLog | 8 |
| MetaAdsAutomationSettings | 32 |
| MetaAdsSchedulerRunLog | 8 |
| PlanningTheme | 7 |
| StrategyWeek | 33 |
| StrategyWeekReview | 18 |
| StrategyWeekTarget | 13 |
| StrategyWeekPriority | 10 |
| StrategyWeekRisk | 11 |
| StrategyWeekRecruitingTarget | 11 |
| InternalSetting | 3 |
| ScoreSnapshot | 10 |
| ScoreEvent | 12 |
| IntegrationConnection | 12 |
| IntegrationRun | 8 |
| ApiUsageLog | 13 |
| SignalSource | 12 |
| SignalItem | 12 |
| SignalSyncLog | 8 |
| IntakeLead | 41 |
| LeadActivity | 7 |
| ProofRecord | 18 |
| ProofCandidate | 29 |
| Proposal | 46 |
| ProposalVersion | 7 |
| ProposalActivity | 7 |
| DeliveryProject | 66 |
| DeliveryMilestone | 11 |
| DeliveryChecklistItem | 11 |
| DeliveryActivity | 7 |
| WeeklyMetricSnapshot | 9 |
| OperatorScoreSnapshot | 7 |
| ForecastSnapshot | 9 |
| OpsReminder | 18 |
| AutomationSuggestion | 13 |
| OpsEvent | 20 |
| AuditAction | 13 |
| JobRun | 30 |
| JobSchedule | 23 |
| JobLog | 7 |
| NotificationChannel | 16 |
| NotificationEvent | 21 |
| NotificationDelivery | 20 |
| InAppNotification | 10 |
| EscalationRule | 13 |
| RiskFlag | 18 |
| NextBestAction | 26 |
| NextActionExecution | 10 |
| NextActionRun | 5 |
| CopilotSession | 9 |
| CopilotMessage | 5 |
| CopilotActionLog | 8 |
| NextActionPreference | 10 |
| OperatorAttribution | 9 |
| OperatorMemoryEvent | 10 |
| OperatorLearnedWeight | 6 |
| Prospect | 13 |
| Deal | 16 |
| OutreachEvent | 8 |
| FollowUpSchedule | 8 |
| OutreachMessage | 9 |
| DealEvent | 6 |
| FounderQuarter | 9 |
| FounderKPI | 9 |
| FounderWeek | 10 |
| FounderWeekPlan | 6 |
| FounderWeekReview | 8 |
| AgentRun | 9 |
| AgentApproval | 11 |
| FlywheelRun | 11 |
| ClientInteraction | 27 |
| ContentPost | 13 |

## Enums

- `LeadStatus`
- `LeadSourceType`
- `ProspectingChannel`
- `TouchType`
- `IntegrationMode`
- `IntakeLeadSource`
- `IntakeLeadUrgency`
- `IntakeLeadStatus`
- `LeadActivityType`
- `ProofCandidateStatus`
- `ProofCandidateTriggerType`
- `ProofCandidateSourceType`
- `ProposalStatus`
- `ProposalPriceType`
- `ProposalActivityType`
- `ProposalResponseStatus`
- `DeliveryProjectStatus`
- `DeliveryMilestoneStatus`
- `DeliveryChecklistCategory`
- `DeliveryActivityType`
- `TestimonialStatus`
- `ReferralStatus`
- `RetentionStatus`
- `PostDeliveryHealth`
- `OpsEventLevel`
- `OpsEventCategory`
- `OpsEventStatus`
- `JobRunStatus`
- `JobLogLevel`
- `JobScheduleCadenceType`
- `NotificationChannelType`
- `NotificationSeverity`
- `NotificationEventStatus`
- `NotificationDeliveryStatus`
- `RiskSeverity`
- `RiskStatus`
- `RiskSourceType`
- `NextActionPriority`
- `NextActionStatus`
- `OperatorMemorySourceType`
- `OperatorMemoryOutcome`
- `OperatorAttributionSourceType`
- `OperatorLearnedWeightKind`
- `ProspectPlatform`
- `DealStage`
- `DealPriority`
- `OutreachChannel`
- `OutreachEventType`
- `FollowUpScheduleStatus`
- `OutreachStatus`
- `DealEventType`
- `AgentRunStatus`
- `AgentRunTrigger`
- `ApprovalStatus`
- `InteractionChannel`
- `InteractionDirection`
- `ContentPostPlatform`
- `ContentPostStatus`


## Brain Tools
# Brain Tools

> Auto-generated on 2026-03-02. 25 tools (12 write).

## All Tools

| Tool | Type | Description |
|------|------|-------------|
| `get_business_snapshot` | read | Get the current operator score (health band), open risk flags by severity, and queued next best actions. Call this first |
| `get_executive_brief` | read | Get the executive brief: money scorecard, stage conversion, pipeline leak, revenue forecast, primary constraint, constra |
| `get_pipeline` | read | Get current pipeline: qualified leads, ready proposals, next actions, risk flags, and recent wins. |
| `get_growth_summary` | read | Get growth pipeline summary: deals by stage, overdue follow-ups, upcoming follow-ups, last activity timestamp. Requires  |
| `search_knowledge` | read | Search the knowledge base (including YouTube transcript insights, learning proposals, and artifacts) using semantic sear |
| `get_memory_patterns` | read | Get the operator's learned preferences and patterns: top rule weights (what they value), trend diffs (what's changing we |
| `run_risk_rules` | write | Evaluate all risk rules and upsert risk flags. Use this when the operator asks to check for risks or when risk data seem |
| `run_next_actions` | write | Regenerate next best actions from rules. Use when actions seem stale or the operator asks for fresh recommendations. |
| `recompute_score` | write | Refresh the operator score snapshot. Use when score seems stale or after running risk rules / next actions. |
| `execute_nba` | write | Execute a specific next best action by its ID. Available action keys: mark_done, snooze_1d, dismiss, don_t_suggest_again |
| `draft_outreach` | write | Draft an outreach message using a template. Returns the rendered message text. |
| `get_ops_health` | read | Get system health: failed jobs (24h/7d), pipeline run status, stale entities, and overall system status. |
| `list_leads` | read | List leads with optional filters. Returns id, title, status, source, contactName, contactEmail, score, createdAt. Status |
| `update_lead` | write | Update a lead's status, notes, or score. Provide the lead ID and the fields to change. |
| `list_proposals` | read | List proposals with optional filters. Returns id, title, clientName, status, priceMin, priceMax, createdAt. Status value |
| `update_proposal` | write | Update a proposal's status, pricing, or notes. Provide the proposal ID and fields to change. |
| `list_delivery_projects` | read | List delivery projects with optional filters. Returns id, title, clientName, status, dueDate, completedAt. Status values |
| `update_delivery_project` | write | Update a delivery project's status, notes, or dates. |
| `manage_deal` | write | Update a growth deal's stage, priority, or schedule follow-up. Stage values: new, contacted, replied, call_scheduled, pr |
| `send_operator_alert` | write | Send a notification alert to the operator. Use for important updates, warnings, or action items that need attention. |
| `list_proof_records` | read | List proof records with optional filters. Returns id, title, company, outcome, metricValue, metricLabel, createdAt, and  |
| `schedule_content_post` | write | Generate and optionally schedule a content post from a proof record. Creates a draft post for the given platform. If sch |
| `list_signals` | read | List signal items with optional filters. Returns id, title, score, tags, sourceUrl, status, createdAt. Use to find oppor |
| `match_signal_opportunities` | read | Match a signal item to existing prospects/deals by niche, platform, and keywords. Returns ranked matches with relevance  |
| `delegate_to_agent` | write | Delegate a complex task to a specialized worker. Workers: commander (orchestration/self-healing), signal_scout (RSS/oppo |

## Write Tools (require approval in agent mode)

- `run_risk_rules`
- `run_next_actions`
- `recompute_score`
- `execute_nba`
- `draft_outreach`
- `update_lead`
- `update_proposal`
- `update_delivery_project`
- `manage_deal`
- `send_operator_alert`
- `schedule_content_post`
- `delegate_to_agent`


## Agents
# Agent Registry

> Auto-generated on 2026-03-02. 10 agents.

| ID | Name |
|----|------|
| `commander` | Commander |
| `signal_scout` | Signal Scout |
| `outreach_writer` | Outreach Writer |
| `distribution_ops` | Distribution Ops |
| `conversion_analyst` | Conversion Analyst |
| `followup_enforcer` | Follow-up Enforcer |
| `proposal_architect` | Proposal Architect |
| `scope_risk_ctrl` | Scope & Risk Controller |
| `proof_producer` | Proof Producer |
| `qa_sentinel` | QA Sentinel |


## Dashboard Pages
# Dashboard Pages

> Auto-generated on 2026-03-02. 83 pages.

- `/dashboard/audit`
- `/dashboard/automation`
- `/dashboard/build-ops`
- `/dashboard/chat`
- `/dashboard/checklist`
- `/dashboard/command`
- `/dashboard/content-assets`
- `/dashboard/content-posts`
- `/dashboard/conversion`
- `/dashboard/copilot/coach`
- `/dashboard/copilot`
- `/dashboard/copilot/sessions`
- `/dashboard/delivery/[id]`
- `/dashboard/delivery/new`
- `/dashboard/delivery`
- `/dashboard/deploys`
- `/dashboard/flywheel`
- `/dashboard/followups`
- `/dashboard/forecast`
- `/dashboard/founder/os`
- `/dashboard/founder/os/quarter`
- `/dashboard/founder/os/week`
- `/dashboard/founder`
- `/dashboard/grow`
- `/dashboard/growth/deals/[id]`
- `/dashboard/growth`
- `/dashboard/handoffs`
- `/dashboard/inbox`
- `/dashboard/intake/[id]`
- `/dashboard/intake`
- `/dashboard/intelligence`
- `/dashboard/intelligence/trends`
- `/dashboard/internal/qa/next-actions`
- `/dashboard/internal/qa/notifications`
- `/dashboard/internal/qa/prod-readiness`
- `/dashboard/internal/qa/risk`
- `/dashboard/internal/qa/scores`
- `/dashboard/internal/scoreboard`
- `/dashboard/internal/scores/alerts`
- `/dashboard/job-schedules`
- `/dashboard/jobs/[id]`
- `/dashboard/jobs`
- `/dashboard/knowledge`
- `/dashboard/leads/[id]`
- `/dashboard/leads/new`
- `/dashboard/leads`
- `/dashboard/learning`
- `/dashboard/meta-ads/health`
- `/dashboard/meta-ads`
- `/dashboard/metrics`
- `/dashboard/next-actions`
- `/dashboard/notification-channels`
- `/dashboard/notifications`
- `/dashboard/observability`
- `/dashboard/operator/agents`
- `/dashboard/operator`
- `/dashboard/ops-health`
- `/dashboard/overview`
- `/dashboard`
- `/dashboard/planning`
- `/dashboard/proof-candidates/[id]`
- `/dashboard/proof-candidates`
- `/dashboard/proof`
- `/dashboard/proposal-followups`
- `/dashboard/proposals/[id]`
- `/dashboard/proposals/new`
- `/dashboard/proposals`
- `/dashboard/prospect`
- `/dashboard/reminders`
- `/dashboard/results`
- `/dashboard/retention`
- `/dashboard/reviews`
- `/dashboard/risk`
- `/dashboard/sales-leak`
- `/dashboard/sales`
- `/dashboard/scoreboard`
- `/dashboard/settings`
- `/dashboard/signals`
- `/dashboard/strategy`
- `/dashboard/system`
- `/dashboard/team`
- `/dashboard/youtube`
- `/dashboard/youtube/transcripts`


## Environment Variables
# Environment Variables

> Auto-generated from .env.example on 2026-03-02. 19 variables.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Database (required for app + prisma) |
| `DB_PASSWORD` | — |
| `ADMIN_EMAIL` | Admin sign-in (used by prisma/seed.mjs — set these then run seed) |
| `ADMIN_PASSWORD` | — |
| `OPENAI_API_KEY` | OpenAI (required for enrich / score / position / propose / build) |
| `AUTH_SECRET` | Auth (required for login/session; NextAuth) |
| `NEXTAUTH_URL` | Production: must match your public URL (stops redirect loops) |
| `PIPELINE_DRY_RUN` | For real lead scores, set to 0 and ensure OPENAI_API_KEY is set. |
| `RESEARCH_CRON_SECRET` | E2E + local: use this so Bearer auth tests run. Prod: set a strong random secret. |
| `IMAP_HOST` | Email ingestion (worker) — Hostinger IMAP; set IMAP_USER and IMAP_PASS to connect inbox |
| `IMAP_PORT` | — |
| `IMAP_USER` | — |
| `IMAP_PASS` | — |
| `NOTIFY_EMAIL` | Website form → email notification. Use either Resend API or SMTP (Hostinger outgoing). NOTIFY_EMAIL is where you receive the notification. |
| `SMTP_HOST` | Option B: SMTP (internal, e.g. Hostinger) — same mailbox as IMAP for send |
| `SMTP_PORT` | — |
| `SMTP_USER` | — |
| `SMTP_PASS` | — |
| `REDIS_URL` | Queue (worker + app). Dev: redis://localhost:6379. Prod Docker: redis://redis:6379 |


---

# Latest Session Journal

# Session: Full Codebase Audit + Documentation System — 2026-03-02

## Goal
Review the entire codebase, identify refactoring opportunities, apply performance fixes, Playwright-test all pages, and create a complete documentation system.

## Decisions Made
- **Documentation structure:** CLAUDE.md (AI entry) + ARCHITECTURE.md + CONTRIBUTING.md + ADRs + auto-generated docs + AI rules files + session journals
- **Performance first:** Applied Phase 1 quick wins before architecture refactoring (higher impact, lower risk)
- **Keep existing docs:** 82 existing docs in `docs/` kept as-is; new system links to them rather than replacing
- **Auto-update approach:** Script scans source code (routes, schema, tools, agents, pages, env) → generates markdown files in `docs/generated/`
- **Session journal system:** After each AI work session, summarize decisions + changes → `docs/sessions/`

## What Was Built

### Performance Fixes (Phase 1)
- **`prisma/schema.prisma`** — Added 6 composite indexes (WeeklyMetricSnapshot, NotificationDelivery, OpsReminder, Proposal, DeliveryProject, ClientInteraction)
- **`src/lib/metrics/fetch-metrics.ts`** — Date-bounded fetchRevenueInput (was fetching all-time data regardless of range)
- **`src/lib/scoring/compute-and-store.ts`** — Parallelized getFactors + getPreviousSnapshot; added select to shouldSuppressEvent
- **`src/app/api/internal/founder/summary/route.ts`** — Moved nextActionRun query into Promise.all; added select to scoreSnapshot; changed LIKE '%pattern%' to startsWith
- **`src/lib/command-center/fetch-data.ts`** — Extracted 6 serial async blocks into parallel computeExtendedCommandCenterData(); converted 3 dynamic imports to static
- **`src/app/api/metrics/bottlenecks/route.ts`** — Added withSummaryCache (30s TTL)

### Documentation System (19 new files)
- **Root docs (5):** CLAUDE.md, ARCHITECTURE.md, CONTRIBUTING.md, CHANGELOG.md, ROADMAP.md
- **AI rules (5):** coding-patterns.md, domain-knowledge.md, common-tasks.md, infrastructure.md, session-journal.md
- **ADRs (6):** Postgres queue, Claude vs OpenAI, db push, memory weights, approval gates, Docker VPS
- **Auto-gen script:** scripts/generate-docs.ts → 6 files in docs/generated/ (api-routes, prisma-models, brain-tools, agents, pages, env-vars)
- **Session journal (1):** This file (docs/sessions/2026-03-02-codebase-audit-and-docs.md)
- **npm scripts:** docs:generate, docs:check
- **Directories created:** docs/decisions/, docs/generated/, docs/sessions/, docs/ai-rules/

### Playwright Review
Tested all key pages in dev — zero console errors:
- Public site, login, founder/home, leads (82 leads), proposals, delivery, delivery detail, risk, next-actions, follow-ups, intake, command center (30+ cards)

## Key Insights
- Command Center is the heaviest page (58 slow query warnings) — the 6 serial async blocks in fetchCommandCenterData were a major bottleneck, now parallelized
- fetchRevenueInput was fetching EVERY accepted proposal and EVERY completed delivery project regardless of date range — a full table scan on every metrics request
- The founder summary route had a sequential nextActionRun query AFTER a 12-way Promise.all — adding it to the Promise.all saves one full round-trip
- The LIKE '%pattern%' on nextActionRun.runKey couldn't use the btree index — switching to startsWith enables prefix matching

## Trade-offs Accepted
- Phase 2-5 refactoring (service extraction, code quality, route consolidation) deferred to future sessions
- AI rules files are opinionated — they encode current patterns, may need updating as architecture evolves
- Generated docs include date stamps — will show as "stale" if not regenerated regularly (by design, to encourage running the script)

## Open Questions
- Should the builder service directory be scaffolded? (Currently only proxy routes exist)
- Should CLAUDE.md be copied to `.cursor/rules` for Cursor compatibility?
- Should session journals be git-committed or gitignored?

## Next Steps
- [ ] Apply composite indexes to production (`prisma db push` on VPS)
- [ ] Phase 2: Extract Brain executor CRUD into domain services
- [ ] Phase 3: Create shared follow-up service
- [ ] Consider adding pre-push hook for `docs:check`


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
- Never use `any` — use proper types
- Always parallelize independent Prisma queries with Promise.all
