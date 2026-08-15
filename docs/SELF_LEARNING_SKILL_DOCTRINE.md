# Self-Learning Skill Doctrine — Client Engine

**Purpose:** Schema and promotion ladder for turning mistakes into operational learning.

This document defines how to log learnings and errors so coding agents can later process them into fixes. Important learnings get promoted to project memory. See [docs/ai-rules/session-journal.md](ai-rules/session-journal.md) for session capture; this doctrine governs the learning exhaust system.

---

## File Structure

```
.learnings/
├── ERRORS.md           # Incident log (command/operation/API failures)
├── LEARNINGS.md        # Reusable lessons (corrections, knowledge gaps, best practices)
└── FEATURE_REQUESTS.md # Unmet demand
```

### When to Log Where

| Situation | Log to |
|-----------|--------|
| Command/operation fails | .learnings/ERRORS.md |
| User corrects you | .learnings/LEARNINGS.md (category: correction) |
| User wants missing feature | .learnings/FEATURE_REQUESTS.md |
| API/external tool fails | .learnings/ERRORS.md (with integration details) |
| Knowledge was outdated | .learnings/LEARNINGS.md (category: knowledge_gap) |
| Found better approach | .learnings/LEARNINGS.md (category: best_practice) |
| Simplify/harden recurring pattern | .learnings/LEARNINGS.md (Source: simplify-and-harden, Pattern-Key) |

---

## Entry Schema

Each log entry should include these fields for later automation:

| Field | Description |
|-------|-------------|
| **Date** | YYYY-MM-DD |
| **Title** | Short descriptive title |
| **Category** | correction, knowledge_gap, best_practice, simplify-and-harden, etc. |
| **Severity / Priority** | P0/P1/P2 or 1–5 |
| **Context** | What was being attempted |
| **What happened** | The failure or correction |
| **Root cause** | If known |
| **Correct behavior** | What should happen instead |
| **Pattern-Key** | Stable identifier for recurrence detection |
| **See Also** | Links to related entries |
| **Promotion target** | CLAUDE.md, AGENTS.md, TOOLS.md, etc. |
| **Status** | raw \| reviewed \| promoted \| resolved |

---

## Pattern-Key Discipline

**Stable keys enable recurrence detection.** Without them, the system cannot distinguish recurrence from novelty.

Examples:
- `auth-throw-treated-as-unauthenticated`
- `retry-after-missing-on-429`
- `founder-summary-fallback-without-degraded-flag`
- `growth-route-needs-contract-test`

When an entry repeats 2–3 times, add a Pattern-Key and link related entries with **See Also**.

---

## Promotion Ladder

| Level | Location | Criteria |
|-------|----------|----------|
| **1 — Raw event** | ERRORS.md, LEARNINGS.md, FEATURE_REQUESTS.md | First occurrence |
| **2 — Repeated pattern** | Same file, enhanced | Seen 2–3x: add Pattern-Key, See Also, bump priority |
| **3 — Stable doctrine** | CLAUDE.md, AGENTS.md, TOOLS.md, SOUL.md, MEMORY.md | Promoted after review |

**Promotion targets:**
- **CLAUDE.md** — Broad coding/assistant rules
- **AGENTS.md** — Workflow, delegation, escalation
- **TOOLS.md** — Tool-specific gotchas
- **SOUL.md** — Behavioral principles
- **MEMORY.md** — Only if genuinely persistent and useful

---

## Auto-Link to Code

When logging, attach:
- File paths
- Route names
- Page names
- Tool names
- Agent names

This makes later automation actionable: "Most errors this week touched founder/summary, growth/outreach/send, and requireAuth."

---

## Weekly Consolidation

Do not log forever without consolidation. Weekly review should ask:

1. What repeated this week?
2. What should be promoted?
3. What should become a bugfix?
4. What should become a test?
5. What should be ignored?

---

## What Makes It Real Learning

Logging alone is not learning. It becomes learning only when one of these happens:

- Behavior changes
- Code changes
- Doctrine changes
- Tests get added
- Prioritization changes

Otherwise it is just a diary.

---

## Guardrails

- **Don't promote too fast:** One bad experience should not become permanent doctrine. Wait for recurrence, broad applicability, real evidence.
- **Don't mix user memory with system doctrine:** A user preference is not the same as a tool gotcha, coding rule, or behavioral principle. Keep them separate.
- **Similar to existing entry:** Link with **See Also**; consider priority bump.

---

## Integration with Client Engine

- Cursor rules and session journal can reference this doctrine
- Agents log to .learnings/ when appropriate (errors, corrections, feature requests)
- Session journal template can include a "Learnings" section that feeds into LEARNINGS.md
- Weekly review ritual (see [BUSINESS_ALIGNMENT_GATE.md](BUSINESS_ALIGNMENT_GATE.md)) can include .learnings/ consolidation

---

## See Also

- [docs/ai-rules/session-journal.md](ai-rules/session-journal.md) — session capture template
- [docs/PROACTIVE_PERSISTENT_SELF_IMPROVING_AGENT_ARCHITECTURE.md](PROACTIVE_PERSISTENT_SELF_IMPROVING_AGENT_ARCHITECTURE.md) — promotion protocol
- [docs/BUSINESS_ALIGNMENT_GATE.md](BUSINESS_ALIGNMENT_GATE.md) — weekly review ritual
