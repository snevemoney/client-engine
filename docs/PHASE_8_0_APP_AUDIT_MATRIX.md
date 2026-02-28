# Phase 8.0 — Tier-A App Audit Matrix

**Purpose:** Reliability audit of critical pages and APIs. Every Tier-A surface must be contracted, observable, resilient, and regression-covered.

**Date:** 2026-02-26

---

## Tier-A Scope

### Pages

| # | Route | Description |
|---|-------|-------------|
| 1 | `/dashboard/command` | Command Center (RiskNBACard, Run Risk/Next Actions) |
| 2 | `/dashboard/scoreboard` | Scoreboard (weekly execution) |
| 3 | `/dashboard/internal/scoreboard` | Operational Score (recompute, trends, factor drilldown) |
| 4 | `/dashboard/risk` | Risk flags, Run Risk Rules, snooze/dismiss |
| 5 | `/dashboard/next-actions` | Next Best Actions, playbook, execute |
| 6 | `/dashboard/copilot/coach` | Coach Mode (send message, CTA execute) |
| 7 | `/dashboard/founder` | Founder dashboard (Today's Plan, Run NBA) |
| 8 | `/dashboard/founder/os` | Founder OS hub |
| 9 | `/dashboard/founder/os/week` | Founder OS week (suggestions, save plan, patterns) |
| 10 | `/dashboard/founder/os/quarter` | Founder OS quarter |
| 11 | `/dashboard/growth` | Growth pipeline, Run Growth NBA, deals |
| 12 | `/dashboard/growth/deals/[id]` | Deal detail (outreach, followups) |

### APIs (minimum)

- **Scores:** summary, history, latest, compute
- **Risk:** list, summary, run-rules
- **Next Actions:** list, summary, run, [id], execute/[id], template, preferences
- **Copilot:** coach, action, sessions
- **Founder:** summary, os/quarter, os/week, suggest
- **Growth:** deals, prospects, outreach draft, send, followups schedule

---

## Page Audit Matrix

| Page | Routes Used | UI States | Mutations | Tests Present | Gaps | Status |
|------|-------------|-----------|-----------|---------------|------|--------|
| **Command Center** `/dashboard/command` | command-center, risk, next-actions/run, scores/summary | loading (Suspense), ready, empty | Run Risk Rules, Run Next Actions | risk-nba.spec.ts (RiskNBACard, run buttons) | Error state `*-error` testid | ⚠️ Partial |
| **Scoreboard** `/dashboard/scoreboard` | ops/scoreboard, planning | loading, ready | — | pages.spec.ts (visit) | No dedicated smoke | ⚠️ Partial |
| **Internal Scoreboard** `/dashboard/internal/scoreboard` | scores/summary, scores/compute, scores/history | loading, empty, ready, error | Recompute | scoreboard.spec.ts (recompute, error intercept) | — | ✅ Covered |
| **Risk** `/dashboard/risk` | risk, risk/summary, risk/run-rules, risk/[id] | loading, empty, ready | Run Risk Rules, Dismiss | risk-nba.spec.ts | Error state testid | ⚠️ Partial |
| **Next Actions** `/dashboard/next-actions` | next-actions, run, [id], execute | loading, empty, ready | Run NBA, playbook execute, dismiss | risk-nba.spec.ts | Error state testid | ⚠️ Partial |
| **Copilot Coach** `/dashboard/copilot/coach` | copilot/coach, coach/action, scores, risk, next-actions | loading, ready | Send message, CTA execute | coach-mode.spec.ts | Error state testid | ⚠️ Partial |
| **Founder** `/dashboard/founder` | founder/summary, next-actions/run | loading, ready | Run Next Actions | founder-mode.spec.ts | Error state testid | ⚠️ Partial |
| **Founder OS** `/dashboard/founder/os` | founder/os/quarter | loading, ready | — | founder-mode.spec.ts | — | ✅ Covered |
| **Founder OS Week** `/dashboard/founder/os/week` | founder/os/week, suggest | loading, ready | Save plan, Generate suggestions | founder-mode.spec.ts, memory.spec.ts | Error state testid | ⚠️ Partial |
| **Founder OS Quarter** `/dashboard/founder/os/quarter` | founder/os/quarter | loading, ready | — | — | No dedicated smoke | ⚠️ Gap |
| **Growth** `/dashboard/growth` | growth/summary, deals, run | loading, empty, ready | Run Growth NBA, Add prospect | growth.spec.ts | Error state testid | ⚠️ Partial |
| **Growth Deal** `/dashboard/growth/deals/[id]` | deals/[id], outreach/draft, send, schedule | loading, ready | Draft, Send, Schedule | growth.spec.ts (flow) | Dedicated deal smoke | ⚠️ Partial |

---

## API Route Contract Matrix

| Route | 401 | 400 | 200 DTO | 500 Sanitized | 429 Retry-After | Cache-Control | route.test.ts |
|-------|-----|-----|---------|---------------|----------------|---------------|---------------|
| **Scores** |
| summary | ❌ | N/A | ❌ | ❌ | N/A | — | ✅ (shape only) |
| history | ❌ | N/A | ❌ | ❌ | N/A | — | ✅ |
| latest | ✅ | N/A | ❌ | ❌ | N/A | — | ✅ |
| compute | ❌ | N/A | ❌ | ❌ | N/A | — | ✅ |
| **Risk** |
| list | ❌ | N/A | ✅ | ❌ | N/A | — | ✅ |
| summary | ❌ | N/A | ✅ | ❌ | N/A | — | ✅ |
| run-rules | ❌ | N/A | ✅ | ✅ | ✅ | — | ✅ |
| [id] PATCH | ❌ | — | — | — | — | — | ✅ |
| **Next Actions** |
| list | ❌ | N/A | ✅ | ❌ | N/A | — | ✅ |
| summary | ❌ | N/A | ✅ | ❌ | N/A | — | ✅ |
| run | ❌ | N/A | ✅ | ✅ | — | — | ✅ |
| [id] | ❌ | N/A | ✅ | ❌ | N/A | — | ✅ |
| execute/[id] | ✅ | N/A | ✅ | ❌ | N/A | — | ✅ |
| template | ✅ | — | ✅ | ✅ | — | — | ✅ |
| preferences | ✅ | — | ✅ | ❌ | — | — | ✅ |
| **Copilot** |
| coach | ✅ | — | ✅ | ✅ | — | — | ✅ |
| action | ✅ | — | ✅ | ✅ | — | — | ✅ |
| sessions | ✅ | N/A | ✅ | ❌ | N/A | — | ✅ |
| **Founder** |
| summary | ✅ | N/A | ✅ | ✅ | N/A | — | ✅ |
| os/quarter | ✅ | N/A | ✅ | ❌ | N/A | — | ✅ |
| os/week | ✅ | N/A | ✅ | ❌ | N/A | — | ✅ |
| os/week/suggest | ✅ | N/A | ✅ | ❌ | N/A | — | ✅ |
| **Growth** |
| deals | ❌ | N/A | ❌ | ✅ | N/A | — | ❌ |
| prospects | ❌ | N/A | ❌ | ✅ | N/A | — | ❌ |
| summary | ❌ | N/A | ❌ | ✅ | N/A | — | ❌ |
| outreach/draft | ✅ | ✅ | ✅ | ❌ | — | — | ✅ |
| outreach/send | ✅ | ✅ | ✅ | ❌ | — | — | ✅ |
| followups/schedule | ✅ | ✅ | ✅ | ❌ | — | — | ✅ |

---

## UI State Audit (No Blank Page)

| Page | loading | empty | ready | error | error testid | Primary action re-enables |
|------|---------|-------|-------|------|-------------|---------------------------|
| Command Center | ✅ Suspense | ✅ RiskNBACard empty | ✅ | ❌ | — | ✅ |
| Internal Scoreboard | ✅ | ✅ score-empty-state | ✅ score-card | ✅ score-error | score-error | ✅ recompute-button |
| Risk | ✅ | ✅ "No risk flags" | ✅ list | ❌ | — | ✅ |
| Next Actions | ✅ | ✅ "No next actions" | ✅ list | ❌ | — | ✅ |
| Copilot Coach | ✅ | N/A | ✅ coach-reply | ❌ | — | ✅ |
| Founder | ✅ | ✅ | ✅ founder-page | ❌ | — | ✅ |
| Founder OS Week | ✅ | ✅ | ✅ founder-os-week | ❌ | — | ✅ |
| Growth | ✅ | ✅ "No deals" | ✅ growth-page | ❌ | — | ✅ |

---

## E2E Smoke Coverage

| Spec | Tier-A Pages Covered | requireSafeE2EBaseUrl | Mutation Guard |
|------|----------------------|------------------------|----------------|
| smoke.spec.ts | — (health, site/leads) | ✅ | ✅ |
| scoreboard.spec.ts | internal/scoreboard | ✅ | ✅ |
| risk-nba.spec.ts | command, risk, next-actions | ✅ | ✅ (skipIfProd) |
| coach-mode.spec.ts | copilot/coach, sessions | ✅ | ✅ |
| founder-mode.spec.ts | founder, founder/os, founder/os/week | ✅ | ✅ |
| memory.spec.ts | founder/os/week | ✅ | ✅ |
| growth.spec.ts | growth | ✅ | ✅ |
| internal-qa.spec.ts | internal/qa/* | ✅ | ✅ |

**Gaps:**
- No dedicated smoke for `/dashboard/founder/os/quarter`
- No dedicated smoke for `/dashboard/scoreboard` (weekly)
- No dedicated smoke for `/dashboard/growth/deals/[id]` (open deal)

---

## Summary

| Category | Pass | Partial | Gap |
|----------|------|---------|-----|
| Page audit | 2 | 10 | 0 |
| API 401 coverage | — | — | 8 routes |
| API 500 sanitized | — | — | 20 routes |
| E2E smoke | 6 specs | — | 3 page gaps |
| UI error states | 1 | 7 | 0 |

**Priority fixes:**
1. Add `*-error` testids and error-state handling to Risk, Next Actions, Copilot, Founder, Growth
2. Add route contract tests for growth/deals, growth/prospects, growth/summary
3. Add 401 tests to routes missing them
4. Add 500 sanitized tests to routes with catch blocks
5. Add E2E smoke for founder/os/quarter, scoreboard (weekly), growth deal page
