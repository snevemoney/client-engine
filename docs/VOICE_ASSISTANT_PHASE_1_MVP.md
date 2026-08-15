# Voice Assistant Phase 1 MVP — Client Engine

**Purpose:** Convert the [IDEA_ROADMAP](IDEA_ROADMAP.md) into a single buildable next step. One workflow, one stack choice, one success metric, one compliance boundary.

---

## One-Sentence Goal

**Voice Phase 1 is an outbound proposal follow-up assistant that calls only consented contacts after a sent proposal becomes stale, logs one of a small set of allowed outcomes, and aims to turn silence into a booked callback or a clear next step.**

---

## 1. Business Loop Served

- **Primary:** Close (proposal movement, response loops)
- **Secondary:** Acquire (follow-up), Retain (check-ins)

**Concrete goal:** Voice Phase 1 improves Close by turning stale proposal follow-ups into booked callbacks or clear next steps with less operator effort.

---

## 2. Chosen Workflow

**Proposal follow-up (outbound)**

Locked for Phase 1. One workflow owned end-to-end. Others wait until this one proves value.

### Deferred Workflows

| Workflow | Loop | Deferred until |
|----------|------|----------------|
| Overdue follow-up | Acquire | Outbound proposal follow-up proves value |
| Booking/reminder | Retain | Outbound proposal follow-up proves value |
| Inbound routing | Acquire/Close | Outbound proposal follow-up proves value |

**Inbound routing is deferred until outbound proposal follow-up proves value.**

---

## 3. Trigger (Exact Conditions)

A call is eligible when all of the following are true:

| Condition | Rule |
|-----------|------|
| Proposal status | `sent` |
| Response status | Not in `accepted` \| `rejected` \| `meeting_booked` |
| Staleness | `proposalSentAt` <= now - 3 days |
| Consent | `consent = true` for contact |
| Opt-out | No opt-out on record |
| Recent call | No call to this contact in last 7 days |
| Calling window | Within allowed calling window (e.g. 9am–6pm local, Mon–Fri) |

---

## 4. Allowed Outcomes

Phase 1 defines only these outcome states. All must be loggable and reportable.

| Outcome | Description |
|---------|-------------|
| `booked_callback` | Meeting or callback scheduled |
| `requested_manual_followup` | Contact asked for human follow-up |
| `not_interested` | Contact declined or not interested |
| `no_answer` | No answer, voicemail, or wrong number |
| `opted_out` | Contact requested no further calls |

---

## 5. Stack Choice

| Option | Role |
|--------|------|
| **Retell or Vapi** | Voice runtime; telephony; speech; conversation; outbound scheduling; call logs/webhooks |
| **Client Engine** | Brain; deal context; consent state; call outcome logging; policy; approvals |
| **Twilio** (optional) | Numbers/import for ownership and flexibility |

**Recommendation:** Retell or Vapi for Phase 1 (faster to value). Client Engine provides context and policy; voice platform provides telephony and conversation.

---

## 6. Consent / Opt-Out Rules

- **Consent state per contact:** Required before outbound. Store on Lead or Deal.
- **Allowed calling windows:** e.g. 9am–6pm local, Mon–Fri.
- **Call purpose:** Single purpose per call (proposal follow-up).
- **Opt-out memory:** If contact opts out, persist and never call again.
- **Identification:** Agent identifies as Client Engine / operator's system.
- **TCPA/FCC:** Design for consent from day one; no cold dialing.

---

## 7. Script Control

**Scripts are versioned and operator-approved.** The voice assistant may adapt phrasing within constraints but may not change purpose, claims, pricing, or consent language.

---

## 8. Success Metrics

| Metric | Definition |
|--------|-------------|
| **Primary** | % of eligible proposal follow-up calls that produce either `booked_callback` or `requested_manual_followup` (clear next step) |
| **Secondary** | Operator time saved, no-answer rate, opt-out rate |
| **Guardrail** | No metric that incentivizes persuasion over consent |

---

## 9. Explicitly Out of Scope (Phase 1)

- AI phone closer / persuasion bot
- Cold calling
- Multiple workflows at once
- Inbound routing (deferred until outbound proves value)
- Uncontrolled script changes
- No consent/opt-out

---

## 10. Required Reliability Gate Before Implementation

- Pass [PHASE_8_GO_NO_GO.md](PHASE_8_GO_NO_GO.md) — all P0/P1 items green
- [BOUNDED_CONTEXTS.md](BOUNDED_CONTEXTS.md) — add Voice context entry before new models/routes
- [CLIENT_ENGINE_POWER_OF_10.md](CLIENT_ENGINE_POWER_OF_10.md) Law 10 — no new domain before reliability

---

## 11. Next Steps (After Doc Approval)

- [ ] Add Voice bounded context to BOUNDED_CONTEXTS.md
- [ ] Choose stack (Retell vs Vapi)
- [ ] Define Prisma models (CallLog, ConsentState, etc.)
- [ ] Define first API contract (e.g. POST /api/voice/schedule-follow-up)
- [ ] Define UI surfaces (Proposal Follow-ups, Command Center, call log)

---

## 12. UI Scope (Phase 1)

| Surface | Purpose |
|---------|---------|
| **Proposal Follow-ups page** | Add "Eligible for voice" bucket; consent toggle; "Schedule voice call" action |
| **Lead/Proposal detail** | Consent toggle; last voice call + outcome |
| **Command Center** | Voice follow-ups card: eligible count, primary metric |
| **Call log** | List of voice calls with outcome (from webhook) |

---

## See Also

- [docs/IDEA_ROADMAP.md](IDEA_ROADMAP.md) — Active/Incubator/Kill map, Phase 1 scope
- [docs/VOICE_ASSISTANT_PHASES.md](VOICE_ASSISTANT_PHASES.md) — full implementation phase plan
- [docs/BUSINESS_ALIGNMENT_GATE.md](BUSINESS_ALIGNMENT_GATE.md) — idea gate
- [docs/PHASE_8_GO_NO_GO.md](PHASE_8_GO_NO_GO.md) — release readiness
