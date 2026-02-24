# App Speed and Usability Checklist

**Long-term operator checklist for speed/UX issues across the whole app.** Includes runtime speed and deploy/build speed.

---

## 1. Symptoms → Possible Causes

| Symptom | Possible Causes |
|---------|-----------------|
| **Slow page navigation** | SSR, heavy DB queries, unbounded `findMany`, missing `select`, no caching |
| **Slow actions** | API timeout, DB lock, external API (OpenAI, Meta), N+1 queries |
| **Stale data** | No revalidation, cache TTL too long, client not refetching |
| **Long loading** | Large payloads, unoptimized images, many parallel fetches |
| **Deploy slowness** | Docker build context large, `npm ci` on VPS, no layer caching |
| **Knowledge page timeout** | Heavy ingest query, many artifacts, no limit |
| **Command center lag** | 20+ parallel fetches, Section2 waterfall |

---

## 2. How to Check

### App runtime speed

| Check | Command / Page |
|------|----------------|
| **Homepage TTFB** | `curl -s -o /dev/null -w "TTFB: %{time_starttransfer}s\n" https://evenslouis.ca/` |
| **API health** | `curl -s https://evenslouis.ca/api/health` |
| **Lead list** | Navigate to `/dashboard/leads` |
| **Lead detail** | Open any lead; watch `/api/leads/[id]` |
| **Command center** | Navigate to `/dashboard/command`; check Section1 vs Section2 |
| **Knowledge page** | Navigate to `/dashboard/knowledge` (known slow) |
| **Meta Ads** | Navigate to `/dashboard/meta-ads`; click Refresh |
| **Log review** | `docker compose logs app 2>&1 | grep -E '\[SLOW\]|\[api:error\]'` |

### Deploy / build speed

| Check | Command |
|------|---------|
| **Docker build time** | `time docker compose build app` |
| **Context size** | `docker build --no-cache ...` and check transfer |
| **npm ci** | `time npm ci` (local or in Dockerfile) |
| **Prisma generate** | `time npx prisma generate` |
| **Next build** | `time npm run build` |

---

## 3. What "Good" Looks Like

| Metric | Target |
|--------|--------|
| Homepage TTFB (cached) | < 1s |
| API routes (simple) | < 500ms |
| Lead detail load | < 2s |
| Command center first paint | < 3s |
| Knowledge page | < 10s (or add skeleton) |
| Docker build (incremental) | < 5 min |
| npm ci | < 2 min |

---

## 4. When to Fix in Code vs Infra

| Issue | Fix in Code | Fix in Infra |
|-------|-------------|--------------|
| Unbounded queries | ✅ Add `take`, `limit` | — |
| Heavy `include` | ✅ Add `select`, paginate | — |
| No caching | ✅ ISR, `revalidate` | — |
| Slow external API | ✅ Timeout, retry, cache | — |
| DB connection exhaustion | — | ✅ Connection pooling, `?connection_limit=5` |
| VPS resource limits | — | ✅ More RAM, CPU |
| Docker build slow | ✅ `.dockerignore`, multi-stage | ✅ CI build, pull image |
| npm ci slow | ✅ Lockfile, cache layer | ✅ Pre-built image |

---

## 5. Prioritized Speed Backlog

| Priority | Item | Notes |
|----------|------|-------|
| P1 | Knowledge page loading skeleton | UX; page known slow |
| P1 | Reduce Knowledge artifacts limit | e.g. 20 instead of 50 |
| P2 | Lead detail: paginate artifacts/touches | Heavy include |
| P2 | Dashboard cards: add `select` | Reduce over-fetch |
| P2 | Build in CI, pull on VPS | Avoid npm ci on VPS |
| P3 | Connection pooling | `?connection_limit=5` in DATABASE_URL |
| P3 | Lazy-load non-critical cards | UX decision |

---

## 6. Daily Speed Sanity Check (2 min)

- [ ] Open `/dashboard/command` — loads without long blank
- [ ] Open one lead — detail loads
- [ ] `curl -s https://evenslouis.ca/api/health` → 200
- [ ] Check logs: `grep '\[SLOW\]'` — any new slow paths?

---

## 7. Before Client Demo Check (5 min)

- [ ] Homepage loads quickly
- [ ] Login works
- [ ] Command Center renders
- [ ] Lead list + one lead detail
- [ ] Proposals page
- [ ] Meta Ads (if configured)
- [ ] No `[SLOW]` in recent logs for critical paths
- [ ] Health returns `ok: true`

---

## 8. Instrumentation Reference

| Area | File | Threshold |
|------|------|------------|
| API routes | `src/lib/api-utils.ts` `withRouteTiming` | > 500ms |
| Prisma | `src/lib/db.ts` `$extends` | > 300ms |
| Dashboard | `CommandSection1`, `CommandSection2` | > 1000ms |

**Log format:** `[SLOW] area=api name=GET /api/leads ms=523`

---

## 9. References

- [docs/PERFORMANCE_TRIAGE.md](./PERFORMANCE_TRIAGE.md)
- [docs/PERFORMANCE_HARDENING_ROUND2.md](./PERFORMANCE_HARDENING_ROUND2.md)
- [docs/PROD_OPERATOR_LOOP.md](./PROD_OPERATOR_LOOP.md)
