# Client Success Layer

Result-driven delivery: baseline → interventions → outcome scorecard → proof.

## Why

- **Get clients** → deliver **measurable results** → turn results into **proof** → raise prices → attract better clients.
- The engine optimizes for client outcomes, not just lead flow.

## Components (all stored as artifacts on the lead)

| Component | Artifact type | Purpose |
|-----------|----------------|---------|
| **Result Target** | `RESULT_TARGET` | Before building: current state, target state, metric, timeline. Makes the engagement an outcome contract. |
| **Baseline Snapshot** | `BASELINE_SNAPSHOT` | "Before" metrics at project/delivery start. |
| **Intervention Log** | `INTERVENTION_LOG` | What you changed (automation, workflow, tool stack, process). |
| **Outcome Scorecard** | `OUTCOME_SCORECARD` | Weekly KPI tracking (time saved, cost saved, throughput, etc.). |
| **Risk / Bottleneck Tracker** | `RISK_BOTTLENECK_LOG` | What's blocking results now; can be resolved. |
| **Client Feedback Log** | `CLIENT_FEEDBACK_LOG` | Check-ins: "What still feels slow/confusing?" |

## When it appears

On the **lead detail** page, the **Client Success** card is shown when the lead status is **APPROVED**, **BUILDING**, or **SHIPPED**.

## Flow

1. **Before/during proposal:** Set a **Result Target** (current → target, metric, timeline). Proposals that have a result target are framed as outcome contracts; the proposal prompt includes this block.
2. **At delivery start:** Capture **Baseline Snapshot** (metrics as of go-live).
3. **During delivery:** Log **Interventions** (what you changed), add **Outcome Scorecard** entries weekly, track **Risks/Bottlenecks**, log **Client Feedback**.
4. **Proof:** Use **Generate proof from outcomes** to build a proof post that uses baseline + interventions + outcome entries (in addition to pipeline artifacts). Proof posts appear under Proof and can be used for case study bullets and proposal proof snippets.

## API

- **GET** `/api/leads/[id]/client-success` — return full client success data.
- **POST** `/api/leads/[id]/client-success` — body: `{ type, payload }` or `{ type: "resolve_risk", riskId }`.
  - `type`: `result_target` | `baseline` | `intervention` | `outcome_entry` | `risk` | `resolve_risk` | `feedback`.
  - `payload`: depends on type (e.g. `result_target`: `currentState`, `targetState`, `metric`, `timeline`).

## Lib

- `src/lib/client-success/types.ts` — types and artifact type constants.
- `src/lib/client-success/index.ts` — `getClientSuccessData`, `upsertResultTarget`, `upsertBaselineSnapshot`, `appendIntervention`, `appendOutcomeEntry`, `addRisk`, `resolveRisk`, `appendClientFeedback`, `buildProofSummaryFromSuccessData`.

## Integration with proposal and proof

- **Proposal:** When generating a proposal, if the lead has a **Result Target**, it is passed into the proposal prompt so the proposal is framed as an outcome contract (current → target, metric, timeline).
- **Proof:** When generating a proof post for a lead, **Client Success** data (baseline, interventions, outcome entries) is merged into the proof lines so the post can include measurable outcomes.
