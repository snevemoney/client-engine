# Night Operator Checklist (10–15 min)

Run this after your day job, before you close the laptop.
**Goal:** confirm the system ran correctly while you were away and nothing is stuck.

---

## Steps

| # | Check | How | Pass | Fail → do this |
|---|-------|-----|------|-----------------|
| 1 | **Health** | `curl -s https://evenslouis.ca/api/health` | 200, `ok: true`, all checks green | Server down or DB issue → SSH in, check process (`pm2 status`), check `NEXTAUTH_URL` / `AUTH_SECRET` |
| 2 | **Login** | Open prod in browser or MCP browser, log in | Dashboard loads, no redirect loop | Run `npm run reset-auth` on VPS, check `ADMIN_EMAIL`/`ADMIN_PASSWORD` |
| 3 | **Command Center** | Read Money Scorecard | Cash, leads, proposals, deals render with current numbers | If blank or stale → check last workday run in Metrics |
| 4 | **Failures & Interventions** | Read the Failures card | Shows failed runs, stale leads, stuck proposals — or says "nothing stuck" | Triage: retry failed runs, follow up on stale leads, note for tomorrow |
| 5 | **Brief Me** | Click **Brief Me** button | Generates a summary with today's data | If error → check server logs, OpenAI key |
| 6 | **Metrics** | Open `/dashboard/metrics` | Runs completed in last 24h, no hanging runs | If runs stuck → retry or check pipeline errors |
| 7 | **Proposals** | Open `/dashboard/proposals` | Any new proposals ready? Follow-up queue? | Revise or mark for tomorrow |
| 8 | **Follow-up queue** | Check overdue follow-ups | No items >7d overdue | Note or handle now |
| 9 | **Knowledge/Learning** | Skim `/dashboard/knowledge` and `/dashboard/learning` | New suggestions from today's ingestion visible | If blank → check if workday run processed queue |
| 10 | **Constraint** | Read Constraint card on Command Center | Current bottleneck shown with evidence | If same as last week → note one action for tomorrow |
| 11 | **Quick sanity** | Open one lead detail | Artifacts present, page renders, no errors | If broken → note the lead ID and error for debugging |

---

## Time budget

10–15 minutes. If it takes longer, something is broken — log it and fix tomorrow.

---

*See also: [TESTING_SIDE_PANEL.md](TESTING_SIDE_PANEL.md) (full testing strategy), [WEEKLY_PRODUCTION_CRITICISM_CHECKLIST.md](WEEKLY_PRODUCTION_CRITICISM_CHECKLIST.md) (weekly deep review).*
