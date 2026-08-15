# Bounded Contexts — Client Engine

Domain ownership map. The database stays unified; these boundaries define **mental and code ownership**.

For each context: models, routes, services, UI surfaces, and key invariants.

---

## 1. Lead Intake

**Owns:** CRM intake, pipeline runs, enrichment, follow-ups, cadence.

| Layer | Key Items |
|-------|-----------|
| **Models** | `Lead`, `IntakeLead`, `LeadActivity`, `PipelineRun`, `PipelineStepRun`, `LeadTouch`, `LeadReferral`, `LeadAttribution`, `Cadence` |
| **Routes** | `/api/capture`, `/api/intake-leads/**`, `/api/leads/**`, `/api/pipeline/**`, `/api/enrich/**`, `/api/followup/**`, `/api/cadence/**` |
| **Services** | `src/lib/intake-lead/`, `src/lib/pipeline/`, `src/lib/orchestrator/`, `src/lib/lead-intelligence/`, `src/lib/followup/`, `src/lib/sales-driver/` |
| **Pages** | `/dashboard/intake`, `/dashboard/leads`, `/dashboard/inbox`, `/dashboard/followups` |

**Invariants:**
- Money path: CAPTURE → ENRICH → SCORE → POSITION → PROPOSE → APPROVE → BUILD
- PATCH `/api/leads/[id]` cannot set status/outcome fields — dedicated routes only
- Pipeline runs use advisory locks (one concurrent run per lead)

---

## 2. Proposals / Sales

**Owns:** Proposal lifecycle, artifacts, outreach, positioning.

| Layer | Key Items |
|-------|-----------|
| **Models** | `Proposal`, `ProposalVersion`, `ProposalActivity`, `Artifact` |
| **Routes** | `/api/proposals/**`, `/api/artifacts/**`, `/api/propose/**`, `/api/position/**` |
| **Services** | `src/lib/proposals/`, `src/lib/proof-engine/` (draft generation) |
| **Pages** | `/dashboard/proposals`, `/dashboard/proposal-followups`, `/dashboard/sales`, `/dashboard/sales-leak` |

**Invariants:**
- No proposal without positioning brief
- Proposals must not oversell, claim certainty, or add irreversible steps (AXIOMS §7)
- Revise loop preserves positioning; only content changes

---

## 3. Delivery / Proof

**Owns:** Project delivery, milestones, handoff, retention, proof capture, content distribution.

| Layer | Key Items |
|-------|-----------|
| **Models** | `DeliveryProject`, `DeliveryMilestone`, `DeliveryChecklistItem`, `DeliveryActivity`, `ProofRecord`, `ProofCandidate`, `ContentPost`, `Project`, `Outcome`, `ProofAsset` |
| **Routes** | `/api/delivery-projects/**`, `/api/proof-candidates/**`, `/api/proof-records/**`, `/api/proof/**`, `/api/content-posts/**`, `/api/projects/**` |
| **Services** | `src/lib/delivery/`, `src/lib/proof-engine/`, `src/lib/proof-candidates/`, `src/lib/distribution/`, `src/lib/builder/` |
| **Pages** | `/dashboard/delivery`, `/dashboard/proof`, `/dashboard/proof-candidates`, `/dashboard/content-posts`, `/dashboard/handoffs`, `/dashboard/retention`, `/dashboard/results` |

**Invariants:**
- No build without APPROVED + proposal artifact + no existing project
- Proof must be observational, not promotional (AXIOMS §8)
- Builder integration: iframe preview, section editing, support requests

---

## 4. Risk / NBA / Scoring

**Owns:** Risk flags, next best actions, operator score, command center.

| Layer | Key Items |
|-------|-----------|
| **Models** | `RiskFlag`, `NextBestAction`, `NextActionExecution`, `NextActionRun`, `NextActionPreference`, `ScoreSnapshot`, `ScoreEvent` |
| **Routes** | `/api/risk/**`, `/api/next-actions/**`, `/api/internal/scores/**`, `/api/command-center` |
| **Services** | `src/lib/risk/`, `src/lib/next-actions/`, `src/lib/scoring/`, `src/lib/command-center/` |
| **Pages** | `/dashboard/risk`, `/dashboard/next-actions`, `/dashboard/scoreboard`, `/dashboard/scorecard`, `/dashboard/command` |

**Invariants:**
- Score 0–100, bands: healthy/warning/critical
- NBA ranking: deterministic scoring with learned weights + effectiveness
- 15 rule keys; templates define playbooks per rule
- Write tools require approval in agent mode

---

## 5. Copilot / Memory

**Owns:** Brain chat, coach mode, sessions, memory pipeline, attribution, learned weights.

| Layer | Key Items |
|-------|-----------|
| **Models** | `CopilotSession`, `CopilotMessage`, `CopilotActionLog`, `OperatorAttribution`, `OperatorMemoryEvent`, `OperatorLearnedWeight` |
| **Routes** | `/api/internal/copilot/**`, `/api/internal/memory/**`, `/api/ops/chat/**` |
| **Services** | `src/lib/brain/`, `src/lib/copilot/`, `src/lib/memory/` |
| **Pages** | `/dashboard/copilot`, `/dashboard/copilot/coach`, `/dashboard/copilot/sessions`, `/dashboard/chat` |

**Invariants:**
- Brain: Claude tool loop, max 10 iterations, 25 tools
- Coach mode: COPILOT_DECISION_RUBRIC governs what to answer/flag/ignore
- Memory weights: clamped [-10, +10], deltas: success +1, failure -1, dismiss -0.5, snooze -0.25
- Safe refusal: prevents dangerous actions in copilot mode

