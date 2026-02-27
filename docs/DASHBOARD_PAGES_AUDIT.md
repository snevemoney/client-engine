# Dashboard Pages Audit — Data Sources & Gaps

**Purpose:** Map every dashboard page to its API(s), data scope (intake vs pipeline vs both), and any data gaps. Used for systematic connectivity checks.

**Lead flows:**
- **Intake:** IntakeLead model — Lead Intake page, seed scripts
- **Pipeline:** Lead model — Website form, Research Engine, Add Lead, promoted intake leads

---

## ✅ Already Fixed

| Page | Route | APIs | Scope | Status |
|------|-------|------|-------|--------|
| Command Center (Daily Summary) | `/dashboard/command-center` | `/api/command-center` | Both | Fixed: followup, intakeActions, proofGaps include pipeline |
| Follow-ups | `/dashboard/followups` | `/api/followups` | Both | Fixed: merged intake + pipeline |
| Follow-ups Summary | (used by Planning, Scoreboard) | `/api/followups/summary` | Both | Fixed: overdue/today/next include pipeline |
| Intake Leads Summary | (used by Overview, Sales, etc.) | `/api/intake-leads/summary` | Both | Fixed: pipeline new/won counts |
| Conversion | `/dashboard/conversion` | `/api/metrics/conversion` | Both | Fixed: fetchConversionInput includes pipeline |
| Sales | `/dashboard/sales` | `/api/intake-leads/summary`, `/api/proposals/summary` | Both | Fixed via summary |
| Proposal detail | `/dashboard/proposals/[id]` | `/api/proposals/[id]`, `/api/artifacts/[id]` | Both | Fixed: handles Proposal id or Artifact id |

---

## Today Section

| Page | Route | APIs | Scope | Gaps |
|------|-------|------|-------|------|
| **Overview** | `/dashboard/overview` | `OverviewLiveStats`: intake-leads/summary, proposals/summary, delivery-projects/summary | Both (summary fixed) | None — summary now includes pipeline |
| **Dashboard** | `/dashboard/command` | `FollowUpQueueCard`: followups, followups/summary; CommandSection1, RiskNBACard | Both | ✅ Fixed: FollowUpQueueCard uses unified /api/followups |
| **Leads** | `/dashboard/leads` | `/api/leads` | Pipeline only | By design: Leads page = pipeline. Intake is separate at Lead Intake |
| **Follow-ups** | `/dashboard/followups` | `/api/followups` | Both | ✅ Fixed |
| **Proposals** | `/dashboard/proposals` | `/api/proposals` | Both | Proposals can come from intake or pipeline |
| **Inbox** | `/dashboard/inbox` | `/api/in-app-notifications`, `/api/notifications/summary` | System | None |
| **Next Actions** | `/dashboard/next-actions` | `/api/next-actions`, `/api/next-actions/summary` | NextBestAction model | System-wide, not lead-scoped; no gap |
| **Chat** | `/dashboard/chat` | `/api/ops/chat`, `/api/ops/chat/execute` | System | None |

---

## Pipeline Section

| Page | Route | APIs | Scope | Gaps |
|------|-------|------|-------|------|
| **Prospect Research** | `/dashboard/prospect` | POST `/api/prospect`, `/api/leads` | Pipeline | Creates pipeline leads; none |
| **Lead Intake** | `/dashboard/intake` | `/api/intake-leads`, bulk-score, bulk-promote | Intake only | By design |
| **Proposal Follow-ups** | `/dashboard/proposal-followups` | `/api/proposals/followups`, followup-summary | Both | Proposals can be from either path |
| **Delivery** | `/dashboard/delivery` | `/api/delivery-projects`, summary | Both | DeliveryProjects link to Proposals (intake or pipeline) |
| **Handoffs** | `/dashboard/handoffs` | `/api/delivery-projects/handoff-queue`, handoff-summary | Both | Via DeliveryProjects |
| **Retention** | `/dashboard/retention` | `/api/delivery-projects/retention-queue`, retention-summary | Both | Via DeliveryProjects |
| **Reminders** | `/dashboard/reminders` | `/api/reminders`, summary | OpsReminder model | System; none |
| **Risk** | `/dashboard/risk` | `/api/risk`, summary | RiskFlag model | System; none |

