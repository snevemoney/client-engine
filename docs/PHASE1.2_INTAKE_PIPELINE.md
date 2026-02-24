# Phase 1.2 — Intake → Pipeline Promotion + Proof Capture

**Status:** Implemented

## Overview

Connects IntakeLead to the pipeline Lead, adds proposal tracking (mark-sent, set-followup), win/loss flow with proof capture, and scoreboard/reviews integration.

## What Was Built

### 1. Promote IntakeLead → Pipeline Lead
- **POST /api/intake-leads/[id]/promote**
- Creates pipeline Lead from IntakeLead (title, summary required)
- Links via IntakeLead.promotedLeadId → Lead
- Idempotent: returns existing link if already promoted
- Creates LeadActivity "manual" with promotedLeadId in metadata

### 2. Schema Changes
- **IntakeLead:** promotedLeadId, promotedLead (FK to Lead), proposalSentAt, followUpDueAt, outcomeReason
- **Lead:** promotedFromIntake (back-relation)
- **ProofRecord:** sourceType, sourceId, intakeLeadId, title, company, outcome, proofSnippet, beforeState, afterState, metricValue, metricLabel

### 3. Proposal Tracking
- **POST /api/intake-leads/[id]/mark-sent** — sets status=sent, proposalSentAt, syncs pipeline Lead
- **POST /api/intake-leads/[id]/set-followup** — body: nextAction, followUpDueAt; sets nextActionDueAt, followUpDueAt; syncs pipeline nextContactAt

### 4. Win/Loss Flow
- **POST /api/intake-leads/[id]/mark-won** — status=won, creates ProofRecord draft, syncs pipeline dealOutcome
- **POST /api/intake-leads/[id]/mark-lost** — status=lost, syncs pipeline dealOutcome

### 5. Proof Records
- **ProofRecord** model — editable proof drafts from intake/won
- **GET /api/proof-records** — list
- **PATCH /api/proof-records/[id]** — edit proofSnippet, beforeState, afterState, metricValue, metricLabel
- /dashboard/proof — Proof Records section with inline edit

### 6. Intake UI
- Promote to Pipeline, Mark Sent, Set Follow-up, Mark Won, Mark Lost buttons
- Promoted status + link to pipeline lead
- Proposal sent date, follow-up date display
- Set Follow-up modal (nextAction + datetime)

### 7. Scoreboard + Reviews
- Intake summary: sentThisWeek, wonThisWeek, proofCreatedThisWeek
- Reviews page: IntakeWeeklyStats strip (sent, won, proof records this week)

### 8. Tests
- promote validation (title, summary required)
- mark-won proof snippet building
- Null-safe formatting

### 9. Seed
- `npm run db:seed-proof` — creates 1 proof record if a won intake lead exists

## Manual Steps

1. **Schema:** `npx prisma db push` (or migrate)
2. **Deploy:** Include new routes and schema on prod
3. **Optional:** Mark an intake lead as won, then run `npm run db:seed-proof` to add sample proof records