---

## 6. Founder OS

**Owns:** Quarterly goals, weekly planning, today's plan, strategy, founder review.

| Layer | Key Items |
|-------|-----------|
| **Models** | `FounderQuarter`, `FounderKPI`, `FounderWeek`, `FounderWeekPlan`, `FounderWeekReview`, `StrategyWeek`, `PlanningTheme` |
| **Routes** | `/api/internal/founder/**`, `/api/ops/strategy-week/**`, `/api/ops/planning-themes`, `/api/ops/scoreboard` |
| **Services** | `src/lib/founder/`, `src/lib/ops/` |
| **Pages** | `/dashboard/founder`, `/dashboard/founder/os/**`, `/dashboard/planning`, `/dashboard/strategy` |

**Invariants:**
- Founder summary aggregates cross-domain (score, risk, NBA, pipeline, execution)
- Today's plan: pickTopMoves() selects highest-impact actions
- Degraded mode: fallback must set `degraded: true` + log ops event

---

## 7. Growth Engine

**Owns:** Deals, prospects, outreach, follow-up scheduling.

| Layer | Key Items |
|-------|-----------|
| **Models** | `Prospect`, `Deal`, `OutreachEvent`, `FollowUpSchedule`, `OutreachMessage`, `DealEvent` |
| **Routes** | `/api/internal/growth/**`, `/api/prospect/**` |
| **Services** | `src/lib/growth/`, `src/lib/prospect/` |
| **Pages** | `/dashboard/growth`, `/dashboard/growth/deals/[id]` |

**Invariants:**
- Growth closest to revenue — must be contract-safe and golden-tested
- No auto-send; outreach drafts require operator approval
- Follow-up scheduling: days-based cadence per deal

---

## 8. Agent Runtime

**Owns:** Multi-agent system, runs, approval gates, scheduling.

| Layer | Key Items |
|-------|-----------|
| **Models** | `AgentRun`, `AgentApproval`, `FlywheelRun` |
| **Routes** | `/api/agents/**`, `/api/internal/flywheel` |
| **Services** | `src/lib/agents/` |
| **Pages** | `/dashboard/operator/agents`, `/dashboard/flywheel` |

**Invariants:**
- 10 agents; each has system prompt extension + tool allowlist
- Limits: 50k tokens, 15 tool calls, 2 concurrent, 24h approval expiry
- Write tools require explicit approval; circuit breaker after 2 failures
- Memory ingest on agent run completion

---

## 9. Jobs / Notifications

**Owns:** Job queue, schedules, notification pipeline, reminders, escalations.

| Layer | Key Items |
|-------|-----------|
| **Models** | `JobRun`, `JobSchedule`, `JobLog`, `NotificationChannel`, `NotificationEvent`, `NotificationDelivery`, `InAppNotification`, `EscalationRule`, `OpsReminder`, `AutomationSuggestion` |
| **Routes** | `/api/jobs/**`, `/api/job-schedules/**`, `/api/notifications/**`, `/api/notification-channels/**`, `/api/in-app-notifications/**`, `/api/reminders/**`, `/api/automation-suggestions/**` |
| **Services** | `src/lib/jobs/`, `src/lib/notifications/`, `src/lib/reminders/`, `src/lib/automation-suggestions/` |
| **Pages** | `/dashboard/jobs`, `/dashboard/job-schedules`, `/dashboard/notifications`, `/dashboard/notification-channels`, `/dashboard/reminders`, `/dashboard/automation` |

**Invariants:**
- Postgres-backed queue (no external queue dependency for core)
- Cron auth: Bearer token (AGENT_CRON_SECRET) + session fallback
- Escalation rules: configurable per channel
- Stale job recovery: automatic via `/api/jobs/recover-stale`

---

## 10. Voice (Phase 1)

**Owns:** Outbound proposal follow-up calls, consent state, call outcomes.

| Layer | Key Items |
|-------|-----------|
| **Models** | `VoiceCallLog`, `VoiceCallOutcome` enum; Proposal: `voiceConsentAt`, `voiceOptedOutAt`, `contactPhone` |
| **Routes** | `/api/voice/**` (eligible, schedule-follow-up, webhook, opt-out) |
| **Services** | `src/lib/voice/` |
| **Pages** | Proposal Follow-ups (eligible bucket, consent, schedule); Lead/Proposal detail (consent, last call); Command Center (voice card); Call log |

**Invariants:**
- One workflow: proposal follow-up (outbound) only
- Consent required before outbound; opt-out persisted
- Allowed outcomes: booked_callback, requested_manual_followup, not_interested, no_answer, opted_out
- Scripts versioned and operator-approved
- Client Engine = brain; Retell/Vapi = telephony runtime

**See:** [VOICE_ASSISTANT_PHASE_1_MVP.md](VOICE_ASSISTANT_PHASE_1_MVP.md), [VOICE_ASSISTANT_PHASES.md](VOICE_ASSISTANT_PHASES.md)

---

## Cross-Cutting

| Concern | Where |
|---------|-------|
| **Observability** | `OpsEvent`, `AuditAction` — `src/lib/ops-events/`, `src/lib/audit/` |
| **Client Interactions** | `ClientInteraction` — links intake, proposal, delivery, deal |
| **Integrations** | `IntegrationConnection`, `IntegrationRun` — `src/lib/integrations/` |
| **Auth** | `src/lib/auth.ts`, `src/lib/api-utils.ts` — NextAuth v5 |
| **Shared HTTP** | `src/lib/http/` — rate limiting, caching, fetch helpers |
| **Niche Context** | `src/lib/niche/context.ts` — injected into agent/brain prompts |
