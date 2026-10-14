# AGENTS.md — AI Coding Agent Instructions

Read this file before making any changes. It is the entry point for all AI coding agents (Cursor, Copilot, Claude Code, etc.).

## Behavioral Contract

**Read `docs/CLIENT_ENGINE_AXIOMS.md` first.** It is the non-negotiable law of this repo. Every suggestion, implementation, and prompt must comply with it. Key constraints:

- No cold outreach, funnels, hype, urgency language, or guarantees.
- No auto-send emails, auto-build projects, or bypassing money-path gates. Human approval is mandatory for all money-path steps.
- No pivoting the niche, offer, or positioning.
- Proposals must frame change as safe and reversible. No oversell.
- Proof must be observational only — no invented numbers, no superiority claims.
- The AI role is **Sales Engineer × Solution Architect × Pattern Historian**: guide without pushing, constrain decisions, think in trade-offs and human risk.

For Copilot behavior specifics, see `docs/COPILOT_DECISION_RUBRIC.md`.

## What This System Is

Client Engine is a private decision engine and execution system for a freelance operator. It captures leads, evaluates them, positions the offer, generates proposals, and gates builds — running safely in the background.

It is **not** a CRM clone. It is a positioning-first pipeline with hard money-path gates:

```
CAPTURE → ENRICH → SCORE → POSITION → PROPOSE → (OWNER APPROVAL) → BUILD
```

No proposal without positioning. No build without approval + proposal artifact. No bypass.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth v5 (credentials + optional OAuth) |
| AI | OpenAI API |
| Queue | BullMQ + Redis (optional workers) |
| UI | Tailwind CSS v4, Lucide icons, Sonner toasts |
| Testing | Vitest (unit), Playwright (E2E) |
| Deploy | Docker Compose + Caddy on Hostinger VPS |
| Validation | Zod v4 |

## Project Structure

```
src/
├── app/
│   ├── api/          # Next.js API routes (RESTful, auth-gated)
│   ├── dashboard/    # Private operator dashboard pages
│   ├── login/        # Auth pages
│   └── page.tsx      # Public landing page
├── components/       # Shared React components
├── hooks/            # Custom React hooks
├── lib/              # Core business logic
│   ├── pipeline/     # Pipeline orchestrator, steps, error classifier
│   ├── proof-engine/ # Quiet proof post + checklist generation
│   ├── research/     # Research engine (RSS/feed → lead factory)
│   ├── scoring/      # Lead scoring logic
│   ├── proposals/    # Proposal generation and revision
│   ├── integrations/ # External service integrations
│   ├── jobs/         # Background job definitions
│   ├── notifications/# Notification system
│   ├── llm/          # LLM client utilities
│   ├── db.ts         # Prisma client singleton
│   └── db-lock.ts    # Postgres advisory locks for concurrency
├── test/             # Test setup
└── workers/          # Background workers (email, queue)
prisma/
├── schema.prisma     # Database schema (source of truth for models)
├── seed.mjs          # Base seed script
└── seed-*.mjs        # Domain-specific seed scripts
tests/
└── e2e/              # Playwright E2E tests
docs/                 # Operational docs, runbooks, checklists, phase plans
```

## Key Files to Read First

1. **`docs/CLIENT_ENGINE_AXIOMS.md`** — Behavioral law. Read before doing anything.
2. **`PROJECT_CONTEXT.md`** — Single source of truth for what is built, what ships now, what is next, and what is out of scope.
3. **`SYSTEM_MANIFEST.md`** — Mental model, stack, core engines, money-path rules.
4. **`prisma/schema.prisma`** — Database models and relations.
5. **`docs/COPILOT_DECISION_RUBRIC.md`** — How the Copilot brain should behave (flags, silence, tone).

## Development

```bash
npm install
cp .env.example .env   # Set DATABASE_URL, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npx prisma db push
npx prisma db seed
npm run dev             # http://localhost:3000
```

Environment variables are documented in `.env.example`. Key ones: `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, `OPENAI_API_KEY`, `PIPELINE_DRY_RUN`.

## Testing

```bash
npm run test                  # Vitest unit tests
npm run test:e2e              # Playwright E2E (needs running app + DB)
npm run test:e2e:dry          # E2E with dry-run pipeline (no OpenAI key needed)
npm run smoke                 # Smoke subset of E2E tests
```

Dry-run mode (`PIPELINE_DRY_RUN=1`) creates placeholder artifacts without calling OpenAI — use this for testing.

## Coding Conventions

- **API routes** live in `src/app/api/` and follow Next.js App Router conventions. Most require auth.
- **Business logic** lives in `src/lib/`, not in API routes or components. Routes are thin wrappers.
- **Pipeline orchestration** uses a single entry point: `runPipelineIfEligible(leadId, reason)` in `src/lib/pipeline/runPipeline.ts`. Steps are idempotent — if an artifact already exists, the step is skipped.
- **Error classification** uses `src/lib/pipeline/error-classifier.ts` with typed codes (`OPENAI_429`, `OPENAI_5XX`, `GATE`, `VALIDATION`, `DB`, `UNKNOWN`). Step failures are stored as `CODE|message` in step notes.
- **Concurrency** is managed with Postgres advisory locks (`src/lib/db-lock.ts`).
- **Status transitions** for leads follow a strict lifecycle: `NEW → ENRICHED → SCORED → APPROVED/REJECTED → BUILDING → SHIPPED`. Only dedicated API routes may set status and money-path fields (approvedAt, buildStartedAt, proposalSentAt, dealOutcome). The generic PATCH `/api/leads/[id]` uses an allowlist and rejects these fields.
- **Artifacts** store all pipeline outputs (enrichment, score, positioning brief, proposal, run reports, proof posts, checklists). Type + title conventions matter — e.g., positioning must produce an artifact titled `POSITIONING_BRIEF`.
- **Database** uses Prisma with `db push` (no migrations history yet). Schema is in `prisma/schema.prisma`.

## What NOT to Do

- Do not bypass money-path gates (no setting status/approvedAt/buildStartedAt via PATCH lead).
- Do not add auto-send, auto-build, or any action that skips human approval.
- Do not add cold outreach, marketing funnels, or hype language anywhere.
- Do not add features from the "out of scope" section in `PROJECT_CONTEXT.md` (Coach OS, Pattern Library, AgentPilot, BitBrain) unless explicitly requested.
- Do not use feature-first or "AI-powered" language in proposals or proof content.
- Do not invent metrics or numbers in proof posts — use actual pipeline cost data or say "approx" / omit.
- Do not remove the positioning requirement for proposals.

## Deploy

Production deploys use `./scripts/sync-and-deploy.sh` (push + rsync + deploy) or `./scripts/deploy-remote.sh` (git pull on server + deploy). Post-deploy: verify `GET /api/health` returns `ok: true`. See `docs/VPS_DEPLOY_CHECKLIST.md` and `docs/AFTER_DEPLOY_SMOKE_CHECKLIST.md`.
