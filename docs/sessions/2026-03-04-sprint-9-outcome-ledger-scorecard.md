# Session: Sprint 9 — Outcome Ledger + Scorecard (2026-03-04)

## Goal
Implement the Outcome Ledger (record actual deal outcomes) and Scorecard dashboard per the Sprint 9 plan.

## Decisions Made
- Outcome model links to Project (one outcome per paid project); actualRevenue stored as Int cents
- Cadence "paid" trigger fires 7 days after paymentStatus → paid; link goes to /dashboard/deploys?highlight=projectId
- OutcomeEditor lives in deploys table expandable row (same area as ProofEditor) for paid projects only
- Score buckets use 0-33, 34-66, 67-100 for Lead.score (0-100 scale)
- Score calibration scatter uses simple SVG (no Recharts); Scorecard under Prove group in sidebar

## What Was Built

### Schema
- Outcome model: projectId (unique), actualRevenue (Int cents), repeatClient, referralSource, satisfactionScore (1-5), lessonsLearned
- Project.outcome relation

### API
- GET /api/projects/[id]/outcome — return outcome (404 if none)
- POST /api/projects/[id]/outcome — create/upsert (Zod validation)
- PATCH /api/projects/[id]/outcome — update existing

### Cadence
- Added "paid" trigger (7 days) to cadence service
- createCadence("project", id, "paid") when paymentStatus → paid in project PATCH
- TRIGGER_LABELS: paid: "Record outcome"
- getLink for project+paid: /dashboard/deploys?highlight=sourceId

### UI
- OutcomeEditor component: form for actualRevenue ($), repeatClient, referralSource, satisfactionScore 1-5, lessonsLearned
- Deploys table: OutcomeEditor for paid projects in expandable row; ?highlight=projectId auto-expands and scrolls
- CadencesSection, CadenceDueCard: added paid label

### Scorecard
- getOutcomeScorecard: winRateBySource, winRateByScoreBucket, quotedVsActual, timeToCloseMedianDays, channelPerformance
- getScoreCalibrationData: score vs actualRevenueCents for scatter
- /dashboard/scorecard page: tables + ScoreCalibrationChart (SVG scatter)
- Sidebar: Scorecard under Prove group

## Key Insights
- Outcome model is separate from client-success OutcomeEntry (weekly KPI in artifacts); Outcome is deal-level actual revenue
- quotedVsActual uses Project.paymentAmount (quoted) vs Outcome.actualRevenue (actual)
- Score calibration requires Outcome data; empty state until operator records outcomes

## Next Steps
- Optional: integrate actualRevenueCollected into MoneyScorecard
