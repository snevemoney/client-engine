# Production Hardening Pass — Summary

**Date:** 2025-02  
**Scope:** Full codebase. Constraints: no removal of stubs/roadmap, no business logic changes, no prod breakage.

---

## 1. Dead code removed

| Item | Action |
|------|--------|
| `POST /api/copilot/lead/[id]` | **Removed.** Legacy route; app uses `POST /api/leads/[id]/copilot`. |
| `FollowUpsDueCard.tsx` | **Removed.** Unused; never imported. |
| `RecentIssuesCard.tsx` | **Removed.** Unused; never imported. |

**Updated:** `docs/AUDIT_AND_TEST_FLOWS.md` — removed legacy copilot from API list.

---

## 2. Docs archived

Moved to `docs/archive/` (overlapping planning/sprint docs):

- `PBD_SALES_OPERATING_SYSTEM_IMPLEMENTATION_PLAN.md`
- `PBD_SALES_STAGES_AUDIT.md`
- `PRODUCTION_UNDENIABLE_SPRINT.md`
- `OPERATOR_APP_BUILD_PLAN.md`
- `NEXT_R1.md`

---

## 3. API route hardening

### New shared utilities (`src/lib/api-utils.ts`)

- **`jsonError(message, status, code?)`** — Standard error shape `{ error, code? }`.
- **`requireAuth()`** — Session check; use with `jsonError("Unauthorized", 401)` when null.
- **`withRouteTiming(routeLabel, handler)`** — Wraps handler; logs slow routes (>1000ms) as `[api:slow]`.

### Applied to

- **GET/POST /api/leads** — `withRouteTiming`, `jsonError`, Zod validation on POST, pagination `take: limit` (default 500) on GET.
- **GET /api/ops/command** — `withRouteTiming`, `jsonError`.

### Validation added

- **POST /api/leads** — `PostLeadSchema` (title required 1–500 chars, source/sourceUrl/description/budget/timeline/platform/contactName/contactEmail/tags with bounds).

---

## 4. Performance improvements

| Change | Location |
|--------|----------|
| Pagination cap | GET /api/leads — `take: limit` (max 500); query param `?limit=N` supported. |
| Error log context | POST /api/leads pipeline run — `[api:error] POST /api/leads pipeline run failed`, `{ leadId }`. |

**Not applied (to avoid risk in this pass):** Shared read-model loaders, TTL caching, further parallelization. Consider in a follow-up.

---

## 5. Database indexes

**Added to `prisma/schema.prisma`** — run `npx prisma db push` (or migrate) to apply.

| Model | Indexes |
|-------|---------|
| **Artifact** | `@@index([leadId])`, `@@index([leadId, createdAt])` |
| **PipelineRun** | `@@index([leadId])`, `@@index([leadId, startedAt])` |
| **Lead** | `@@index([status])`, `@@index([createdAt])`, `@@index([source])` |

---

## 6. Observability

- **Slow route logging:** `withRouteTiming` logs `[api:slow] <route> took <ms>ms` when >1000ms.
- **Error logging:** Standardized `[api:error]` prefix with route + context where applied.

---

## 7. Manual steps for deploy

1. **Apply DB indexes:**
   ```bash
   npx prisma db push
   ```
   Or, if using migrations: `npx prisma migrate dev --name add-perf-indexes` then deploy.

2. **Verify:** Health check `GET /api/health` returns 200 and `ok: true` with all checks.

3. **Smoke:** Run `./scripts/smoke-test.sh https://evenslouis.ca` post-deploy.

---

## 8. Risky / not applied

| Item | Reason |
|------|--------|
| TTL caching | Cache invalidation risk; needs product review. |
| Shared read-model loaders | Requires architectural change; more testing. |
| Frontend memoization pass | Risk of subtle render bugs; prefer targeted fixes. |
| Lazy-load non-critical panels | Needs UX/product input on what is “critical”. |
| Further API validation rollout | Applied to leads only; other routes can follow incrementally. |

---

## 9. Test impact

- **api-auth.spec.ts** — No test for `POST /api/copilot/lead/[id]`; legacy route removed.
- **E2E** — All flows (login, leads, proposals, proof, etc.) unchanged.
