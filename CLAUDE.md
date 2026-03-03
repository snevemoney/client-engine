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
npm run docs:context:copy                            # Generate AI context + copy to clipboard (for ChatGPT/Gemini)
docker compose up -d                                 # Production
```

## AI Rules (Read Before Writing Code)

- [docs/ai-rules/coding-patterns.md](docs/ai-rules/coding-patterns.md) — Route templates, query patterns, component patterns, naming, imports, things to never do
- [docs/ai-rules/domain-knowledge.md](docs/ai-rules/domain-knowledge.md) — Business model, niche, money path, scoring, NBA, agent safety, vocabulary
- [docs/ai-rules/common-tasks.md](docs/ai-rules/common-tasks.md) — Step-by-step for adding routes, models, tools, agents, pages, rules
- [docs/ai-rules/infrastructure.md](docs/ai-rules/infrastructure.md) — Dev/prod environments, Docker, VPS, domains, networking, deploy, monitoring, cron
- [docs/ai-rules/session-journal.md](docs/ai-rules/session-journal.md) — After each session, summarize decisions + update docs (say "journal this session")
- [docs/ai-rules/chatgpt-instructions.md](docs/ai-rules/chatgpt-instructions.md) — Custom instructions for ChatGPT app (paste into Settings → Personalization)

## Using Other AI Tools (ChatGPT, Gemini, etc.)

```bash
npm run docs:context:copy    # Generates 68KB context file + copies to clipboard
```
Paste into ChatGPT as first message. ChatGPT auto-produces session summaries. Paste them back into `docs/sessions/`. See [chatgpt-instructions.md](docs/ai-rules/chatgpt-instructions.md) for full setup.

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
