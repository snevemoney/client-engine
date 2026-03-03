# Domain Knowledge — AI Rules

Context an AI needs to give good advice and write correct code in this codebase.

## Business Model

This is a **solo freelance web development business** targeting high-ticket local service businesses. The operator (Evens Louis) works a 9-5 and runs this business OS in the background.

**Revenue model:** Project-based ($3,000–$15,000 per website/system build)

**Niche:** Local service businesses losing revenue to slow follow-up:
- Med spas, dental practices, home renovation contractors
- Legal firms (personal injury, family law)
- Real estate teams
- Coaching and consulting practices

**Value proposition:** "We build websites that close the follow-up gap for local service businesses."

## The Money Path

```
CAPTURE → ENRICH → SCORE → POSITION → PROPOSE → [HUMAN] → BUILD
```

This is the non-negotiable core flow. Every feature should support this path.

**Key rules:**
- No proposal without positioning (the blue-ocean angle, felt problem, language map)
- No build without human approval of the proposal
- No auto-send, no auto-build — the AI proposes, the human decides
- Rejected leads stop immediately — no pipeline progression
- `PATCH /api/leads/[id]` CANNOT set status or dealOutcome — use dedicated routes

## Lead Qualification

**Driver types (PBD framework):** survival, status, freedom, cause, competition, enemy

**Qualification score:** 0-12 (Pain, Urgency, Budget, Responsiveness, Decision Maker, Fit — 2 pts each)

**Sales stages:** prospecting → first_contact → needs_analysis → proposal → negotiation → won → lost

## Scoring System

**Health scores:** 0-100 composite from weighted factors
- healthy ≥ 80 (green)
- warning ≥ 50 (yellow)
- critical < 50 (red)

**Events that trigger notifications:**
- threshold_breach: entered critical band
- sharp_drop: delta ≤ -15 points
- recovery: entered healthy band

## NBA (Next Best Actions)

The NBA system ranks recommendations. Key concepts:
- **Priority levels:** critical > high > medium > low
- **Score formula:** base + boosts - penalties + learnedBoost
- **Learned weights:** Memory pipeline adjusts rankings based on what the operator actually executes vs dismisses
- **Suppression:** Operator can suppress specific rules for 7d/30d

## Agent System

10 autonomous agents run on cron schedules. They:
- Can use the same 25 tools as the Brain
- Have filtered tool allowlists per agent
- Require operator approval for write tools
- Are limited to 50k tokens and 15 tool calls per run

**Critical safety rules:**
- Circuit breaker: stop after 2 consecutive failures
- Max 2 concurrent agent runs
- Approval expires after 24 hours
- Stale runs reaped after 15 minutes

## Proof Engine

Proof is NDA-safe and observational:
- "Today I saw..." patterns
- Specific, outcome-based (not vague)
- No client identifiers in public content
- No hype, superiority, or invented metrics

**Flow:** Delivery complete → ProofCandidate (draft → ready) → promote to ProofRecord → generate ContentPost drafts → schedule/post

## Notification Severity

| Severity | When |
|----------|------|
| info | Score recovery, routine events |
| warning | Sharp drop, overdue follow-ups |
| critical | Score threshold breach, failed deliveries, dead-letter alerts |

## Key Business Metrics

- **Cash collected** — actual revenue received
- **Revenue won (30d)** — deal value of won leads
- **Turnaround → proposal** — days from intake to proposal sent
- **Turnaround → close** — days from intake to deal won
- **Follow-up discipline** — overdue count, touches per lead
- **Leverage score** — reusable assets %, outcomes tracked %, failure visibility

## Vocabulary

| Term | Meaning |
|------|---------|
| Brain | Claude AI chat with tools (slide-over panel) |
| Agent | Autonomous Claude worker on cron schedule |
| NBA | Next Best Action (ranked recommendation) |
| Flywheel | End-to-end lead processing (capture → propose) |
| Workday Run | Morning automation (research → pipeline → retries) |
| Positioning | Blue-ocean angle, felt problem, language map |
| Proof | NDA-safe case study content from delivered work |
| Leverage Score | 0-100 measuring reusable output extraction |
| Driver | Lead motivation type (PBD framework) |
| Artifact | Content piece linked to a lead (notes, score, positioning, proposal) |
