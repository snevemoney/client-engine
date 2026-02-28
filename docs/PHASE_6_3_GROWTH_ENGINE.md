# Phase 6.3 — Growth Engine v1

Prospecting → Outreach → Follow-up → Close. Lightweight pipeline with outreach sequences, follow-up scheduling, and outcome tracking. Feeds NBA + Memory with real signals.

**Phase 6.3.1** adds OutreachEvent + FollowUpSchedule as canonical source of truth, new API routes (draft, send, schedule), and NBA delivery actions (growth_open_deal, growth_schedule_followup_3d, growth_mark_replied).

---

## Purpose

- **Capture:** Prospects (IG/X/Upwork/manual)
- **Outreach:** DM/email sequences with templates
- **Follow-up:** Automatic scheduling (24h/48h/7d presets)
- **Outcome:** Reply, call, proposal, won/lost
- **Memory:** Feed NBA + OperatorMemory with real signals (no cold outreach, no auto-send)

---

## Data Model

| Model | Purpose |
|-------|---------|
| `Prospect` | id, name, handle?, platform (instagram/x/upwork/manual), opportunityScore? |
| `Deal` | prospectId, ownerUserId, stage, nextFollowUpAt, templateKey? |
| `OutreachMessage` | dealId, channel (dm/email), templateKey, status, sentAt |
| `DealEvent` | dealId, eventType (reply/call/payment/etc), occurredAt |
| `OutreachEvent` | (6.3.1) ownerUserId, dealId, channel, type (sent/reply/bounced/call_booked/followup_scheduled), occurredAt, metaJson |
| `FollowUpSchedule` | (6.3.1) dealId, nextFollowUpAt, cadenceDays, status (active/paused/completed) |

**Enums:** ProspectPlatform, DealStage, DealPriority, OutreachChannel, OutreachStatus, DealEventType, OutreachEventType, FollowUpScheduleStatus

**Stage flow:** new → contacted → replied → call_scheduled → proposal_sent → won | lost

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/internal/growth/prospects` | GET, POST | List/create prospects (POST creates Deal) |
| `/api/internal/growth/deals` | GET, POST | List/create deals |
| `/api/internal/growth/deals/[id]` | GET, PATCH | Get/update deal |
| `/api/internal/growth/deals/[id]/outreach/preview` | POST | Preview message from template |
| `/api/internal/growth/deals/[id]/outreach/send` | POST | Create OutreachMessage, set contacted, nextFollowUpAt |
| `/api/internal/growth/deals/[id]/events` | POST | Create DealEvent, optional stage update |
| `/api/internal/growth/summary` | GET | countsByStage, overdueFollowUps, next7DaysFollowUps, lastActivityAt (15s cache) |
| `/api/internal/growth/outreach/draft` | POST | (6.3.1) Create draft, return content + placeholders |
| `/api/internal/growth/outreach/send` | POST | (6.3.1) Log OutreachEvent.sent, update Deal, create FollowUpSchedule |
| `/api/internal/growth/followups/schedule` | POST | (6.3.1) Set nextFollowUpAt via FollowUpSchedule |

All routes: `requireAuth`, `sanitizeErrorMessage`, 20/min rate limit for mutating endpoints.

---

## Templates

`src/lib/growth/templates.ts` — 6 templates: broken_link_fix, google_form_upgrade, linktree_cleanup, big_audience_no_site, canva_site_upgrade, calendly_blank_fix

Each: `content`, `nextFollowUpDays` (2, 3, or 7). `renderTemplate` supports `{{name}}`, `{{handle}}`, etc.

---

## NBA Rules (founder_growth scope)

| Rule | Condition | Action |
|------|-----------|--------|
| `growth_overdue_followups` | Overdue follow-ups > 0 | Open Growth, send follow-ups |
| `growth_no_outreach_sent` | New deals with no outreach | Open Growth, send outreach |
| `growth_stale_pipeline` | Deals exist, no activity 7+ days | Open Growth, re-engage |

**Scope:** `founder_growth`. Run with `POST /api/next-actions/run?entityType=founder_growth&entityId=founder_growth`. Context includes `ownerUserId` for per-user pipeline stats.

---

## Risk Rule

| Rule | Condition | Severity |
|------|-----------|----------|
| `growth_pipeline_zero_activity_7d` | 3+ deals, no outreach/events 7+ days | high |

**Source:** `RiskSourceType.growth_pipeline`. Per-user dedupe. Run via `POST /api/risk/run-rules` (passes session user for growth context).

---

## Memory Hooks

`src/lib/memory/growth-ingest.ts`

- **ingestFromGrowthOutreach:** On outreach send → OperatorMemoryEvent (sourceType: growth, entityType: deal)
- **ingestFromGrowthStageChange:** On stage change (reply/call/won/lost) → OperatorMemoryEvent with outcome (success/failure/neutral)

---

## UI Pages

| Path | Purpose |
|------|---------|
| `/dashboard/growth` | Pipeline board, stage counts, overdue/next 7 days, deal list, add prospect |
| `/dashboard/growth/deals/[id]` | Deal workspace: prospect card, stage dropdown, outreach preview/send, follow-up presets, event log |

**Founder dashboard:** "Pipeline Follow-ups" card links to Growth, shows overdue + next 7 days counts.

---

## Operating Loop

1. Add prospects (manual or via future capture flows)
2. Preview outreach → Send → Deal moves to contacted, nextFollowUpAt set
3. Log events (reply, call, payment) → Stage updates
4. Follow-up presets (24h/48h/7d) or custom date
5. NBA + Risk rules surface overdue, no-outreach, stale pipeline
6. Memory ingests for Copilot/attribution

---

## Test Commands

```bash
# Unit
npm run test -- src/lib/growth/templates.test.ts
npm run test -- src/lib/next-actions/rules.test.ts

# E2E (with dev server)
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/growth-engine.spec.ts
```

---

## NBA Delivery Actions (6.3.1)

| Action | Purpose |
|--------|---------|
| `growth_open_deal` | Open deal or growth dashboard (uses payloadJson.dealId) |
| `growth_schedule_followup_3d` | Schedule follow-up in 3 days |
| `growth_mark_replied` | Mark deal as replied, log OutreachEvent |

---

## Related Files

- `prisma/schema.prisma` — Prospect, Deal, OutreachMessage, DealEvent, OutreachEvent, FollowUpSchedule
- `src/lib/growth/templates.ts` — Outreach templates
- `src/lib/growth/summary.ts` — Summary computation
- `src/lib/memory/growth-ingest.ts` — Memory ingestion
- `src/app/api/internal/growth/*` — API routes
- `src/app/dashboard/growth/*` — UI pages
- `src/lib/next-actions/rules.ts` — NBA growth rules
- `src/lib/next-actions/scope.ts` — founder_growth scope
- `src/lib/risk/rules.ts` — growth_pipeline_zero_activity_7d
