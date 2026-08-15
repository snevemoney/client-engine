# Idea Roadmap — Client Engine

**Purpose:** Map ideas to Active Bet / Incubator / Kill. Forces prioritization and protects the repo from random expansion.

Governed by [BUSINESS_ALIGNMENT_GATE.md](BUSINESS_ALIGNMENT_GATE.md). WIP caps: 1 Core Bet, 1 Supporting Bet, 1 Experimental Bet.

---

## Classification Table

| Idea | Gate Score | Decision | Rationale |
|------|------------|----------|-----------|
| **AI Voice Assistant (Phase 1)** | High | **Active Bet** | Direct Acquire/Close/Retain fit; follow-up, reminders, bookings; execution bottleneck |
| **Self-learning skill (.learnings/)** | Medium | **Incubator** | Improves Operate; internal platform; 7–30 day wait |
| **Proactive agent architecture** | Medium | **Incubator** | Improves Operate; doctrine done first (Phase 1) |
| **Business Alignment Gate** | — | **Done** | Doctrine doc; no execution |
| **Proactive/Persistent/Self-Improving doctrine** | — | **Done** | Doctrine doc; no execution |
| **Self-Learning Skill doctrine** | — | **Done** | Doctrine doc; no execution |
| **Generic autonomous expansion** | Low | **Kill** | No loop fit; drift |
| **Self-replicating agent fantasies** | Low | **Kill** | Not useful |

---

## Implementation Order

1. **Done:** Doctrine docs — BUSINESS_ALIGNMENT_GATE, PROACTIVE_PERSISTENT_SELF_IMPROVING, SELF_LEARNING_SKILL_DOCTRINE
2. **Done:** Roadmap doc — IDEA_ROADMAP.md with classification + WIP caps
3. **First Active Bet:** AI Voice Assistant Phase 1 — reminders, follow-up calls, inbound routing, proposal follow-up

---

## AI Voice Assistant — Phase 1 Scope

**Positioning:** Voice Execution Layer, not New Autonomous AI Empire.

Client Engine stays the brain. Voice is a channel. Growth/NBA/Founder OS decide when to call. Memory logs what happened. Operator reviews outcomes.

### Outbound
- Proposal follow-up
- Reminder calls
- Booking confirmation
- Reactivation calls
- "Proposal sent" follow-up

### Inbound
- Call routing
- Basic qualification
- Appointment booking
- FAQ / triage
- After-hours coverage
- Escalation to operator when needed

### Stack (recommended)
- **Retell or Vapi** — voice runtime (outbound scheduling, inbound routing, call logs/webhooks)
- **Client Engine** — memory, policy, lead/deal state, attribution, approvals
- **Twilio** (optional) — numbers/import for ownership and flexibility

### Compliance (required)
- Consent state per contact
- Allowed calling windows
- Call purpose
- Opt-out memory
- Human escalation path
- Full call logging

### Phase 1 MVP Spec
- [docs/VOICE_ASSISTANT_PHASE_1_MVP.md](VOICE_ASSISTANT_PHASE_1_MVP.md) — locked workflow (proposal follow-up), exact trigger, allowed outcomes, stack choice, consent rules
- [docs/VOICE_ASSISTANT_PHASES.md](VOICE_ASSISTANT_PHASES.md) — full phase plan (1–5 + deferred)

### Prerequisite
- Pass [PHASE_8_GO_NO_GO.md](PHASE_8_GO_NO_GO.md) gate
- No new domain before reliability (Law 10 in [CLIENT_ENGINE_POWER_OF_10.md](CLIENT_ENGINE_POWER_OF_10.md))

### What NOT to do first
- "AI phone closer that can persuade anyone"
- Autonomous cold-calling machine
- Uncontrolled persuasion
- No consent or opt-out memory

---

## Incubator Ideas (7–30 Day Wait)

| Idea | Wait | Re-score when |
|------|------|---------------|
| Self-learning skill (.learnings/ implementation) | 7 days | Biggest pain is repeated mistakes, drift, forgotten lessons |
| Proactive agent architecture (implementation) | 7 days | Doctrine absorbed; Operate loop needs proactive signals |

---

## Kill / Archive

| Idea | Reason |
|------|--------|
| Generic autonomous expansion | No loop fit; drift |
| Self-replicating agent fantasies | Not useful |
| Abstract agent autonomy | Sounds impressive, no direct business payback |

---

## See Also

- [docs/BUSINESS_ALIGNMENT_GATE.md](BUSINESS_ALIGNMENT_GATE.md) — gate questions, scoring, WIP caps
- [docs/PHASE_8_GO_NO_GO.md](PHASE_8_GO_NO_GO.md) — release readiness
- [ROADMAP.md](../ROADMAP.md) — technical roadmap and phases
