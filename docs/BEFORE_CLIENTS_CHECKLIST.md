# Before Clients Checklist

Run before any client call, demo, screenshare, or proposal send.
**Goal:** the app looks professional and data is current. No surprises.

---

## Steps

| # | Check | How | Pass | Fail → do this |
|---|-------|-----|------|-----------------|
| 1 | **Health** | `curl -s https://evenslouis.ca/api/health` | 200, `ok: true`, all checks green | Do not demo. Fix health first (see [VPS_DEPLOY_CHECKLIST.md](VPS_DEPLOY_CHECKLIST.md)) |
| 2 | **Command Center** | Open `/dashboard/command` | Scorecard, Failures, Constraint all render with current data | If cards are blank → check last workday run, restart app |
| 3 | **Target lead** | Open the lead(s) you'll reference | Artifacts present, proposal content correct, no stale data | If missing → run pipeline or check for errors |
| 4 | **Proposal console** | Open the relevant proposal at `/dashboard/proposals/[id]` | Sections render, snippet correct, ready/sent toggles work | If stale → revise proposal before the call |
| 5 | **No visible errors** | Open browser DevTools Console on pages you'll show | No red errors | Fix or note before screensharing |
| 6 | **Proof page** | Open `/dashboard/proof` (if you'll reference proof/case patterns) | Proof posts render, copy button works | If empty → generate proof from a recent lead |
| 7 | **Client Success** | For active/shipped clients, open their lead detail | Results Ledger shows current target/baseline/delta | If missing → add result target before the call |
| 8 | **Sensitive data** | Scan visible pages for client names in wrong places | NDA-safe content only in shared views | Remove or anonymize before screensharing |

---

## Timing

Run 10 minutes before the call. If any check fails, decide: fix it fast or skip showing that page.

---

*See also: [TESTING_SIDE_PANEL.md](TESTING_SIDE_PANEL.md) (full testing strategy), [NIGHT_OPERATOR_CHECKLIST.md](NIGHT_OPERATOR_CHECKLIST.md) (daily ops check).*
