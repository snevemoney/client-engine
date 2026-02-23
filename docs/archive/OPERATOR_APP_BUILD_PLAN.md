# Operator App Build Plan — Acquire / Deliver / Improve

**Context:** Private operator app for freelance → productization. Single user. Non-negotiables: no auto-send, no auto-build; human owns positioning, proposal, send, build.

**Layers:** A = Revenue-critical (leads, proposals, follow-up, delivery, outcomes). B = Optimization (learning, analytics). C = Experimental. Failures in B/C must not break A.

---

## 1. Audit — Where features fit

| Priority | Feature | Current location | Gap / action |
|----------|---------|------------------|--------------|
| **1** | Ops Health (single panel) | Scattered: FailuresInterventionsCard, WorkdayRunCard, ConstraintCard, metrics | **New:** Single `/dashboard/ops-health` page + `getOpsHealth()` aggregating workday run, failed jobs 24h/7d, stale leads, stuck proposals, approval queue, integration health, failures/interventions + recommended action. |
| **2** | Sales Leak Dashboard | `getSalesLeakReport()`, SalesLeakCard on Command Center | **Extend:** New page `/dashboard/sales-leak` with full stage metrics, conversion rates, leak detection per stage with editable benchmarks + evidence. Optionally store benchmarks in OperatorSettings or small table. |
| **3** | Results Ledger | ClientSuccessCard, ClientResultsGlance, `/api/leads/[id]/client-success` | **New:** Page `/dashboard/results` listing APPROVED/BUILDING/SHIPPED with target, baseline, current, delta, interventions, proof, what worked/didn't, next action. Extend client-success types for currentResult, delta, whatWorked, whatFailed, outcomeConfidence, nextActionRecommendation. |
| **4** | Reusable Asset Log | DB ReusableAssetLog, ReusableAssetLogCard, API `/api/leads/[id]/reusable-assets` | **Extend:** Add reusabilityScore (1-5), whereStored; asset types prompt_pattern, sales_script; "Can productize?" yes/no/maybe. Summary metrics: assets this week/month, % delivered with assets, top types. |
| **5** | Learning → Action | Learning ingest, proposals, promotedToPlaybook, producedAssetType | **Extend:** Source type/quality, category tags, contradiction detection, proposed action type, "Produced revenue asset?" + rollback note. Tighten pipeline: summarize → extract → compare playbooks → propose → human approve → apply. |
| **6** | Chat with receipts | `/api/ops/chat` with cite + Inferring + Data missing | **Extend:** Require structured receipts block (Facts / Inferred / Missing); cite workday brief, scorecard, sales leak, results ledger, run status. |
| **7** | Offer ladder + Expectation | — | **New:** Lead.offerType (fast_cash / productized / premium_custom). Expectation module: artifact or meta with clientRequestedOutcome, realisticRange, riskFlags, underAsking, overAsking, whatTheyNeed, responseScript. Client expectation simulator playbook (rules-based UI). |

---

## 2. Phases

### Phase 1 — Ops Health + Sales Leak + Results Ledger (revenue visibility)
- **1.1** Ops Health: `src/lib/ops/opsHealth.ts` + `/dashboard/ops-health` page + nav.
- **1.2** Sales Leak Dashboard: extend `getSalesLeakReport()` or add `getSalesLeakDashboard()`; `/dashboard/sales-leak` page; benchmarks in settings or DB.
- **1.3** Results Ledger: extend client-success types/API; `/dashboard/results` page; optional Lead.offerType.

### Phase 2 — Reusable assets + Learning → Action (leverage)
- **2.1** Reusable Asset Log: schema + API + UI extensions; summary metrics.
- **2.2** Learning pipeline: source type/quality, categories, contradictions, action type, produced-asset + rollback.

### Phase 3 — Chat receipts + Offer ladder + Expectation (operator discipline)
- **3.1** Chat: receipts block + citations.
- **3.2** Offer ladder: Lead.offerType + UI.
- **3.3** Expectation module: artifact/meta + simulator playbook UI.

---

## 3. Files to create or modify (Phase 1)

### Ops Health ✅ Implemented
| Action | File |
|--------|------|
| Create | `src/lib/ops/opsHealth.ts` — getOpsHealth() |
| Create | `src/app/dashboard/ops-health/page.tsx` — single panel |
| Create | `src/components/dashboard/ops-health/OpsHealthPanel.tsx` — UI |
| Create | `src/components/dashboard/command/OpsHealthGatewayCard.tsx` — gateway on Command Center |
| Modify | `src/components/dashboard/sidebar.tsx` — nav link "Ops Health" |
| Modify | `src/app/dashboard/command/page.tsx` — Ops Health gateway card at top, getOpsHealth() fetch |

### Sales Leak Dashboard ✅ Implemented
| Action | File |
|--------|------|
| Create | `src/lib/ops/salesLeakDashboard.ts` — full metrics + per-stage leak + evidence |
| Create | `src/app/dashboard/sales-leak/page.tsx` |
| Create | `src/components/dashboard/sales-leak/SalesLeakDashboardClient.tsx` |
| Modify | `src/components/dashboard/sidebar.tsx` — nav link "Sales Leak" |

### Results Ledger ✅ Implemented
| Action | File |
|--------|------|
| Modify | `src/lib/client-success/types.ts` — ResultsLedgerExtra, RESULTS_LEDGER_EXTRA, ClientSuccessData.resultsLedgerExtra |
| Modify | `src/lib/client-success/index.ts` — read/write resultsLedgerExtra, upsertResultsLedgerExtra() |
| Modify | `src/app/api/leads/[id]/client-success/route.ts` — POST results_ledger_extra |
| Create | `src/lib/ops/resultsLedger.ts` — getResultsLedgerEntries() |
| Create | `src/app/api/results-ledger/route.ts` — GET list |
| Create | `src/app/dashboard/results/page.tsx` |
| Create | `src/components/dashboard/results/ResultsLedgerClient.tsx` |
| Modify | `src/components/dashboard/sidebar.tsx` — nav link "Results Ledger" |
| Optional | `prisma/schema.prisma` — Lead.offerType (deferred; can add later for offer ladder) |

---

## 4. Data assumptions / placeholders
- **Workday run status:** From last artifact WORKDAY_RUN_REPORT; meta has research/pipeline/knowledge; infer success/partial/fail from errors. If no artifact, "No run yet".
- **Integration health:** DB from /api/health; Research = last WORKDAY_RUN_REPORT timestamp; Knowledge = last ingest from same or knowledge queue artifact. Placeholder "APIs" = NEXTAUTH_URL + AUTH_SECRET check.
- **Stale leads:** No touch (lastContactAt or last LeadTouch) in X days (e.g. 7). Configurable.
- **Benchmarks (sales leak):** Start with hardcoded defaults; later editable in settings or SalesLeakBenchmark table.

---

## 5. Success criteria (weekly review)
- Where is the sales leak? → Sales Leak Dashboard.
- What failed operationally? → Ops Health panel.
- Which clients are getting results? → Results Ledger.
- What reusable leverage did I extract? → Reusable Asset Log + summary.
- Did learning produce action? → Learning pipeline + produced-asset.
- What needs my human approval today? → Ops Health approval queue + Failures & Interventions.
