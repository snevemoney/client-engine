# Phase 8.0 Go/No-Go Checklist

Release readiness gate. Every item must be green before calling the system production-stable.

---

## P0 — Must Fix Before Prod

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Production migration discipline | DONE | `deploy.sh` uses `prisma migrate deploy`; ADR-003 superseded; all docs updated |
| 2 | Degraded mode platform rule | DONE | Founder summary returns `degraded: true`; ops event logged; UI banner renders; `DegradedBanner` component shared |

## P1 — Should Fix This Sprint

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 3 | ranking.ts action weight audit | DONE | Confirmed intentional (`mark_done` is global proxy); comment added; unit test added (10/10 pass) |
| 4 | requireAuth infrastructure failure | DONE | `auth.infrastructure_error` ops event emitted on `auth()` throw; distinguishes broken infra from normal 401 |
| 5 | Bounded-context architecture doc | DONE | `docs/BOUNDED_CONTEXTS.md` — 9 domains + cross-cutting; referenced from ARCHITECTURE.md |
| 6 | AI Stack Doctrine | DONE | `docs/AI_STACK_DOCTRINE.md` — four-layer hierarchy, Client Engine mapping, anti-patterns |
| 7 | Tier-A API contract suite | DONE | `docs/API_CONTRACTS.md` — response shapes, error shapes, header policies, test checklist; 15 new Growth route tests |
| 8 | Env truth + release discipline | DONE | `docs/RELEASE_DISCIPLINE.md` — deploy flow, env var truth, rollback; VPS checklist updated |
| 9 | Revenue hardening (Growth) | DONE | `docs/GROWTH_GOLDEN_SCENARIOS.md` — 5 golden scenarios, test coverage matrix, revenue protection rules |

## P2 — Refactor When Capacity Allows

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 10 | Explicit degraded/error states | DONE | Shared `DegradedBanner` component; Founder + Growth pages render it; pattern established |
| 11 | Phase 8.0 Go/No-Go doc | DONE | This document |

---

## Dependency Flow (Verified)

```
1. Migration discipline ──→ 3. ranking audit
                        ──→ 7. Tier-A API contracts
                        ──→ 8. Env + release discipline

2. Degraded mode rule ──→ 4. requireAuth ops event
                      ──→ 7. Tier-A API contracts
                      ──→ 10. UI error states

5. Bounded-context doc ──→ 6. AI Stack Doctrine

6. AI Stack Doctrine ──→ 7. Tier-A API contracts

7. Tier-A API contracts ──→ 9. Revenue hardening

8. Env + release discipline ──→ 11. Go/No-Go doc
9. Revenue hardening ──→ 11. Go/No-Go doc
10. UI error states ──→ 11. Go/No-Go doc
```

---

## What This Phase Accomplished

**Planning around trust, structure, and release readiness** — not features.

1. **Deploy stabilization** — `migrate deploy` replaces `db push --accept-data-loss` in production
2. **Platform failure behavior** — degraded mode is a first-class concept with API contract, ops events, and UI rendering
3. **Architectural boundaries** — 9 bounded contexts documented with models, routes, services, invariants
4. **AI doctrine** — four-layer hierarchy codified (AI → Context → Intent → Prompt)
5. **Contract lock** — response shapes, error shapes, sanitization rules standardized
6. **Revenue path hardened** — Growth engine golden scenarios documented and tested
7. **Release gates** — deploy flow, env truth, rollback procedure, smoke checks documented

---

## What Remains (Next Phase)

- Extend degraded mode to remaining dashboard pages (command center, scoreboard, next-actions)
- Add 500 sanitization tests to the ~15 routes still missing them
- Extend E2E auth spec to cover Copilot, Founder, Growth internal routes
- Consider stricter sanitizer (strip IPs, connection strings, not just tokens)
- Phase 8.1: Monitoring and alerting (ops event dashboards, alert thresholds)
