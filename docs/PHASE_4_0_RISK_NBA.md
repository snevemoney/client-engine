# Phase 4.0: Risk Flags + Next-Best-Action Foundation

**Deterministic base for a future copilot.** No LLM, no auto-execution, no external integrations.

---

## Overview

- **Risk Flags** — Issues surfaced across the app (notifications failed, stale jobs, overdue reminders, critical score, proposal follow-ups, retention).
- **Next-Best-Action (NBA)** — Ranked recommendations. Operators choose; no auto-run.
- **Operator UX** — `/dashboard/risk`, `/dashboard/next-actions`, Command Center integration.
- **Internal QA** — `/dashboard/internal/qa/risk`, `/dashboard/internal/qa/next-actions`.

---

## Schema (Prisma)

### Enums

- `RiskSeverity`: low, medium, high, critical
- `RiskStatus`: open, snoozed, resolved, dismissed
- `RiskSourceType`: notification_event, job, reminder, score, proposal, delivery_project
- `NextActionPriority`: low, medium, high, critical
- `NextActionStatus`: queued, done, dismissed

### Models

- **RiskFlag** — key, title, description, severity, status, sourceType, sourceId, actionUrl, suggestedFix, evidenceJson, dedupeKey, snoozedUntil, lastSeenAt
- **NextBestAction** — title, reason, priority, score, status, sourceType, sourceId, actionUrl, payloadJson, dedupeKey
- **NextActionRun** — runKey, runSource, metaJson (audit trail)

---

## Risk Rules (6)

| Rule | Trigger | Severity |
|------|---------|----------|
| critical_notifications_failed_delivery | failedDeliveryCount24h ≥ 3 | critical |
| stale_running_jobs | staleRunningJobsCount ≥ 1 | high |
| overdue_reminders_high_priority | overdueRemindersHighCount > 0 | high |
| score_in_critical_band | commandCenterBand === "critical" | critical |
| proposal_followups_overdue | proposalFollowupOverdueCount > 0 | high if ≥5, else medium |
| retention_overdue | retentionOverdueCount > 0 | high if ≥3, else medium |

---

## NBA Rules (6)

| Rule | Trigger | Priority |
|------|---------|----------|
| score_in_critical_band | commandCenterBand === "critical" | critical |
| failed_notification_deliveries | failedDeliveryCount > 0 | high |
| overdue_reminders_high_priority | overdueRemindersCount > 0 | medium |
| proposals_sent_no_followup_date | sentNoFollowupDateCount > 0 | medium |
| retention_overdue | retentionOverdueCount > 0 | high if ≥3, else medium |
| handoff_no_client_confirm | handoffNoClientConfirmCount > 0 | medium |

**Scoring (base):** critical 90, high 75, medium 55, low 30. Plus countBoost (up to 10) and recencyBoost (up to 10).

---

## API Routes

### Risk

- `POST /api/risk/run-rules` — Evaluate rules, upsert flags. Rate limit 10/min.
- `GET /api/risk` — List with filters (status, severity, sourceType, search), paginated.
- `PATCH /api/risk/[id]` — action: snooze (preset 2d|7d or until), resolve, dismiss.
- `GET /api/risk/summary` — Cached 15s. openBySeverity, snoozedCount, lastRunAt.

### Next Actions

- `POST /api/next-actions/run` — Run NBA rules, upsert actions. Rate limit 10/min.
- `GET /api/next-actions` — List with filters (status, priority, sourceType, search), paginated.
- `PATCH /api/next-actions/[id]` — action: done, dismiss.
- `GET /api/next-actions/summary` — Cached 15s. top5, queuedByPriority, lastRunAt.

---

## Ops Events

- `risk.upsert` — When risk flags created/updated.
- `risk.critical_notified` — When in-app notification created for new CRITICAL risk.
- `nba.run` — When NBA run completes.
- `nba.upsert` — When next actions created/updated.

---

## Notifications

- New **CRITICAL** risk → in-app notification via `createNotificationEvent` + `queueNotificationDeliveries`. Dedupe key: `risk:{dedupeKey}`.

---

## Conventions

- Auth: `requireAuth()`; 401 when null.
- Rate limit: `rateLimitByKey` 10/min for run endpoints.
- Summary cache: `withSummaryCache` 15s.
- Pagination: `parsePaginationParams`, `buildPaginationMeta`, `paginatedResponse`.
- Ops events: `logOpsEventSafe` with `sanitizeMeta`.

---

## File Reference

| Area | Path |
|------|------|
| Schema | prisma/schema.prisma |
| Seed | scripts/seed-risk-nba.ts |
| Risk lib | src/lib/risk/ |
| NBA lib | src/lib/next-actions/ |
| Risk API | src/app/api/risk/ |
| NBA API | src/app/api/next-actions/ |
| Risk page | src/app/dashboard/risk/page.tsx |
| NBA page | src/app/dashboard/next-actions/page.tsx |
| RiskNBACard | src/components/dashboard/command/RiskNBACard.tsx |
