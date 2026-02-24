# Phase 1.1 — Lead Intake Engine

**Status:** Implemented  
**Route:** `/dashboard/intake`  
**API:** `/api/intake-leads`

## Overview

Production-safe Lead Intake system for manually capturing opportunities (Upwork, LinkedIn, referral, inbound, RSS, etc.), scoring them, drafting proposals, and tracking next actions. No external APIs required.

## What Was Built

### Database (Prisma)
- **IntakeLead:** source, title, company, contactName, contactEmail, link, summary, budgetMin/Max, urgency, status, score, scoreReason, nextAction, nextActionDueAt, tags
- **LeadActivity:** timeline (note, status_change, score, draft, sent, followup, manual)
- **Enums:** IntakeLeadSource, IntakeLeadUrgency, IntakeLeadStatus, LeadActivityType

### API Routes
- `GET /api/intake-leads` — list with filters (status, source, search)
- `POST /api/intake-leads` — create
- `GET /api/intake-leads/[id]` — details + activity
- `PATCH /api/intake-leads/[id]` — update fields
- `POST /api/intake-leads/[id]/score` — heuristic scoring (0–100)
- `POST /api/intake-leads/[id]/draft` — generate proposal draft (template-based)
- `POST /api/intake-leads/[id]/activity` — append note/log
- `GET /api/intake-leads/summary` — counts for scoreboard (newThisWeek, qualified, sent, won)

### UI
- `/dashboard/intake` — table with filters, "New Lead" button
- `/dashboard/intake/[id]` — details, Score Lead, Draft Proposal, Add Note, Change Status, activity timeline
- Nav: "Lead Intake" in Ops section
- Scoreboard: optional Leads summary card (new, qualified, sent, won)

### Components
- LeadStatusBadge, LeadSourceBadge, LeadScoreBadge
- LeadFormModal, LeadActivityTimeline

## Manual Steps

1. **Schema:** Run `npx prisma db push` (or migrate) to add IntakeLead + LeadActivity tables.

2. **Seed (optional):** `npm run db:seed-intake-leads` — creates 5 sample leads across sources/statuses.

3. **Promote to pipeline (future):** IntakeLead is separate from pipeline Lead. When ready, add a "Promote to pipeline" flow that creates a Lead from IntakeLead and links them.

## Constraints Respected

- Existing Phase 1 pages and schema unchanged
- Null-safe handling, enum validation, no uncaught exceptions
- Draft generation is axiom-compliant (safe, reversible, no hype)
- Manual mode only; external integrations left for future work
