# CLIENT ENGINE — MASTER CONTEXT (READ FIRST)

## What this system is

Client Engine is a private, forever-autopilot business OS for evenslouis.ca.
Its job is to capture leads, evaluate them, position the offer, generate proposals, and prepare builds — while enforcing strict money-path gates so no effort is wasted.

It is **not** a CRM clone.
It is a **decision engine + execution system** designed to:

- Maximize accepted deals
- Eliminate bad leads automatically
- Prevent unpaid or mis-scoped work
- Create portfolio-ready outputs
- Run safely in the background while I work a 9–5

This system must be:

- **Idempotent**
- **Self-documenting**
- **Metrics-driven**
- **Positioning-first** (problem > solution > product)

---

## Stack & Infra

- **Repo:** client-engine-1/
- **Host:** Hostinger VPS (Ubuntu)
- **Domains:** evenslouis.ca (main), evenslouis.pro available
- **Framework:** Next.js (App Router), TypeScript
- **DB:** PostgreSQL + Prisma
- **Queue/Workers:** Node workers (email ingestion, monitoring)
- **Auth:** NextAuth (admin-only system)
- **Deploy:** Docker Compose + Caddy (NO Vercel)
- **AI:** OpenAI API (key in .env)
- **Dev Tool:** Cursor (must read PROJECT_CONTEXT.md first)

---

## Single Source of Truth

**PROJECT_CONTEXT.md** (repo root)

This file documents:

- The goal of the system
- What is implemented
- Money-path rules
- Pipeline steps
- Metrics
- What to build next

**Cursor instruction:** Always read PROJECT_CONTEXT.md first and treat it as canonical truth.

---

## The Money Path (NON-NEGOTIABLE)

Leads must flow only through:

```
CAPTURE → ENRICH → SCORE → POSITION → PROPOSE → (OWNER APPROVAL) → BUILD
```

**Hard rules:**

- ❌ No proposal without positioning
- ❌ No build without ACCEPT verdict + proposal artifact
- ❌ No reruns once proposal is sent or build completed
- ❌ Rejected leads stop immediately
- ❌ System must explain why a step ran, skipped, or failed

---

## Core Engines Implemented

### 1. Lead Capture

- Email ingestion (IMAP) = Source #1
- Creates LeadSource, LeadSourceRun, LeadSourceEvent
- Deduplicates via contentHash / Message-ID
- Auto-creates Leads
- Triggers pipeline safely

### 2. Evaluation Pipeline

Each pipeline run is tracked.

**Schema:**

- PipelineRun
- PipelineStepRun
- Each step logs: success/failure, tokens used, cost estimate, output artifact IDs, notes (skip reasons, blocks, errors)

Each completed run produces:

- **RUN_REPORT.md** artifact per lead

**Dashboard:** /dashboard/metrics — shows macro conversion + recent runs

### 3. Positioning Engine (CRITICAL)

This is the marketing brain of the system.

Runs **after Score, before Propose**.

Creates artifact: **POSITIONING_BRIEF**

Includes:

- Felt problem (not stated ask)
- Language map (use / avoid / competitors overuse)
- Reframed offer (outcome-first)
- Blue-ocean angle
- Packaging (solution name, hook)

**Rules:**

- Proposals MUST use positioning
- No feature-first language
- No "AI-powered" clichés
- Demos must dramatize pain → relief

### 4. Proposal Engine

- Cannot run without POSITIONING_BRIEF
- Produces proposal artifact with: Opening, Upwork snippet (≤600 chars, counter enforced), Questions before starting
- Stored in Proposal Console

**Proposal Console:** /dashboard/proposals/[id]

- One-click copy
- Ready-to-send toggle
- Sent-on-Upwork freezes proposal

### 5. Build Engine

- Gated by ACCEPT verdict + proposal exists
- Creates: PROJECT_SPEC.md, DO_THIS_NEXT.md, CURSOR_RULES.md

**CURSOR_RULES.md** defines:

- What Cursor can do (scaffold, refactor, deploy demos)
- What Cursor cannot do (pricing, client contact, deleting projects)

---

## Automation & Safety

### Orchestrator

Single entry point: **runPipelineIfEligible(leadId, reason)**

- Uses Postgres advisory locks
- Fully idempotent
- Safe to call from: Email ingestion, Manual lead creation, Status change, Manual rerun API

Skips steps automatically if artifacts already exist.

### Pipeline Triggers

- Email ingestion → auto run
- Manual lead create → auto run
- Manual rerun endpoint → admin only
- **Build NEVER runs automatically** (owner approval only)

---

## Metrics Philosophy (Macro + Micro)

We are tracking:

- Where leads die
- Which steps cost money
- Which steps succeed/fail
- Why steps were skipped
- Conversion bottlenecks

This system is designed so **nothing is invisible**.

---

## What This System Is Optimized For

- Long-term leverage, not quick hacks
- Many small wins
- Minimal context switching
- No unpaid effort
- Positioning-led selling
- Background execution

---

## Where to Resume Building (NEXT STEP)

**Step 4: Auto Pipeline Completion**

Specifically:

- Finalize orchestrator wiring
- Ensure all steps log metrics consistently
- Extend metrics UI if needed
- Add quality signals (later): proposal acceptance, reply rate

**DO NOT:**

- Change money-path gates
- Add client messaging
- Add sales automation beyond proposal prep
- Remove positioning requirement

---

## Mental Model to Use

This system should think like:

- A constraint-focused operator
- A marketing strategist
- A risk-averse CFO
- A calm execution engine

It should always ask:

**"What is the next bottleneck, and is this worth effort?"**

---

*For implementation details, schema, and file locations, see PROJECT_CONTEXT.md.*
