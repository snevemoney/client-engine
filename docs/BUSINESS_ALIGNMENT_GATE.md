# Business Alignment Gate — Client Engine

**Purpose:** Gate for every new idea — Active Bet vs Incubator vs Kill.

This document belongs to the **Intent Engineering** layer. It defines what work the organization absorbs and what waits. See [AI_STACK_DOCTRINE.md](AI_STACK_DOCTRINE.md) for layer context.

---

## Core Rule

**An idea is not active work unless it improves one of Client Engine's six business loops:**

1. **Acquire** — prospecting, outreach, follow-up, pipeline hygiene
2. **Close** — qualification, proposals, response loops, meeting booking
3. **Deliver** — milestones, QA, handoff, execution quality
4. **Prove** — proof capture, testimonials, reviews, case studies
5. **Retain** — follow-ups, referrals, upsells, relationship maintenance
6. **Operate** — risk, NBA, Founder OS, memory, notifications, reliability

If it does not clearly improve one of those, it does not enter Active Bets.

---

## Gate Questions

Every idea must answer these before promotion:

### 1. Business fit
- Which of the 6 loops does this improve?
- What painful bottleneck does it solve now?
- What metric should improve if this works?

### 2. Timing
- Why now?
- What current work would this displace?
- Can the organization absorb it without breaking trust, reliability, or promises?

### 3. Proof
- What is the smallest useful version?
- How fast can we get proof: days, weeks, or months?
- Would we still want this after waiting 7–30 days?

### 4. Cost of complexity
- Does this add a new domain, or strengthen an existing one?
- Does it increase operational burden?
- Can we implement it as a small, reversible change?

### 5. Reliability impact
- Does this touch Tier-A pages or routes?
- Does it require new migrations, new env vars, or new deploy risk?
- Do we already have contract tests / error states / degraded states for the affected area?

---

## Decision Outcomes

| Outcome | When to use |
|---------|-------------|
| **Active Bet** | Direct loop fit, solves current bottleneck, fits current bandwidth, has small first version, does not break reliability discipline |
| **Incubator** | Strategically interesting but not urgent, not absorbable now, or not yet proven |
| **Kill / Archive** | Exciting but not useful, duplicates existing work, creates sprawl, or does not survive the wait |

---

## Active-Bet Limits (WIP Caps)

To prevent founder overload, set hard WIP caps:

- **1 Core Bet** — primary focus
- **1 Supporting Bet** — secondary, can run in parallel
- **1 Experimental Bet** — exploratory, lowest priority

Everything else waits.

---

## Idea Release Policy

| Stage | Action |
|-------|--------|
| **Inbox** | Every idea gets captured immediately. No guilt. No action. |
| **Incubator** | Idea waits 7 days (normal) or 30 days (major platform/domain). If it still matters after the wait, it earns review. |
| **Active** | Only ideas that pass the Business Alignment Gate enter active work. |

Time acts as a filter. Ideas that survive the wait usually have real signal.

---

## Alignment Scoring

Score each idea 0–2 on each category:

- Business loop fit
- Revenue / execution impact
- Current bottleneck relevance
- Speed to proof
- Low complexity / reversible
- Absorbable with current bandwidth

**Interpretation:**
- **10–12** → Candidate for Active Bet
- **7–9** → Incubator
- **0–6** → Kill / Archive

---

## Anti-Drift Rules

**An idea is probably drift if it:**
- Sounds impressive but has no loop fit
- Adds autonomy without control
- Creates a new platform domain before current reliability gates pass
- Increases system complexity more than business throughput
- Mainly exists because it is "interesting online"

**An idea is likely aligned if it:**
- Increases revenue velocity
- Reduces delivery failures
- Reduces operator load
- Improves proof/retention compounding
- Strengthens Tier-A reliability

---

## Weekly Review Ritual

Once a week:

1. Review Inbox
2. Promote only ideas that survived the wait
3. Re-score Incubator
4. Kill stale or low-value ideas
5. Confirm Active Bets still deserve their slots
6. Do not exceed WIP caps

---

## Operating Principle

**Client Engine only absorbs work at the rate it can finish cleanly.**

Not the rate ideas appear. Not the rate the market excites you. Not the rate AI news pressures you.

The rate the organization can absorb without damaging reliability, trust, focus, or revenue execution.

---

## See Also

- [docs/CLIENT_ENGINE_AXIOMS.md](CLIENT_ENGINE_AXIOMS.md) — behavioral contract
- [docs/AI_STACK_DOCTRINE.md](AI_STACK_DOCTRINE.md) — four-layer hierarchy
- [docs/PHASE_8_GO_NO_GO.md](PHASE_8_GO_NO_GO.md) — release readiness gate
- [docs/IDEA_ROADMAP.md](IDEA_ROADMAP.md) — current Active/Incubator/Kill map
