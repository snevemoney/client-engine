# Session: Full Tech Debt Remediation

**Date:** 2026-03-03  
**Goal:** Implement all items from the Full Tech Debt Remediation Plan (adapted from TECH_DEBT_AUDIT).

## Decisions

- **S1:** Added `requireLeadAccess`, `requireProposalAccess` (requireDeliveryProject already existed). Single-tenant: auth + resource exists; no ownership field.
- **S3:** Extend rate limiting via `checkStateChangeRateLimit` to capture, enrich, score, leads CRUD, proposals, delivery-projects.
- **S4:** Health endpoint: unauthenticated → minimal { ok } (DB ping only); Bearer or session → full checks.
- **C1:** safeParseJSON now has try-catch + optional Zod; migrated 5 LLM parse sites.
- **I3:** env-validate.ts + instrumentation.ts; validate DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL at startup.
- **A2/A4:** Extracted step handlers to src/lib/pipeline/steps.ts; orchestrator loads lead once, passes mutable current.
- **A5:** Builder deploy when Redis: queue BullMQ job, return 202 + jobId; poll GET .../deploy/status?jobId=; fallback sync when no Redis.
- **I7:** deploy scripts use `prisma migrate deploy`; migration workflow documented.
- **O3:** Replaced hardcoded IP with DEPLOY_SERVER / YOUR_VPS_IP; scripts require DEPLOY_SERVER env.

## What Was Built

- 16 plan items completed across 5 phases
- New files: env-validate.ts, instrumentation.ts, pipeline/steps.ts, builder/deploy-queue.ts, ops-events/structured-log.ts, truncate-error.ts
- New routes: GET .../builder/deploy/status
- New worker: builder-deploy BullMQ processor
- Updated: deploy scripts, backup.sh, docker-compose.yml, Dockerfile, ARCHITECTURE.md, RUNBOOK.md, VPS_DEPLOY_CHECKLIST.md

## Insights

- Instrumentation runs before server handles requests; env validation fails fast.
- Worker healthcheck uses `kill -0 1` (process alive) since worker has no HTTP.
- App healthcheck needs wget; added to runner stage.
- O3: Using YOUR_VPS_IP as default forces users to set DEPLOY_SERVER (no IP in repo).

## Next Steps

- [ ] S5: CSRF protection (SameSite=Strict, Origin/Referer check)
- [ ] C4: Extract magic numbers to constants
- [ ] C2: No catch(err: any) found; skip
- [ ] Verify production deploy with new migration workflow
