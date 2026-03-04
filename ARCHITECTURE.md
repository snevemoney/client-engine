# Architecture — Client Engine

## System Overview

```
                    ┌─────────────────────────────────┐
                    │         Public Website           │
                    │   evenslouis.ca (Next.js SSR)    │
                    │   Contact form → /api/site/leads │
                    └──────────────┬──────────────────┘
                                   │
                    ┌──────────────▼──────────────────┐
                    │       Lead Capture Layer         │
                    │  Site form / Email IMAP / RSS    │
                    │  Upwork / Manual / Flywheel      │
                    └──────────────┬──────────────────┘
                                   │
              ┌────────────────────▼────────────────────┐
              │          AI Pipeline Orchestrator        │
              │  src/lib/pipeline/orchestrator.ts        │
              │  Advisory lock per lead (idempotent)     │
              │                                         │
              │  ENRICH → SCORE → POSITION → PROPOSE    │
              │  (OpenAI GPT-4o-mini for each step)     │
              └────────────────────┬────────────────────┘
                                   │
              ┌────────────────────▼────────────────────┐
              │         [HUMAN APPROVAL GATE]            │
              │  Operator reviews proposal, approves     │
              └────────────────────┬────────────────────┘
                                   │
              ┌────────────────────▼────────────────────┐
              │          Delivery + Proof                │
              │  Build → Handoff → Retention             │
              │  Proof → Content Distribution            │
              └─────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │                    AI Brain (Claude)                         │
  │  SSE streaming chat • 25 tools • Max 10 iterations          │
  │  Accessible from every dashboard page via slide-over panel  │
  │                                                             │
  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
  │  │ 10 Agents   │  │ Memory Loop  │  │ NBA System        │  │
  │  │ (cron)      │→ │ (weights)    │→ │ (15 rules)        │  │
  │  │ Approval    │  │ [-10, +10]   │  │ Ranked scoring    │  │
  │  │ gates       │  │ Attribution  │  │ Delivery actions  │  │
  │  └─────────────┘  └──────────────┘  └───────────────────┘  │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │                    Supporting Systems                        │
  │  Risk Engine (8 rules) • Score Engine (0-100)               │
  │  Notification Pipeline • Job Queue • Signal Engine          │
  │  Growth Engine • Meta Ads Monitor • YouTube Ingest          │
  └─────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Lead Lifecycle

### 1. Capture
Sources: website contact form (`/api/site/leads`), IMAP email ingestion (Upwork jobs), RSS signals (`src/lib/signals/`), manual entry, flywheel automation.

Leads enter as `IntakeLead` (CRM layer) or `Lead` (pipeline). IntakeLeads are scored, then promoted to pipeline Leads.

### 2. Pipeline (AI Processing)
Entry: `runPipelineIfEligible(leadId, trigger)` in `src/lib/pipeline/orchestrator.ts`.

| Step | What it does | Output |
|------|-------------|--------|
| Enrich | Web research + AI summary | Artifact type `notes` |
| Score | Weighted factor scoring (0-100) | Artifact type `score` |
| Position | Felt problem, language map, blue-ocean angle | Artifact type `positioning` |
| Propose | Scope, pricing, CTA, timeline | `Proposal` record |

Each step creates an `Artifact` on the `Lead`. Advisory lock per lead prevents concurrent runs.

### 3. Approval (Human Gate)
Operator reviews proposal at `/dashboard/proposals/[id]`. Can send, revise (AI), accept, or reject.

Acceptance creates a `DeliveryProject` linked to the proposal.

### 4. Delivery
Full lifecycle tracked in `DeliveryProject` (80+ fields):
- Milestones (`DeliveryMilestone`) with completion tracking
- Checklist (`DeliveryChecklistItem`) with toggle
- Builder integration (iframe preview, section editing, support requests)
- Handoff flow: start → complete → client confirm
- Activity log (`DeliveryActivity`)

### 5. Post-Delivery
- **Retention:** follow-up schedule, upsell/retainer tracking
- **Testimonial/Review/Referral:** request → receive → decline tracking
- **Proof:** `ProofCandidate` (draft → ready → promoted to `ProofRecord`)
- **Content distribution:** `ContentPost` (LinkedIn/Twitter/email)

---

## AI Architecture

### Brain (`src/lib/brain/`)

| File | Purpose |
|------|---------|
| `engine.ts` | Non-streaming tool loop (`runBrain`), max 10 iterations |
| `stream.ts` | SSE streaming loop (`streamBrainWithTools`), yields text_delta/tool_start/tool_result/done events |
| `tools.ts` | 25 tool definitions (`BRAIN_TOOLS`) + `WRITE_TOOLS` set (12 tools requiring approval) |
| `executor.ts` | `executeTool(name, input, ctx)` — dispatches to domain logic. `ToolContext = {userId, baseUrl, cookie?, entityType, entityId}` |
| `system-prompt.ts` | `buildSystemPrompt()` — PBD/BizDoc personality + niche context + tool categories |

**Tool categories:**
- Read (14): `get_business_snapshot`, `get_executive_brief`, `get_pipeline`, `get_growth_summary`, `search_knowledge`, `get_memory_patterns`, `run_risk_rules`, `run_next_actions`, `get_ops_health`, `list_leads`, `list_proposals`, `list_delivery_projects`, `list_proof_records`, `list_signals`
- Write (12): `update_lead`, `update_proposal`, `update_delivery_project`, `manage_deal`, `execute_nba`, `draft_outreach`, `send_operator_alert`, `schedule_content_post`, `recompute_score`, `delegate_to_agent`, `match_signal_opportunities`, `run_risk_rules`

### Agents (`src/lib/agents/`)

| File | Purpose |
|------|---------|
| `types.ts` | `AgentId` union (10 IDs), `AgentConfig`, `AGENT_LIMITS` (50k tokens, 15 calls, 2 concurrent, 24h approval, 15min stale) |
| `registry.ts` | 10 agent configs with system prompt extensions and tool allowlists |
| `runner.ts` | `runAgent()` — creates AgentRun, checks concurrency/dedup, builds combined system prompt, filters tools, approval gate per write tool, circuit breaker, memory ingest on completion |
| `approval.ts` | `requiresApproval()`, `createApprovalRequest()`, `processApproval()`, `expireStaleApprovals()`, `reapStaleRuns()` |
| `scheduler.ts` | Cron label → hourly window mapping, `buildDedupeKey()`, `shouldRunAtHour()` |

**Agent registry:**

| Agent | Schedule | Key Tools |
|-------|----------|-----------|
| commander | every_6h | Full read suite + delegate |
| signal_scout | daily_morning | list_signals, match_signal_opportunities |
| outreach_writer | daily_morning | draft_outreach, manage_deal |
| distribution_ops | daily_morning | schedule_content_post, list_proof_records |
| conversion_analyst | weekly_monday | get_executive_brief, run_risk_rules |
| followup_enforcer | daily_morning + daily_midday | run_next_actions, execute_nba |
| proposal_architect | daily_morning | list_proposals, update_proposal |
| scope_risk_ctrl | daily_morning | run_risk_rules, send_operator_alert |
| proof_producer | weekly_monday | list_proof_records, list_delivery_projects |
| qa_sentinel | every_6h | get_ops_health, run_risk_rules |

### Memory Pipeline (`src/lib/memory/`)

| File | Purpose |
|------|---------|
| `ingest.ts` | Weight deltas from NBA execute/dismiss/snooze, copilot actions, founder review |
| `weights.ts` | `loadLearnedWeights(userId)` → `{ruleWeights, actionWeights}` maps |
| `policy.ts` | 7d window stats → trend diffs → policy suggestions → pattern alerts |
| `attribution.ts` | Before/after snapshots → delta → outcome (improved/neutral/worsened) |
| `effectiveness.ts` | netLiftScore per ruleKey (+2 to -2) |
| `agent-ingest.ts` | Agent run/rejection → weight adjustments |
| `brain-ingest.ts` | Brain write-tool calls → OperatorMemoryEvent |
| `growth-ingest.ts` | Outreach/stage changes → memory events |

**Feedback loop:** Every action → weight delta → clamped [-10, +10] → fed into NBA ranking formula as `learnedBoost = ruleWeight × 2 + actionWeight × 1`. Hard penalty if `ruleWeight ≤ -3`.

### NBA System (`src/lib/next-actions/`)

| File | Purpose |
|------|---------|
| `rules.ts` | 15 rule emitters via `produceNextActions(ctx, scopeFilter, weights, effectiveness)` |
| `ranking.ts` | Score formula: `base + countBoost + recencyBoost + urgencyBoost + impactBoost - frictionPenalty - dedupePenalty + learnedBoost + revenueBoost` |
| `delivery-actions.ts` | 11 delivery actions with idempotency (60s window) + attribution |
| `fetch-context.ts` | 14 parallel Prisma queries to build `NextActionContext` |
| `preferences.ts` | Per-entity suppression rules (7d/30d snooze) |
| `templates.ts` | 9 action templates with checklist/why/outcome |
| `service.ts` | upsert, complete, dismiss, snooze, recordRun |

---

## Database (75+ Models)

### Core Business
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| Lead | status, score, salesStage, driverType, dealOutcome, 50+ fields | Pipeline lead |
| IntakeLead | score, source, promotedLeadId, followUpDueAt | CRM intake |
| Artifact | leadId, type, title, content, meta | Lead artifacts (notes, score, positioning, proposal) |
| Proposal | status, priceMin/Max, finalValue, nextFollowUpAt | Proposal lifecycle |
| ProposalVersion | proposalId, version, content | Version history |
| DeliveryProject | 80+ fields, status, milestones, handoff, retention, builder | Full delivery |
| DeliveryMilestone | deliveryProjectId, status, completedAt | Milestone tracking |
| DeliveryChecklistItem | deliveryProjectId, category, isDone | Checklist |

### Growth & Outreach
| Model | Purpose |
|-------|---------|
| Prospect | Growth prospects |
| Deal | Deal lifecycle with stage, priority, value |
| OutreachMessage | Outreach message history |
| DealEvent | Deal event log (calls, payments, status changes) |
| ContentPost | Distribution posts (twitter/linkedin/email) |

### Intelligence
| Model | Purpose |
|-------|---------|
| NextBestAction | Ranked recommendations (priority, score, dedupeKey) |
| RiskFlag | Risk flags (severity, dedupeKey, status) |
| ScoreSnapshot | Health score history (score, band, factorsJson, reasonsJson) |
| ScoreEvent | Threshold breaches, sharp drops, recoveries |
| OperatorLearnedWeight | Per-rule/action weight adjustments |
| OperatorMemoryEvent | Memory ingest events |
| OperatorAttribution | Before/after attribution snapshots |

### Agents & Jobs
| Model | Purpose |
|-------|---------|
| AgentRun | Agent execution (status, tokens, toolCalls, result) |
| AgentApproval | Write-tool approval gates |
| JobRun | Postgres-backed job queue |
| JobSchedule | Cron job schedules |
| CopilotSession / CopilotMessage | Brain chat persistence |

### Notifications
| Model | Purpose |
|-------|---------|
| NotificationEvent | Events (1h dedupe) |
| NotificationDelivery | Per-channel delivery (3 attempts, exponential backoff) |
| NotificationChannel | Channel configs (in-app, email, webhook) |
| InAppNotification | In-app notifications |
| EscalationRule | Automated escalation triggers |

### Other
| Model | Purpose |
|-------|---------|
| ClientInteraction | Cross-entity interaction ledger |
| StrategyWeek | Weekly planning |
| FounderQuarter / FounderWeek | Quarterly/weekly goals |
| SignalSource / SignalItem | RSS signal engine |
| MetaAdsRecommendation | Meta Ads recommendations |
| IntegrationConnection | External service connections |
| OpsEvent / AuditAction | Observability |

---

## API Route Namespaces

340 route files organized into 30+ namespaces. See [docs/generated/api-routes.md](docs/generated/api-routes.md) for the full auto-generated inventory.

| Namespace | Routes | Purpose |
|-----------|--------|---------|
| brain | 1 | SSE streaming Claude chat |
| agents | 4 | Approvals, runs, cron |
| leads | 23 | Pipeline leads (CRUD, stage, won/lost, approve/reject, touches) |
| intake-leads | 21 | CRM intake (score, promote, follow-up, mark-won/lost) |
| proposals | 20 | Proposal lifecycle (send, accept, reject, revise, follow-ups) |
| delivery-projects | 34+ | Full delivery (milestones, handoff, retention, builder, proof) |
| next-actions | 8 | NBA (list, execute, done/dismiss, preferences, run) |
| risk | 4 | Risk flags (list, snooze/resolve, run-rules) |
| metrics | 9 | Conversion, revenue, cycle times, bottlenecks, trends |
| forecast | 4 | Weekly/monthly forecasts, targets, snapshots |
| jobs | 9 | Job queue (list, cancel, retry, run, recover, summary) |
| notifications | 5 | Events, dispatch, escalations, summary |
| knowledge | 5 | Knowledge entries, queue, suggestions |
| youtube | 9 | Ingest (channel/playlist/video), transcripts, learning |
| meta-ads | 13 | Dashboard, recommendations, scheduler, settings |
| internal | 28 | Scores, copilot, founder OS, memory, domain contexts |
| growth | 10 | Deals, prospects, outreach |
| signals | 5 | Sources, items, sync |
| integrations | 7 | Connections, test, disconnect |
| ops | 16 | Strategy week, workday run, settings, chat |
| followups | 3 | Unified follow-up queue |
| proof | 8 | Proof records, candidates, generation |

---

## Notification Pipeline

```
createNotificationEvent (1h dedupe by dedupeKey)
  → buildDefaultChannelSelection (which channels to use)
    → queueNotificationDeliveries (one per channel)
      → dispatchNotificationDelivery (exponential backoff: 1/5/15 min)
        → Channel adapters:
           - in-app: creates InAppNotification
           - email: Resend API (RESEND_API_KEY)
           - webhook: POST JSON (10s timeout)
