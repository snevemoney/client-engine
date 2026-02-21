# Weekly Production Criticism Checklist

Use this **every week**. Evidence + action only. If the app can’t answer a question, that’s a signal to fix the app.

---

## 1) Money

- [ ] Did the app help me generate more leads, proposals, or cash this week?
- [ ] Can I see **cash collected** clearly? (Money Scorecard / Settings)
- [ ] Did any feature I worked on improve **revenue** or **delivery speed**?
- [ ] If not → backlog the feature or deprioritize.

**Evidence to check:** Money Scorecard (leads 7d, proposals sent 7d, deals won, revenue won 30d). Failures & Interventions (stuck proposals, stale leads).

---

## 2) Failures

- [ ] What failed **silently**?
- [ ] What got stuck (lead / proposal / build)?
- [ ] Did the app clearly surface it (Failures & Interventions card), or did I discover it manually?
- [ ] If manual → improve visibility or alerts.

**Evidence to check:** Command Center → Failures & interventions. Metrics → recent runs, errors. Brief Me → “What failed.”

---

## 3) Client Results

- [ ] For each **active client** (APPROVED / BUILDING / SHIPPED): target, baseline, current delta, proof.
- [ ] Did I improve **outcomes** or just complete tasks?
- [ ] What result can become a **testimonial / case study**?

**Evidence to check:** Lead detail → Results at a glance. Client Success card → Result target, baseline, interventions, outcome scorecard, proof from outcomes.

---

## 4) Reusable Leverage

- [ ] What **reusable asset** came out of this project?
  - [ ] Template
  - [ ] Workflow
  - [ ] Prompt pack
  - [ ] UI component
  - [ ] SOP / playbook
  - [ ] Case study
- [ ] If **none**: why not? Log at least one per project in Client Success → Reusable assets.

**Evidence to check:** Lead detail → Client Success → Reusable assets. Leverage Score (% projects with assets).

---

## 5) Learning → Action

- [ ] What transcript / book / video was **ingested**?
- [ ] Did it produce:
  - [ ] A **sales asset**
  - [ ] A **delivery improvement**
  - [ ] An **automation**
  - [ ] A **playbook update**
- [ ] If not → mark **“knowledge only”** and deprioritize similar sources.

**Evidence to check:** Learning → Proposed improvements → “Produced” dropdown. Leverage Score (% learning → action).

---

## 6) Constraint

- [ ] What is the **current bottleneck**?
- [ ] What **evidence** supports it?
- [ ] What **single action** am I doing next to relieve it?

**Evidence to check:** Command Center → Constraint card. Brief Me → bottleneck + action plan. Chat: “What’s the bottleneck?” (answer should cite source).

---

## 7) Human Guardrails

- [ ] Did AI try to push something it **shouldn’t own**?
- [ ] Were **human-only** decisions respected?
  - [ ] Final proposal narrative
  - [ ] Positioning
  - [ ] Final send
  - [ ] Build launch / start

**Evidence to check:** Settings → Autopilot guardrails → Human-only list. No auto-send, no auto-build.

---

## Leverage Score (weekly)

- [ ] Check **Leverage Score** (Command Center or Settings). Trend up = building a real operator system; flat or down = more dashboard than leverage.
- [ ] See **docs/LEVERAGE_SCORE.md** for formula and interpretation.

---

## Ritual

1. Open **Command Center** and read the **Pat/Tom Weekly Scorecard** card (the sentence + 7 KPIs). See **docs/PAT_TOM_WEEKLY_SCORECARD.md**.
2. Open this checklist **same day every week**.
3. Answer each section with **evidence from the app** (screens, numbers, links).
4. For every fix you add, use the **Money Impact** format: Fix / Expected money impact / Metric to watch / Review date. See **docs/PAT_TOM_WEEKLY_SCORECARD.md**.
5. For every “no” or “manual”: add one **concrete fix** (Do now or Backlog).
6. Run the **Production Critic** Cursor rule (`.cursor/rules/production-critic.mdc`) for an AI review against this framework.
