# ADR-004: Memory Weight System for NBA Ranking

## Status: Accepted

## Context
The NBA (Next Best Actions) system produces ranked recommendations. Initially, all rules had static priorities. Over time, some rules consistently produced actions the operator dismissed, while others were always executed — the system had no way to learn from this feedback.

## Decision
Implement a memory pipeline that learns weights from operator actions and feeds them back into the NBA ranking formula.

**Mechanics:**
- Every action (execute, dismiss, snooze) generates a weight delta on the relevant rule/action key.
- Deltas: success +1, failure -1, dismiss -0.5, snooze -0.25.
- Weights stored in `OperatorLearnedWeight`, clamped to [-10, +10].
- NBA ranking formula includes: `learnedBoost = ruleWeight × 2 + actionWeight × 1`.
- Hard penalty: `ruleWeight ≤ -3` heavily deprioritizes that rule.
- Policy engine auto-suggests suppression when dismiss≥3 && successRate≤25%.

## Consequences
- NBA rankings improve over time as the system learns operator preferences.
- Risk of feedback loops: a rule that gets dismissed early may never recover.
- Mitigation: weights are clamped [-10, +10], and operator can reset via preferences.
- Attribution loop (before/after snapshots) validates whether actions actually improved outcomes.
- Adds complexity: 4 models (OperatorLearnedWeight, OperatorMemoryEvent, OperatorAttribution, NextActionPreference).
