# Proactive, Persistent, Self-Improving Agent Architecture — Client Engine

**Purpose:** Define the three pillars and protocols for agent behavior — governed initiative, not unbounded autonomy.

This document belongs to both **AI Engineering** (mechanisms) and **Intent Engineering** (policies). See [AI_STACK_DOCTRINE.md](AI_STACK_DOCTRINE.md) for layer context.

---

## Core Principle

**Implement this as governed initiative, not freedom.**

The difference between a powerful AI operating system and a clever mess is control.

---

## The Three Pillars

### 1. Proactive — Event / Threshold Driven

| Good | Bad |
|-----|-----|
| Anticipates needs — asks "what would help my human?" instead of waiting | Random interruptions |
| Reverse prompting — surfaces ideas you didn't know to ask for | Suggestion spam |
| Proactive check-ins — monitors what matters and reaches out when needed | Freeform suggestion |

**Rule:** Proactive = event-driven or threshold-driven initiative, not freeform suggestion spam.

There must be:
- A monitored signal
- A threshold
- A policy for when to surface
- An action that is useful, not noisy

### 2. Persistent — Survives Context Loss

| Mechanism | Purpose |
|-----------|----------|
| **WAL Protocol** | Write critical details BEFORE responding |
| **Working Buffer** | Capture every exchange in the danger zone |
| **Compaction Recovery** | Know exactly how to recover after context loss |

**Rule:** Long workflows and multi-step execution need a WAL-like discipline.

### 3. Self-Improving — Gets Better at Serving You

| Allowed | Approval Required |
|---------|-------------------|
| Self-healing — fixes its own runtime issues | Doctrine changes |
| Disciplined resourcefulness — tries multiple approaches under limits | Tool registry changes |
| Safe evolution — guardrails prevent drift | Prompt rewrites |
| | Memory policy changes |
| | Architecture changes |

**Rule:** Self-improving = log → review → promote. Bounded. Inspectable.

---

## File Roles (Reference Structure)

Client Engine may implement a subset. These are the canonical roles:

| File | Role |
|------|------|
| 0NBOARDING.md | First-run setup, current environment assumptions |
| AGENTS.md | Workflows, delegation rules, escalation rules, anti-patterns |
| SOUL.md | Identity, principles, non-negotiables, behavioral boundaries |
| USER.md | Goals, preferences, recurring priorities, constraints |
| MEMORY.md | Curated stable long-term memory only (not raw logs) |
| SESSION-STATE.md | Active mission state, current objectives, pending blockers, next step if interrupted |
| HEARTBEAT.md | Periodic self-check: "am I degraded?" "am I drifting?" "what should be compacted/promoted?" |
| TOOLS.md | Tool contracts, gotchas, migration notes, failure modes |
| memory/YYYY-MM-DD.md | Raw daily log, chronological, not curated |
| memory/working-buffer.md | Volatile, high-frequency danger-zone state; temporary steps |

---

## Protocols

### 1. Write-Ahead Log Protocol

Before major response or mutation:
- Write critical state
- Then act

Use for: long workflows, multi-step actions, external mutations, recovery-sensitive tasks.

### 2. Recovery Protocol

If context loss or restart:
1. Read SESSION-STATE.md
2. Read working-buffer.md
3. Reconstruct current task
4. Check if last mutation completed
5. Resume safely

### 3. Promotion Protocol

Raw logs do not automatically become doctrine.
Require:
- Repetition (2–3x)
- Relevance
- Review
- Stable Pattern-Key
- Promotion target

### 4. Tool Migration Protocol

When changing or removing tools:
- Update tool registry
- Update prompts
- Update docs
- Update references
- Update tests
- Update route contracts
- Update fallback behavior

---

## Proactivity Classes

| Class | When | Examples |
|------|------|----------|
| **A — Immediate interrupt** | Critical only | Broken production flow, missed deadline, failed high-priority job, score collapse |
| **B — Daily standup** | Bundle into daily review | Recommendations, minor drift, founder OS suggestions, growth suggestions |
| **C — Weekly review** | Weekly only | Pattern insights, improvement ideas, doctrine promotion candidates, feature requests |

---

## Self-Healing Scope

**Allowed (runtime recovery):**
- Updating a working state file
- Retrying a fetch
- Re-running a bounded tool call
- Cleaning temporary state
- Marking degraded mode
- Switching to fallback behavior

**Approval required:**
- Doctrine changes
- Tool registry changes
- Prompt rewrites
- Memory policy changes
- Architecture changes

---

## Guardrails

- **Bounded resourcefulness:** Not "try 10 approaches before giving up." Use max attempts, max cost, max time, escalation threshold.
- **No self-modifying doctrine without review:** Every promotion must pass human or structured review.
- **No uncontrolled tool expansion:** New tools require bounded-context declaration and approval.
- **No complexity increase without measurable gain:** Prefer simplification over feature accumulation.

---

## Business Alignment

This architecture fits Client Engine only when it serves the six business loops:

- **Proactive** → surface overdue deals, stale follow-ups, broken workflows, missing proof
- **Persistent** → preserve active work and recover safely after interruption
- **Self-improving** → turn repeated errors/corrections into doctrine, tests, and fixes

It becomes drift when it turns into abstract agent autonomy, self-replication fantasies, or generalized intelligence layers with no direct business payback.

---

## See Also

- [docs/AI_STACK_DOCTRINE.md](AI_STACK_DOCTRINE.md) — four-layer hierarchy
- [docs/CLIENT_ENGINE_AXIOMS.md](CLIENT_ENGINE_AXIOMS.md) — behavioral contract
- [docs/SELF_LEARNING_SKILL_DOCTRINE.md](SELF_LEARNING_SKILL_DOCTRINE.md) — promotion ladder for learnings
- [docs/BUSINESS_ALIGNMENT_GATE.md](BUSINESS_ALIGNMENT_GATE.md) — idea gate
