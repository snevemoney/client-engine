# Leverage Score (0–100)

A single number that answers: **“Am I building a real operator system, or just a more advanced dashboard?”**

Review it **weekly** with the Production Criticism Checklist. Trend matters more than the absolute value.

---

## Formula (weighted)

| Component | Weight | What it measures |
|-----------|--------|-------------------|
| **Reusable assets** | 25% | % of delivery leads (APPROVED / BUILDING / SHIPPED) that have at least one logged reusable asset (template, component, workflow, playbook, case study). |
| **Outcomes tracked** | 25% | % of those same leads with at least one of: result target, baseline snapshot, or outcome scorecard entry. |
| **Learning → action** | 20% | % of learning improvement proposals that are “Promote to playbook” **or** have produced asset type other than “knowledge only”. |
| **Failure visibility** | 15% | 100 if a workday run completed in the last 7 days (so failures are being surfaced); else 50. |
| **Proposal win rate** | 15% | Won / (won + lost) over the last 90 days, as %. If no outcomes yet, this component is skipped and the remaining weights are re-normalized. |

**Composite:** Weighted sum of the above, capped at 100.

---

## Interpretation

- **Rising over time** — System is turning work into leverage (assets, outcomes, learning applied, visibility).
- **Flat** — Check which component is stuck; use the Weekly Production Criticism Checklist.
- **Falling** — Either more work without logging (no assets/outcomes), or learning not converting to action, or runs not happening.

---

## Where it appears

- **Command Center** — Leverage Score card (number + breakdown by component).
- **Settings** — Same score in Autopilot guardrails / diagnostics area (optional).

---

## Data sources

- **Reusable assets:** Artifacts with type `REUSABLE_ASSET_LOG` on leads with status APPROVED, BUILDING, or SHIPPED.
- **Outcomes tracked:** Same leads with `RESULT_TARGET`, `BASELINE_SNAPSHOT`, or `OUTCOME_SCORECARD` artifacts (or equivalent client-success data).
- **Learning → action:** Artifacts with type `ENGINE_IMPROVEMENT_PROPOSAL` and meta `promotedToPlaybook: true` or `producedAssetType` in `['proposal_template','case_study','automation']`.
- **Failure visibility:** Last artifact with title `WORKDAY_RUN_REPORT` on system lead “Research Engine Runs”.
- **Proposal win rate:** Leads with `dealOutcome` in `['won','lost']` and `proposalSentAt` in last 90 days.
