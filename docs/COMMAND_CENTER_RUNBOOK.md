# Command Center — How to use it daily

## Before work (one click)

1. Open the dashboard. You land on **Command Center** (`/dashboard` or `/dashboard/command`).
2. Click **Start Workday Run**.
   - Runs research (if `RESEARCH_ENABLED=1`), pipeline for up to 20 eligible leads, and safe retries for failed runs.
   - Creates a **WORKDAY_RUN_REPORT** artifact (visible in Metrics “What changed since last run”).
3. Leave. No further clicks needed.

## After work (one click)

1. Open the dashboard → **Command Center**.
2. **Operating principle** (top): Acquire. Deliver. Improve. Every task must increase cash, client results, or reusable leverage. AI proposes. Human decides. Evidence beats vibes.
3. **Money Scorecard** — **Cash & turnaround** (top row): Cash collected (set in Settings), Revenue won 30d, Turnaround → proposal (median days), Turnaround → close (median days). Then leads, qualified, proposals, follow-ups, deals, bottleneck.
4. **Pat/Tom Weekly Scorecard** (card): One sentence + 7 KPIs (deals closed 7d, cash, turnaround, outcomes %, assets %, failures surfaced, run status). Check every Friday — “Is the system making me more money and more scalable?” See **docs/PAT_TOM_WEEKLY_SCORECARD.md**.
5. **Failures & interventions** (below scorecard): Single place for failed pipeline runs, stale leads (no response >7d), stuck proposals (ready but not sent), and items needing your approval. Fix or triage before anything else.
6. Click **Brief Me**.
   - Generates a plain-English briefing: what happened, what was created, what failed, what needs approval, current bottleneck, top opportunities, 30-minute action plan, and **knowledge-derived improvement suggestions** (if any).
   - Saves an **OPERATOR_BRIEFING** artifact and shows the summary on the page.
7. **Leverage Score** (card): Single 0–100 number. **Leverage trend (8 weeks)**: Save a snapshot each week (button on card) to build trend lines; review trend, not just level. See **docs/LEVERAGE_SCORE.md**.
8. **Graduation trigger** (card): Repeatable wins (90d) vs target (set in Settings). Prevents freelancing-loop; hit target then move to productized.
9. Use **Queue summary** and **Constraint** card to see where things are stuck.
10. **Follow-up**: Open **Proposals** → Follow-up Queue (Needs sequence / In progress / Stale). Open a lead with proposal sent → generate 5-touch follow-up sequence, mark touches sent manually. No auto-send.
11. Use **Quick actions** to open Proposals, Leads, Metrics, or Deploys as needed.

## Optional

- **Result Target (per lead)**: Before or after proposal, set a **Result Target** on the lead (current state, target state, metric, timeline). Proposals that have a result target are framed as outcome contracts. See **Client Success** below.
- **ROI (per lead)**: On a lead detail page, use **Generate ROI** to create an ROI estimate (why now, pilot, assumptions). Use in proposal: next proposal generation will include ROI + pilot when present.
- **Client Success (per lead, after approval)**: On a lead with status APPROVED / BUILDING / SHIPPED, use the **Client Success** card to capture baseline snapshot, log interventions, add weekly outcome scorecard entries, track risks/bottlenecks, and log client feedback. Use **Generate proof from outcomes** to build proof posts that include measurable results. See `docs/CLIENT_SUCCESS_LAYER.md`.
- **Operator chat** (nav → Chatbot): Ask “What happened today?”, “Which leads are best?”, “What bottleneck should I fix?”, “Where am I leaking money?” Answers cite sources (e.g. per money scorecard, per brief), flag when inferring, and say when data is missing. Uses brief, constraint, money scorecard, ROI summaries, learning/knowledge context.
- **Learning** (nav → Learning): Ingest YouTube videos/channels; transcripts → summaries → improvement proposals. Use **Promote to playbook** and **Produced** (proposal template / case study / automation / knowledge only) to curate; human approves before any change applies.
- **Feedback notes** (on Command Center): Add short notes. Stored for future context.
- **Metrics**: Pipeline health, conversion flow, constraint, “what changed since last run”, error trends.
- **Settings**: Research engine status, automation toggles, **autopilot guardrails** (last run status, human-only list), project monetization mapping, last run/briefing timestamps.

For a high-level map of the system (Acquire / Deliver / Improve), see **docs/SYSTEM_MAP.md**.

## What to verify on Command Center (testing / production checks)

When testing (local or production), verify these items render correctly on the Command Center page:

- [ ] **Money Scorecard** — Cash, revenue won, turnaround, leads, qualified, proposals, follow-ups, deals, bottleneck. Numbers are current (not stale or zero when data exists).
- [ ] **Pat/Tom Weekly Scorecard** — Sentence fills with real numbers, 7 KPIs render.
- [ ] **Failures & Interventions** — Card renders. Shows failed runs, stale leads, stuck proposals, approval queue. If nothing is stuck, card says so (not blank).
- [ ] **Brief Me** — Button works. Generates a briefing with current data. Saves OPERATOR_BRIEFING artifact.
- [ ] **Leverage Score** — Number renders (0–100). Breakdown by component visible.
- [ ] **Constraint** — Card shows current bottleneck with evidence (counts, deltas). Not blank.
- [ ] **Knowledge Queue / Top Suggestions** — Cards render if knowledge data exists.
- [ ] **Follow-up Discipline** — Due today, overdue, no touch 7d, overdue list.
- [ ] **Referral Engine** — Asks this week, received, eligible.
- [ ] **Sales Leak** — Stage counts, worst leak identified.
- [ ] **Quick actions** — Links to Proposals, Leads, Metrics, Deploys work.
- [ ] **Workday Run** — "Start Workday Run" button visible; if clicked, run completes and report appears.

See `docs/TESTING_SIDE_PANEL.md` for the full testing strategy and operator checklists.

## Safety (unchanged)

- Auto-send proposals: **OFF**. Auto-build: **OFF**. Human approval still required for proposal send and build.

## Cron (optional)

To run the workday flow on a schedule (e.g. before 9 AM):

```bash
curl -X POST https://your-domain/api/ops/workday-run \
  -H "Authorization: Bearer YOUR_RESEARCH_CRON_SECRET"
```

Use the same secret as `RESEARCH_CRON_SECRET` (or ensure your cron job is authenticated).
