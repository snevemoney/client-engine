# Session: Roadmap Priorities Implementation — 2026-03-10

## Goal

Implement the Roadmap Priorities Alignment plan: update ROADMAP.md, implement 9-phase enrichment path in builder/create, and create ADR-style implementation plans for Phase 2–4.

## Decisions Made

- **9-phase enrichment path** — Use enrich path when `ENRICH_CONTEXT_SECRET` is set; pass `deliveryProjectId` + `enrichContextUrl` to `generateContent`. Fall back to local `enrichSiteBrief` when secret is unset.
- **Implementation plans** — Create as docs in `docs/decisions/` (007, 008, 009) with status "Proposed". Link from ROADMAP.

## What Was Built

### ROADMAP.md
- Restructured to match priority table: Phase 1, 9-Phase, Phase 2, Phase 3, Phase 4, Backlog
- Removed "Active Work" / "Next Up" grouping; flat phase sections
- Fixed "Apply indexes" to use `prisma migrate deploy` (not db push)
- Marked ENRICH_CONTEXT_SECRET as done; builder/create enrichment path as done
- Simplified Backlog (Voice, Client portal, Prisma migrations)
- Added links to implementation plans for Phase 2–4

### Builder Create Route
- **`src/app/api/delivery-projects/[id]/builder/create/route.ts`** — When `ENRICH_CONTEXT_SECRET` is set and no SBP, passes `deliveryProjectId` + `enrichContextUrl` to `generateContent`. Site-builder fetches context and runs 9-phase enrichment internally. Falls back to local enrichSiteBrief when secret is unset.

### Implementation Plans
- **`docs/decisions/007-phase-2-architecture-refactor-impl.md`** — Service layer for leads, proposals, delivery, proof, signals; coach-tools → direct service calls; brain executor → services; break circular dependency
- **`docs/decisions/008-phase-3-code-quality-impl.md`** — Shared follow-up service, env centralization, agent prompts in .md, error types, type safety, constants, cron auth
- **`docs/decisions/009-phase-4-route-consolidation-impl.md`** — Delivery project service layer, internal/ops namespace normalization, merge duplicate summaries

## Key Insights

- Builder scaffold (`builder/`) does not support enrichContextUrl; site-builder does. When `BUILDER_API_URL` points to site-builder, the enrich path works. When secret is unset, the scaffold receives full clientInfo and ignores deliveryProjectId/enrichContextUrl.
- Phase 1 (deploy indexes) is a user action; no code change. Run `./scripts/deploy-remote.sh` on VPS.

## Next Steps

- [ ] Run deploy on VPS to apply performance indexes
- [ ] Execute Phase 2–4 per implementation plans (incremental)
