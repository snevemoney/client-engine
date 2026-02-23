# Meta Ads Scheduler — V3.2 Runbook

Safe automation for the recommendations workflow. Scheduler OFF by default.

## What the scheduler does

One cycle:

1. **Generate** — Fetches dashboard data, runs rules, stores queued recommendations (if auto-generate enabled).
2. **Auto-approve** (optional) — Approves queued recs matching allowed rule keys and non-critical severity.
3. **Apply** — Applies approved recs (max `maxAppliesPerRun`). Uses existing apply path → Action History.

All guardrails (protected, cooldown, daily cap, dry-run) apply. Every action is logged.

## Settings (Safe defaults)

| Setting | Default | Notes |
|---------|---------|-------|
| schedulerEnabled | false | Must enable to run |
| schedulerIntervalMinutes | 60 | 5–1440 |
| autoGenerateRecommendations | true | Generate each run |
| autoApplyApprovedOnly | true | Only apply approved |
| autoApproveLowRisk | false | OFF by default |
| allowedAutoApproveRuleKeys | [] | e.g. winner_scale_candidate |
| maxAppliesPerRun | 5 | 1–50 |
| dryRun | true | Simulate by default |

## Manual trigger

1. Open **Dashboard → Meta Ads → Settings**
2. Enable **Scheduler enabled**
3. Click **Run now**
4. Check **Scheduler run history** for summary (gen, applied, simulated, blocked, failed)

## Cron setup (VPS / PM2)

1. Set env: `META_ADS_SCHEDULER_CRON_KEY=your-secret-key`
2. Add to crontab or PM2:
```bash
# Every hour
0 * * * * curl -s -X POST -H "x-cron-key: YOUR_KEY" https://your-app/api/meta-ads/scheduler/run-cron
```

Or use the manual route with session auth if running from a browser/script.

## Auto-approve behavior

When `autoApproveLowRisk` is ON and `allowedAutoApproveRuleKeys` has entries:

- Only **queued** recs with `ruleKey` in the list are auto-approved
- **critical** severity is never auto-approved
- Only **executable** actions (pause, resume, increase_budget, decrease_budget)

Example: allow `winner_scale_candidate` → only those recs get auto-approved, then applied (simulated or live based on dry-run).

## Scheduler run log

Each run creates a `MetaAdsSchedulerRunLog` row:

- status: success | partial | failed | skipped
- trigger: manual | scheduled
- summary: generated, autoApproved, applied, simulated, blocked, failed
- error: if failed

**Skipped** = scheduler disabled. Run log still recorded for visibility.

## Troubleshooting

| Issue | Check |
|-------|-------|
| Run returns skipped | schedulerEnabled = true? |
| No applies | Any approved recs? Action types pause/resume/increase_budget/decrease_budget? |
| All blocked | Protected list? Cooldown? Daily cap? |
| Dry-run confusion | Simulated = no Meta write. Turn dry-run OFF only when ready. |
| Cron 401 | META_ADS_SCHEDULER_CRON_KEY set? Header x-cron-key correct? |
| No recommendations generated | Dashboard data OK? Rules producing recs? |
