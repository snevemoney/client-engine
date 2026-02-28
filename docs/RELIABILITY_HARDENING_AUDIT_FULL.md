# Reliability Hardening Audit — Full Report

**Date:** 2026-02-26  
**Scope:** 80+ pages, 250+ handler-level gaps, 8 cross-page intelligence sharing gaps  
**Complements:** [PHASE_8_0_APP_AUDIT_MATRIX.md](./PHASE_8_0_APP_AUDIT_MATRIX.md) (Tier-A API/route focus)

---

## Summary

| Category | Count |
|----------|-------|
| Handler reliability gaps | 250+ |
| Cross-page intelligence gaps | 8 |
| Best-practice reference | Founder Mode unified endpoint |

---

## Best-Practice Pattern: Founder Mode

**Reference:** `GET /api/internal/founder/summary`

**What it does:**
- Single server-side `Promise.all` of 12+ queries (score, risk, NBA, pipeline, copilot actions, job runs)
- Returns one aggregated DTO per request
- Uses `withSummaryCache` for entity-scoped caching
- Client makes **one fetch** instead of many parallel client fetches

**Why it works:**
- No waterfall: all data in one round-trip
- Server can optimize query batching
- Single auth check, single cache key
- Consistent error handling via `withRouteTiming` + `sanitizeErrorMessage`

**Implementation:** `src/app/api/internal/founder/summary/route.ts`

---

## Replication Target: Unified Domain Endpoints

Replicate the Founder Mode pattern for these domains:

| Domain | Current State | Target Endpoint | Aggregates |
|--------|---------------|----------------|------------|
| **Growth** | Multiple fetches (deals, prospects, summary, NBA run) | `GET /api/internal/growth/context` | Deals summary, prospects count, NBA founder_growth top 5, risk flags for growth rules |
| **Delivery** | Scattered fetches per page | `GET /api/internal/delivery/context` | Handoff queue, retention gaps, risk flags (handoff_no_client_confirm), NBA actions for delivery scope |
| **Retention** | Per-page fetches | `GET /api/internal/retention/context` | Overdue retention, risk flags (retention_overdue), NBA actions, follow-up schedule summary |
| **Leads** | Leads page + [id] each fetch separately | `GET /api/internal/leads/context` | Pipeline snapshot, risk flags (stage_stall, referral_gap), NBA top for leads scope, won-no-delivery count |

---

## Cross-Page Intelligence Gaps

Computed signals that exist but are not surfaced where operators need them:

| Signal | Computed In | Used In | Missing From |
|--------|-------------|---------|--------------|
| `retention_overdue` | NBA + Risk | Risk page | Retention page |
| `handoff_no_client_confirm` | NBA + Risk | Risk page | Delivery page |
| `proposals_sent_no_followup_date` | NBA | NBA rules | Proposals page |
| `stage_stall`, `referral_gap` | NBA | NBA rules | Leads page |
| `growth_overdue_followups`, `growth_no_outreach` | NBA | NBA rules | Growth page |
| Operator memory weights | Memory system | NBA ranking (internal) | All pages — never exposed |
| Pattern alerts | Memory system | `/api/internal/memory/run` | All pages — never surfaced |

**Fix:** Unified context endpoints per domain (above) should include these signals in their aggregate.

---

## Handler Reliability — Priority Tiers

### P0 — Data loss / broken flows
- Add try/catch to every `fetch` + `.json()` call (~40 instances)
- **ScoreboardView.tsx** — 16 unprotected parallel fetches
- **growth/deals/[id]** — zero error handling on handlers
- **proposals/[id]** — `window.location.reload()` loses state
- **reminders** — optimistic update without rollback

### P1 — UX / race conditions
- Confirmation dialogs for destructive actions (~35 instances)
- Debounce on mutation-triggering buttons and filters (~30 instances)
- Replace `alert()` / `confirm()` / `prompt()` with component equivalents

### P2 — Intelligence sharing
- Implement unified context endpoints (Growth, Delivery, Retention, Leads)
- Surface NBA/risk signals on domain pages
- Unify Coach Mode context fetch (currently 3 separate fetches)

### P3 — Resilience
- Retry with exponential backoff utility
- Global error boundary per dashboard section
- Request deduplication for rapid clicks

---

## Implementation Order

1. **Create unified endpoints** for Growth, Delivery, Retention, Leads (mirror founder/summary structure)
2. **Refactor domain pages** to consume single context fetch instead of multiple
3. **Add handler hardening** (try/catch, loading, debounce) to Tier-A pages first (see Phase 8.0 matrix)
4. **Wire intelligence** — ensure each unified endpoint includes NBA + risk signals for its domain

---

## Related Docs

- [PHASE_8_0_APP_AUDIT_MATRIX.md](./PHASE_8_0_APP_AUDIT_MATRIX.md) — Tier-A pages, API contracts, E2E coverage
- [PHASE_8_0_TIER_A_CONTRACTS.md](./PHASE_8_0_TIER_A_CONTRACTS.md) — Response shapes, error invariants
- [docs/releases/phase-8.0-go-no-go.md](./releases/phase-8.0-go-no-go.md) — Pass counts, GO gate
