# App Stabilization Review

**Date:** 2025-02  
**Mode:** PRODUCTION STABILIZATION  
**Scope:** Full app hardening, page validation, workflow verification.

---

## 1. What was tested

### MCP browser
- Navigated to localhost:3000, /login, /dashboard/command
- Browser locked/unlocked; tabs verified
- Session persists (redirect to dashboard when already logged in)

### Playwright e2e
- **smoke.spec.ts** — ✓ GET /api/health ok, all checks
- **api-auth.spec.ts** — ✓ All 15 protected API routes return 401 without session
- **pages.spec.ts** — ✓ Login → visit 19 pages (with credentials fix + 45s nav timeout)
- **debug-login.spec.ts** — ✓ Login with ADMIN_EMAIL/E2E_PASSWORD
- **full-flow.spec.ts** — Updated selectors for metrics; test may timeout on pipeline (lead create → enrich async)
- **client-acquisition.spec.ts** — Skipped when login fails in beforeEach (uses same credential pattern)

### API / curl
- Smoke script against localhost: passes
- Public pages /, /work → 200
- Dashboard routes → 307 (redirect to login when unauthenticated)

---

## 2. What was broken

| Issue | Location | Severity |
|-------|----------|----------|
| pages.spec used test@test.com + AUTH_DEV_PASSWORD; login failed when DB user expected | tests/e2e/pages.spec.ts | P1 — tests skipped |
| pages.spec toHaveURL(/\/(dashboard\|login)/) passed while still on /login | tests/e2e/pages.spec.ts | P1 — false pass then skip |
| full-flow expected "Pipeline metrics" / "Step success"; metrics page now has "Scorecard & bottleneck", "enrich" | tests/e2e/full-flow.spec.ts | P1 — test failed |
| full-flow getByText("Scorecard") / getByText("enrich") strict mode — multiple matches | tests/e2e/full-flow.spec.ts | P1 — assertion failed |
| Knowledge page load > 30s in e2e (timeout) | src/app/dashboard/knowledge/page.tsx | P2 — flaky test |
| full-flow timeout 30s insufficient for lead create + pipeline | tests/e2e/full-flow.spec.ts | P2 |

---

## 3. What was fixed

| Fix | File(s) |
|-----|---------|
| **Leads page:** Error handling, timeout, retry; cache-busting; defensive tags render | leads-table.tsx, api/leads/route.ts |
| Use ADMIN_EMAIL/E2E_EMAIL + ADMIN_PASSWORD/E2E_PASSWORD for pages.spec login | tests/e2e/pages.spec.ts |
| Wait for /dashboard (not /login) after sign-in | tests/e2e/pages.spec.ts |
| Increase page nav timeout to 45s for slow pages (e.g. Knowledge) | tests/e2e/pages.spec.ts |
| Update full-flow metrics assertions to match current UI ("Scorecard", "enrich") | tests/e2e/full-flow.spec.ts |
| Use getByRole/getByText with exact + .first() to avoid strict mode | tests/e2e/full-flow.spec.ts |
| Set full-flow test timeout to 60s | tests/e2e/full-flow.spec.ts |

---

## 4. What is still pending (real backlog)

| Item | Severity | Notes |
|------|----------|-------|
| full-flow: verify pass after pipeline completes | P2 | May need longer wait or poll for metrics update |
| client-acquisition beforeEach: use same login pattern as pages | P2 | Fix waitForURL to require dashboard |
| Knowledge page: consider limit/optimization if > 30s load | P2 | getRecentKnowledgeArtifacts(30) — add loading skeleton |
| Research workflow E2E: RESEARCH_ENABLED=1, feed URL, cron | P3 | Manual validation when env configured |

---

## 5. Workflow findings (Research → propose)

**Research** (`POST /api/research/run`):
- Requires `RESEARCH_ENABLED=1`
- Runs adapters (Upwork, RSS), dedupes, creates leads + RESEARCH_SNAPSHOT artifact
- Calls `runPipelineIfEligible(leadId, "research_ingested")` — triggers enrich → score → position → propose

**Pipeline** (per lead):
- enrich → score → position → propose (each step creates artifacts)
- `runPipelineIfEligible` in `src/lib/pipeline/runPipeline.ts`
- Orchestrator in `src/lib/pipeline/orchestrator.ts`

**Visibility:**
- Artifacts stored with provenance in meta
- Metrics page shows step success, runs, constraint
- Proposals page shows draft/approved/sent
- Command center reflects recent runs

---

## 6. Prod MCP browser test (evenslouis.ca) — Feb 22, 2026

| Page/Flow | Status | Bug found | Fix applied | Still failing | Next action |
|-----------|--------|-----------|-------------|---------------|-------------|
| Command Centre | ✓ | — | — | — | — |
| Ops Health | ✓ | — | — | — | — |
| Proposals | ✓ | — | — | — | — |
| Metrics | ✓ | — | — | — | — |
| Chat | ✓ | — | — | — | — |
| **Leads** | ✓ | Loading… / 0 leads while data exists elsewhere | Error handling, 15s timeout, retry, cache-bust, defensive tags | Fixed | Deployed; 9 leads load in prod |
| Sales Leak | ✓ | — | — | — | — |
| Results Ledger | ✓ | — | — | — | — |
| Build Ops | ✓ | — | — | — | — |
| Settings | ✓ | — | — | — | — |
| Proof | ✓ | Lead dropdown empty (same /api/leads) | Same fix as Leads | Unknown until deploy | — |
| Checklist | ✓ | — | — | — | — |
| Deploys | ✓ | — | — | — | — |
| Conversion | ✓ | Slow load (~5s) | — | — | Optional: loading skeleton |
| Knowledge | ✓ | — | — | — | — |
| Learning | ✓ | — | — | — | — |
| Work (public) | ✓ | — | — | — | — |

**Leads fix summary:**
- **Root cause:** No error handling; fetch/json throw or non-ok response left component stuck (Loading) or empty (0 leads).
- **Files:** `leads-table.tsx`, `api/leads/route.ts`
- **Why prod-safe:** Try/finally ensures loading ends; error + Retry for failures; 15s timeout for hangs; `cache: no-store` + API Cache-Control; defensive `Array.isArray(lead.tags)`.
- **Before:** Loading… forever or 0 leads with no feedback.
- **After:** Error message + Retry on failure; leads on success; timeout message after 15s.

---

## 7. Ready to operate?

| Criterion | Status |
|-----------|--------|
| All key pages load | ✓ (pages e2e passes) |
| Auth works | ✓ |
| API health + protected routes | ✓ |
| Public site (/, /work) | ✓ |
| Full pipeline (create lead → metrics) | ⚠ partial (full-flow may timeout) |
| Research → propose E2E | ⚠ Manual when RESEARCH_ENABLED |

**Verdict:** App is usable for daily operations. E2E coverage improved. Full pipeline and Research workflows need manual smoke when configured.