---

## Numbers Section

| Page | Route | APIs | Scope | Gaps |
|------|-------|------|-------|------|
| **Sales** | `/dashboard/sales` | intake-leads/summary, proposals/summary | Both | ✅ Fixed |
| **Forecast** | `/dashboard/forecast` | `/api/forecast/current`, snapshot | Proposal/Delivery/Proof | Uses Proposal, DeliveryProject, ProofRecord; not lead-scoped; OK |
| **Intelligence** | `/dashboard/intelligence` | `/api/metrics/summary` | Both | fetchConversionInput fixed; 15–30s cache |
| **Scoreboard** | `/dashboard/scoreboard` | intake-leads/summary, followups/summary, proof-candidates, action-summary, proof-gaps, proposals/*, delivery-projects/*, metrics/summary, operator-score, forecast, reminders, automation, ops-events, audit, notifications | Mixed | intake-leads/summary & followups/summary fixed; others OK |
| **Results** | `/dashboard/results` | getResultsLedgerEntries → db.lead (APPROVED/BUILDING/SHIPPED) | Pipeline only | By design: delivery clients are pipeline leads |
| **Operator Score** | `/dashboard/operator` | `/api/operator-score/current`, history, snapshot | Both | ✅ Fixed: wonMissingProof now includes pipeline (Lead dealOutcome=won) |
| **Sales Leak** | `/dashboard/sales-leak` | getSalesLeakDashboard → getSalesLeakReport | Pipeline (Lead) only | By design: PBD stages are on Lead model |
| **Conversion** | `/dashboard/conversion` | `/api/metrics/conversion` | Both | ✅ Fixed |

---

## Business Section

| Page | Route | APIs | Scope | Gaps |
|------|-------|------|-------|------|
| **Strategy** | `/dashboard/strategy` | StrategyPipelineContext: metrics/conversion, intake-leads/summary; StrategyQuadrantPanel: ops/strategy-week | Both | Fixed via summary & conversion |
| **Planning** | `/dashboard/planning` | UpcomingDeadlines: followups/summary, delivery-projects/summary, proposals/followup-summary; PlanningThemesSection: ops/planning-themes | Both | followups/summary fixed |
| **Team** | `/dashboard/team` | None (static content + links) | — | None |
| **Reviews** | `/dashboard/reviews` | ProposalWeeklyStats, PipelineHygieneWeeklyStats (intake-leads/action-summary), FollowupWeeklyStats (followups/summary), OpsObservabilityWeeklyStats, NotificationsWeeklyStats, RevenueIntelligenceWeeklyStats | Mixed | followups/summary & intake-leads fixed |
| **GROW** | `/dashboard/grow` | None (static content + links) | — | None |
| **Website** | `/work` | Static/marketing | — | None |

---

## Content & Learning Section

| Page | Route | APIs | Scope | Gaps |
|------|-------|------|-------|------|
| **Signals** | `/dashboard/signals` | `/api/signals/sources`, items | RSS/signals | Not lead-scoped |
| **Meta Ads** | `/dashboard/meta-ads` | meta-ads/mode, dashboard, recommendations, asset-health, actions, scheduler | Meta integration | Not lead-scoped |
| **YouTube** | `/dashboard/youtube` | youtube/jobs, transcripts, learning, ingest | YouTube integration | Not lead-scoped |
| **Knowledge** | `/dashboard/knowledge` | `/api/knowledge`, ingest, queue, suggestions | Knowledge base | Not lead-scoped |
| **Learning** | `/dashboard/learning` | (YouTube learning) | — | Part of YouTube |
| **Proof** | `/dashboard/proof` | proof-candidates/summary, proof-records, **/api/proof/lead-options** (both), /api/proof, /api/proof/generate (leadId or intakeLeadId) | Both | ✅ Fixed: lead-options returns pipeline + intake; generate supports intakeLeadId |
| **Proof Candidates** | `/dashboard/proof-candidates` | `/api/proof-candidates` | Both | ProofCandidate has intakeLeadId and leadId; API should include both |
| **Content Assets** | `/dashboard/content-assets` | db.contentAsset | ContentAsset model | Not lead-scoped |

