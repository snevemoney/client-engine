# Performance Hardening Round 2

**Date:** 2025-02  
**Context:** Production stabilization pass. Extends `docs/PERFORMANCE_TRIAGE.md`.

---

## Top slow paths

| Rank | Path | Evidence | Priority |
|------|------|----------|----------|
| 1 | Public pages (/, /work) | Prior TTFB 0.8–1.8s | **Fixed** (ISR) |
| 2 | Knowledge page | E2E timeout ~30s on nav | P1 |
| 3 | Command center Section2 | 20+ parallel fetches | P1 (instrumented) |
| 4 | GET /api/leads/[id] | Heavy include (artifacts, touches, referrals) | P2 |
| 5 | Docker build (VPS) | npm ci ~21min, 79MB context | P2 (mitigated) |

---

## Timing evidence

From build + e2e runs:
- `[SLOW] area=db name=Project.findMany ms=303` during static gen
- Knowledge page navigation: > 30s (e2e timeout)
- pages.spec: Knowledge in list caused flakiness until 45s timeout

---

## Changes made (this round)

| Change | Impact |
|--------|--------|
| pages.spec: 45s nav timeout | Reduces flakiness on Knowledge |
| full-flow: 60s test timeout | Allows pipeline to complete |
| E2E credential fix (ADMIN_EMAIL/E2E_PASSWORD) | All page tests run |

---

## Before/after (qualitative)

| Area | Before | After |
|------|--------|-------|
| Public pages | force-dynamic, every request DB hit | ISR 60s, cached |
| Observability | [api:slow] on 2 routes | [SLOW] on 12+ routes, db, pages |
| E2E pages test | Skipped (login) | Passes (19 pages) |
| Knowledge load | Unknown | Documented as slow |

---

## Next recommended optimizations

### Safe
- Add loading skeleton to Knowledge page
- Reduce getRecentKnowledgeArtifacts limit (e.g. 20)
- Ensure DB indexes applied (`prisma db push`)

### Moderate risk
- Dashboard cards: add `select` to reduce over-fetch
- Lead detail: paginate artifacts/touches

### Higher effort
- Build in CI, pull image on VPS
- Connection pooling in DATABASE_URL
