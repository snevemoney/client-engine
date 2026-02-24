# Performance Triage Summary

**Date:** 2025-02  
**Scope:** Whole-app performance instrumentation, public pages, API/DB observability, Docker build context.

---

## 1. What was measured

| Area | Instrumentation | Threshold |
|------|-----------------|-----------|
| **API routes** | `withRouteTiming` | > 500ms → `[SLOW] area=api name=<route> ms=<n>` |
| **Prisma queries** | `$extends` on db | > 300ms → `[SLOW] area=db name=<model>.<op> ms=<n>` |
| **Dashboard SSR** | `CommandSection1` / `CommandSection2` | > 1000ms → `[SLOW] area=page name=... ms=<n>` |

**Log format (grep-friendly):**
```
[SLOW] area=api name=GET /api/leads ms=523
[SLOW] area=db name=Lead.findMany ms=412
[SLOW] area=page name=/dashboard/command Section2 ms=2100
```

---

## 2. Top bottlenecks (ranked, with evidence)

From prior analysis and deploy logs:

| Rank | Bottleneck | Evidence | Status |
|------|------------|----------|--------|
| 1 | Public pages `force-dynamic` (every request = SSR + DB) | Homepage TTFB ~0.8–1.8s | **Fixed** (ISR 60s) |
| 2 | Project images `unoptimized` | Full-size screenshots on /work/[slug] | **Fixed** |
| 3 | `/work` unbounded `findMany` | Grows with project count | **Fixed** (`take: 50`) |
| 4 | API routes lack timing | Only leads + ops/command had timing | **Fixed** (12+ routes) |
| 5 | Prisma slow queries invisible | No query-level logging | **Fixed** (extension) |
| 6 | Docker build context large | 79MB transfer, npm ci ~21min on VPS | **Mitigated** (.dockerignore) |
| 7 | Dashboard command heavy SSR | Many parallel fetches, no timing | **Instrumented** |

---

## 3. Fixes implemented

### Phase 1 — Instrumentation

- **`src/lib/perf.ts`** — Central `logSlow(area, name, ms, details?)` and `withTiming` helpers.
- **`src/lib/api-utils.ts`** — `withRouteTiming` now uses `logSlow` and 500ms threshold.
- **`src/lib/db.ts`** — Prisma `$extends` logs queries > 300ms.
- **API routes with `withRouteTiming`:**  
  `GET/POST /api/leads`, `GET /api/ops/command`, `GET/PATCH/DELETE /api/leads/[id]`,  
  `POST /api/ops/chat`, `GET /api/brief`, `POST /api/pipeline/run`, `POST /api/research/run`,  
  `GET /api/proof`, `GET /api/knowledge`.
- **Dashboard:** `CommandSection1` and `CommandSection2` log slow section render (> 1000ms).

### Phase 2 — Public pages (previous session)

- **`/`, `/work`, `/work/[slug]`** — `revalidate = 60` (ISR).
- **Project images** — Removed `unoptimized` from screenshots.
- **`/work`** — Added `take: 50` to projects query.

### Phase 5 — Docker build context

- **`.dockerignore`** — Added: `test-results`, `playwright-report`, `.cursor`, `coverage`, `*.log`, `dist`, `.env.*` to reduce context size.

---

## 4. Remaining bottlenecks / next backlog

| Item | Notes |
|------|-------|
| Dashboard query `select` optimization | Many fetches use `include`; add `select` where full objects not needed. |
| `/api/leads/[id]` heavy include | artifacts, touches, referrals — consider pagination or lazy load. |
| Build image in CI, pull on VPS | Move `npm ci` + `next build` to GitHub Actions; VPS pulls pre-built image. |
| Connection pooling | Add `?connection_limit=5` to `DATABASE_URL` if not set. |
| Lazy-load non-critical dashboard cards | UX decision on what is "critical". |

---

## 5. Performance Smoke Checklist (5–10 min)

After deploy or local prod build:

- [ ] **Homepage** — `curl -s -o /dev/null -w "TTFB: %{time_starttransfer}s\n" https://evenslouis.ca/` — expect < 1s on cache hit.
- [ ] **Work page** — Navigate to `/work`, verify projects load, images optimized.
- [ ] **Dashboard login** — Log in, navigate to `/dashboard/command`.
- [ ] **Command center** — Section1 appears first, Section2 streams in. Check logs for `[SLOW]` (grep or `npm run ops:logs`).
- [ ] **API health** — `curl -s https://evenslouis.ca/api/health` → 200, `ok: true`.
- [ ] **Lead detail** — Open a lead from dashboard, verify `/api/leads/[id]` responds.
- [ ] **Chat** — Send one message in ops chat, verify response.

**Log review (on VPS):**
```bash
docker compose logs app 2>&1 | grep -E '\[SLOW\]|\[api:error\]'
```

---

## 6. Env vars / deploy notes

- No new env vars.
- Apply DB indexes if not yet done: `npx prisma db push`.
- `.dockerignore` changes reduce context; first build after change may still be full.