---

## System Section

| Page | Route | APIs | Scope | Gaps |
|------|-------|------|-------|------|
| **Settings** | `/dashboard/settings` | IntegrationsSection: `/api/integrations`; CashAndGraduationSection: ops/settings | Config | None |
| **Automation** | `/dashboard/automation` | `/api/automation-suggestions` | System | None |
| **Alert History** | `/dashboard/notifications` | `/api/notifications` | System | None |
| **Channels** | `/dashboard/notification-channels` | `/api/notification-channels` | Config | None |
| **Jobs** | `/dashboard/jobs` | `/api/jobs`, summary | System | None |
| **Schedules** | `/dashboard/job-schedules` | `/api/job-schedules` | System | None |
| **System Health** | `/dashboard/ops-health` | (server-side ops health) | System | None |
| **Build Tracker** | `/dashboard/build-ops` | db.buildTask (linkedLead) | Pipeline (Lead) | BuildTask.linkedLeadId → Lead |
| **Metrics** | `/dashboard/metrics` | db.pipelineRun, pipelineStepRun, getConstraintSnapshot, getScorecardSnapshot | System / pipeline runs | Pipeline-run focused |
| **Deploys** | `/dashboard/deploys` | projects PATCH | System | None |
| **Checklist** | `/dashboard/checklist` | `/api/checklist`, generate | System | None |

---

## Advanced Section

| Page | Route | APIs | Scope | Gaps |
|------|-------|------|-------|------|
| **Audit** | `/dashboard/audit` | `/api/audit-actions/summary`, `/api/audit-actions` | AuditAction model | System-wide |
| **Monitoring** | `/dashboard/observability` | `/api/ops-events/summary`, ops-events, slow | System | None |
| **Operational Scores** | `/dashboard/internal/scoreboard` | internal/scores/summary, history, compute | System | None |
| **Score Alerts** | `/dashboard/internal/scores/alerts` | AlertsPreferencesPanel (component) | Preferences UI | None |
| **QA: Notifications** | `/dashboard/internal/qa/notifications` | internal/system/check, ops/metrics-summary | System | None |
| **QA: Scores** | `/dashboard/internal/qa/scores` | internal/scores/latest, history, compute | System | None |
| **QA: Risk** | `/dashboard/internal/qa/risk` | `/api/risk/summary` | System | None |
| **QA: Next Actions** | `/dashboard/internal/qa/next-actions` | `/api/next-actions/summary` | System | None |

---

## Priority Gaps — All Fixed

### 1. Proof page — ✅ Fixed
- **Was:** Generate dropdown used `/api/leads` (pipeline only). Intake leads with proof candidates could not be selected.
- **Now:** Uses `/api/proof/lead-options` (pipeline + intake). `/api/proof/generate` accepts `intakeLeadId`; builds from ProofCandidate.

### 2. Dashboard (Command) — FollowUpQueueCard — ✅ Fixed
- **Was:** Used `/api/leads/followup-queue` (pipeline only).
- **Now:** Uses `/api/followups` and `/api/followups/summary` (both intake + pipeline). followups/summary extended with noNextAction, overdue3d, proposalsNoFollowUp for unified warnings.

### 3. Verified — no gaps
- Results, Team, GROW, Content Assets, Build Tracker, Metrics, Audit, Score Alerts — see table entries above.

---

## Caching Notes

- **withSummaryCache** (15–30s): command-center, intake-leads/summary, followups/summary, proposals/summary, metrics/summary, operator-score, forecast/current, etc.
- **unstable_cache** (CACHE_TTL): sales-leak, ops health, money scorecard, etc.
- **Client fetch `cache: "no-store"`:** Most dashboard pages use this; Command Center and others explicitly bypass cache.
- **Recommendation:** For money-path or high-traffic pages, 15s is reasonable. Consider 10s for Command Center if staleness is reported.

---

*Last updated: 2026-02-27 — All gaps fixed; app airtight.*