```

**Escalations** (`evaluateEscalationRules`): 7 trigger types — dead_letter, stale_running, overdue, critical_overdue, weekly_missing, missing (snapshots), retention_overdue.

---

## Score Engine

```
Weighted factors → computeScore → 0-100 score → assignBand
  → healthy (≥80) | warning (≥50) | critical (<50)

computeAndStoreScore:
  → getFactors (adapter per entity type)
  → computeScore
  → store ScoreSnapshot
  → detect events:
    - threshold_breach (entered critical)
    - sharp_drop (delta ≤ -15)
    - recovery (entered healthy)
  → createScoreEventAndNotify (respects alert prefs + cooldown)
```

Entity types: `review_stream`, `command_center`

---

## Job Queue

Postgres-backed queue using `JobRun` model.

```
enqueueJob(type, payload) → JobRun (status: queued)
  → runJobsLoopOnce(limit) picks queued jobs, locks, executes
  → Success: status=succeeded, finishedAt set
  → Failure: retry up to maxAttempts, then dead_letter
  → recoverStaleJobs: requeue jobs stuck in running (>10min)
```

Cron endpoint: `POST /api/jobs/tick` (all-in-one: recover + enqueue due schedules + run loop).

---

## Builder Integration

The builder is a separate service on port 3001 (Docker). The main app has proxy routes:

| Route | Purpose |
|-------|---------|
| `POST .../builder/create` | Create site from lead data |
| `POST .../builder/deploy` | Deploy site to production |
| `GET .../builder/status` | Fetch site status, sync URLs |
| `POST .../builder/regenerate` | Regenerate content from artifacts |
| `POST .../builder/sections` | Edit site sections |
| `GET .../builder/support` | List support requests |

The delivery detail page (`/dashboard/delivery/[id]`) renders the builder preview in an iframe.

---

## Deployment

### Docker Compose Services

| Service | Image/Build | Port | Purpose |
|---------|------------|------|---------|
| app | `./` target `runner` | 3200→3000 | Next.js app |
| worker | `./` target `worker` | — | BullMQ + email + monitor |
| postgres | `postgres:16-alpine` | 5432 | Database |
| redis | `redis:7-alpine` | 6379 | Queue backend |
| builder | `./builder` | 3001→3001 | Website builder |

### Dockerfile Stages
1. `base` — node:20-alpine
2. `deps` — npm ci
3. `builder` — prisma generate + next build
4. `runner` — Minimal standalone + cherry-picked deps
5. `worker` — Extends runner with full node_modules

### Workers (`src/workers/index.ts`)
- BullMQ workers: enrich, score, monitor, builder-deploy queues
- builder-deploy: async deploy of builder sites (POST deploy returns 202 + jobId; poll status endpoint)
- Email ingestion loop: every 15 minutes (IMAP → Lead records → pipeline)
- Website monitor loop: every 1 hour (uptime + SSL check)

---

## Cross-Cutting Patterns

### Auth
- `requireAuth()` in `src/lib/api-utils.ts` — returns Session or null
- JWT strategy (no DB sessions)
- Dev bypass: `AUTH_DEV_PASSWORD` env var
- Cron auth: Bearer token + session fallback

### Observability
- `logOpsEventSafe()` — fire-and-forget OpsEvent creation
- `sanitizeMeta()` — redacts secrets, truncates strings
- `withRouteTiming()` — slow route logging (>500ms)
- `db` singleton with perf extension (slow query logging >300ms)

### Caching
- `withSummaryCache(key, fn, ttlMs)` — in-memory TTL (15-30s default)
- `shortCacheHeaders(maxAge)` — HTTP cache-control headers
- SWR pattern for client-side fetching

### Rate Limiting
- `rateLimit(key, limit, windowMs)` — in-memory per-route limits
- Typical: 5-20 req/min depending on route

### Validation
- Zod schemas on all POST/PATCH/PUT bodies
- `PATCH /api/leads/[id]` has explicit field allowlist (no status/outcome mutation)

---

## Generated Documentation

These files are auto-generated from code by `npm run docs:generate`:

- [docs/generated/api-routes.md](docs/generated/api-routes.md) — All API routes with methods
- [docs/generated/prisma-models.md](docs/generated/prisma-models.md) — All Prisma models
- [docs/generated/brain-tools.md](docs/generated/brain-tools.md) — All Brain tool definitions
- [docs/generated/agents.md](docs/generated/agents.md) — Agent registry
- [docs/generated/pages.md](docs/generated/pages.md) — Dashboard page inventory
- [docs/generated/env-vars.md](docs/generated/env-vars.md) — Environment variables
