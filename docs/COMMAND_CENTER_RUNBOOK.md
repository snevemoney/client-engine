# Command Center — How to use it daily

## Before work (one click)

1. Open the dashboard. You land on **Command Center** (`/dashboard` or `/dashboard/command`).
2. Click **Start Workday Run**.
   - Runs research (if `RESEARCH_ENABLED=1`), pipeline for up to 20 eligible leads, and safe retries for failed runs.
   - Creates a **WORKDAY_RUN_REPORT** artifact (visible in Metrics “What changed since last run”).
3. Leave. No further clicks needed.

## After work (one click)

1. Open the dashboard → **Command Center**.
2. **Money Scorecard** (top of page): Leads today/7d, proposals sent 7d, follow-ups due, deals won, revenue won 30d, avg deal size, stale opportunities, bottleneck + constraint impact note.
3. Click **Brief Me**.
   - Generates a plain-English briefing: what happened, what was created, what failed, what needs approval, current bottleneck, top opportunities, 30-minute action plan, and **knowledge-derived improvement suggestions** (if any).
   - Saves an **OPERATOR_BRIEFING** artifact and shows the summary on the page.
4. Use **Queue summary** and **Constraint** card to see where things are stuck.
5. **Follow-up**: Open **Proposals** → Follow-up Queue (Needs sequence / In progress / Stale). Open a lead with proposal sent → generate 5-touch follow-up sequence, mark touches sent manually. No auto-send.
6. Use **Quick actions** to open Proposals, Leads, Metrics, or Deploys as needed.

## Optional

- **ROI (per lead)**: On a lead detail page, use **Generate ROI** to create an ROI estimate (why now, pilot, assumptions). Use in proposal: next proposal generation will include ROI + pilot when present.
- **Operator chat** (nav → Chatbot): Ask “What happened today?”, “Which leads are best?”, “What bottleneck should I fix?”, “Where am I leaking money?” Uses brief, constraint, money scorecard, ROI summaries, learning/knowledge context.
- **Learning** (nav → Learning): Ingest YouTube videos/channels; transcripts → summaries → improvement proposals. Human approves before apply.
- **Feedback notes** (on Command Center): Add short notes. Stored for future context.
- **Metrics**: Pipeline health, conversion flow, constraint, “what changed since last run”, error trends.
- **Settings**: Research engine status, automation toggles, project monetization mapping, last run/briefing timestamps.

## Safety (unchanged)

- Auto-send proposals: **OFF**. Auto-build: **OFF**. Human approval still required for proposal send and build.

## Cron (optional)

To run the workday flow on a schedule (e.g. before 9 AM):

```bash
curl -X POST https://your-domain/api/ops/workday-run \
  -H "Authorization: Bearer YOUR_RESEARCH_CRON_SECRET"
```

Use the same secret as `RESEARCH_CRON_SECRET` (or ensure your cron job is authenticated).
