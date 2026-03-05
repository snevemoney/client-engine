# API Routes

> Auto-generated on 2026-03-05. 351 route files.

| Path | Methods |
|------|---------|
| `/api/agents/approvals` | GET, POST |
| `/api/agents/cron` | POST |
| `/api/agents/run` | POST |
| `/api/agents/runs` | GET |
| `/api/artifacts/[id]` | GET, PATCH |
| `/api/audit-actions` | GET |
| `/api/audit-actions/summary` | GET |
| `/api/auth/[...nextauth]` |  |
| `/api/automation-suggestions/[id]/apply` | POST |
| `/api/automation-suggestions/[id]` | PATCH |
| `/api/automation-suggestions/generate` | POST |
| `/api/automation-suggestions` | GET |
| `/api/automation-suggestions/summary` | GET |
| `/api/brain/chat` | POST |
| `/api/brief` | GET |
| `/api/build-tasks/[id]` | GET, PATCH |
| `/api/build-tasks` | GET, POST |
| `/api/build/[id]` | POST |
| `/api/cadence/[id]` | PATCH |
| `/api/cadence/process` | POST |
| `/api/cadence` | GET |
| `/api/campaigns/[id]` | GET, PATCH, DELETE |
| `/api/campaigns` | GET, POST |
| `/api/capture` | POST |
| `/api/checklist/generate` | POST |
| `/api/checklist` | GET |
| `/api/command-center` | GET |
| `/api/content-assets/[id]` | PATCH |
| `/api/content-assets` | GET, POST |
| `/api/content-posts/[id]` | PATCH |
| `/api/content-posts` | GET |
| `/api/decisions` | GET |
| `/api/delivery-milestones/[id]` | PATCH |
| `/api/delivery-projects/[id]/activity` | POST |
| `/api/delivery-projects/[id]/builder/create` | POST |
| `/api/delivery-projects/[id]/builder/deploy` | POST |
| `/api/delivery-projects/[id]/builder/deploy/status` | GET |
| `/api/delivery-projects/[id]/builder/feedback` | GET |
| `/api/delivery-projects/[id]/builder/regenerate` | POST |
| `/api/delivery-projects/[id]/builder/sections` | GET, PATCH |
| `/api/delivery-projects/[id]/builder/status` | GET |
| `/api/delivery-projects/[id]/builder/support/[requestId]` | PATCH |
| `/api/delivery-projects/[id]/builder/support` | GET |
| `/api/delivery-projects/[id]/checklist/toggle` | POST |
| `/api/delivery-projects/[id]/client-confirm` | POST |
| `/api/delivery-projects/[id]/complete` | POST |
| `/api/delivery-projects/[id]/create-proof-candidate` | POST |
| `/api/delivery-projects/[id]/handoff/complete` | POST |
| `/api/delivery-projects/[id]/handoff/start` | POST |
| `/api/delivery-projects/[id]/milestones/[milestoneId]` | PATCH |
| `/api/delivery-projects/[id]/milestones` | POST |
| `/api/delivery-projects/[id]/portal-token` | POST |
| `/api/delivery-projects/[id]/referral/decline` | POST |
| `/api/delivery-projects/[id]/referral/receive` | POST |
| `/api/delivery-projects/[id]/referral/request` | POST |
| `/api/delivery-projects/[id]/request-proof` | POST |
| `/api/delivery-projects/[id]/retention/complete` | POST |
| `/api/delivery-projects/[id]/retention/log-call` | POST |
| `/api/delivery-projects/[id]/retention/log-email` | POST |
| `/api/delivery-projects/[id]/retention/schedule` | POST |
| `/api/delivery-projects/[id]/retention/snooze` | POST |
| `/api/delivery-projects/[id]/retention/status` | POST |
| `/api/delivery-projects/[id]/review/receive` | POST |
| `/api/delivery-projects/[id]/review/request` | POST |
| `/api/delivery-projects/[id]` | GET, PATCH |
| `/api/delivery-projects/[id]/status` | POST |
| `/api/delivery-projects/[id]/testimonial/decline` | POST |
| `/api/delivery-projects/[id]/testimonial/receive` | POST |
| `/api/delivery-projects/[id]/testimonial/request` | POST |
| `/api/delivery-projects/[id]/upsell` | POST |
| `/api/delivery-projects/gaps-summary` | GET |
| `/api/delivery-projects/handoff-queue` | GET |
| `/api/delivery-projects/handoff-summary` | GET |
| `/api/delivery-projects/handoff-weekly` | GET |
| `/api/delivery-projects/retention-gaps-summary` | GET |
| `/api/delivery-projects/retention-queue` | GET |
| `/api/delivery-projects/retention-summary` | GET |
| `/api/delivery-projects/retention-weekly` | GET |
| `/api/delivery-projects` | GET, POST |
| `/api/delivery-projects/summary` | GET |
| `/api/enrich/[id]` | POST |
| `/api/flywheel/batch` | GET, POST |
| `/api/flywheel/simulate` | POST |
| `/api/flywheel/trigger` | POST |
| `/api/followup/[leadId]` | GET, POST |
| `/api/followups` | GET |
| `/api/followups/summary` | GET |
| `/api/forecast/current` | GET |
| `/api/forecast/history` | GET |
| `/api/forecast/snapshot` | POST |
| `/api/forecast/targets` | GET |
| `/api/health` | GET |
| `/api/in-app-notifications/[id]/read` | POST |
| `/api/in-app-notifications/read-all` | POST |
| `/api/in-app-notifications` | GET |
| `/api/intake-leads/[id]/activity` | POST |
| `/api/intake-leads/[id]/delivery` | POST |
| `/api/intake-leads/[id]/draft` | POST |
| `/api/intake-leads/[id]/followup-complete` | POST |
| `/api/intake-leads/[id]/followup-log-call` | POST |
| `/api/intake-leads/[id]/followup-log-email` | POST |
| `/api/intake-leads/[id]/followup-snooze` | POST |
| `/api/intake-leads/[id]/mark-lost` | POST |
| `/api/intake-leads/[id]/mark-sent` | POST |
| `/api/intake-leads/[id]/mark-won` | POST |
| `/api/intake-leads/[id]/promote` | POST |
| `/api/intake-leads/[id]/proof-candidate` | POST |
| `/api/intake-leads/[id]/proposal` | POST |
| `/api/intake-leads/[id]` | GET, PATCH |
| `/api/intake-leads/[id]/score` | POST |
| `/api/intake-leads/[id]/set-followup` | POST |
| `/api/intake-leads/[id]/sync-pipeline` | POST |
| `/api/intake-leads/action-summary` | GET |
| `/api/intake-leads/bulk-promote` | POST |
| `/api/intake-leads/bulk-score` | POST |
| `/api/intake-leads` | GET, POST |
| `/api/intake-leads/summary` | GET |
| `/api/integrations/[provider]/disconnect` | POST |
| `/api/integrations/[provider]` | PATCH |
| `/api/integrations/[provider]/test` | POST |
| `/api/integrations/data` | GET |
| `/api/integrations/registry` | GET |
| `/api/integrations` | GET |
| `/api/integrations/usage` | GET |
| `/api/intelligence/context` | GET |
| `/api/internal/copilot/coach/action` | POST |
| `/api/internal/copilot/coach` | POST |
| `/api/internal/copilot/sessions/[id]/close` | POST |
| `/api/internal/copilot/sessions/[id]` | GET |
| `/api/internal/copilot/sessions` | GET |
| `/api/internal/delivery/context` | GET |
| `/api/internal/execution/metrics` | GET |
| `/api/internal/flywheel` | POST |
| `/api/internal/founder/os/quarter/kpis` | GET, PUT |
| `/api/internal/founder/os/quarter` | GET, PUT |
| `/api/internal/founder/os/week` | GET, PUT |
| `/api/internal/founder/os/week/suggest` | POST |
| `/api/internal/founder/summary` | GET |
| `/api/internal/growth/context` | GET |
| `/api/internal/growth/deals/[id]/events` | POST |
| `/api/internal/growth/deals/[id]/outreach/preview` | POST |
| `/api/internal/growth/deals/[id]/outreach/send` | POST |
| `/api/internal/growth/deals/[id]` | GET, PATCH |
| `/api/internal/growth/deals` | GET, POST |
| `/api/internal/growth/followups/schedule` | POST |
| `/api/internal/growth/outreach/draft` | POST |
| `/api/internal/growth/outreach/send` | POST |
| `/api/internal/growth/prospects` | GET, POST |
| `/api/internal/growth/summary` | GET |
| `/api/internal/leads/context` | GET |
| `/api/internal/memory/apply` | POST |
| `/api/internal/memory/attribution` | GET |
| `/api/internal/memory/run` | POST |
| `/api/internal/memory/summary` | GET |
| `/api/internal/ops/metrics-summary` | GET |
| `/api/internal/retention/context` | GET |
| `/api/internal/revenue/portfolio` | GET |
| `/api/internal/scores/alerts/preferences` | GET, PUT |
| `/api/internal/scores/compute` | POST |
| `/api/internal/scores/history` | GET |
| `/api/internal/scores/latest` | GET |
| `/api/internal/scores/summary` | GET |
| `/api/internal/sidebar-counts` | GET |
| `/api/internal/system/check` | GET |
| `/api/job-schedules/[id]` | GET, PATCH |
| `/api/job-schedules/[id]/run-now` | POST |
| `/api/job-schedules` | GET, POST |
| `/api/jobs/[id]/cancel` | POST |
| `/api/jobs/[id]/retry` | POST |
| `/api/jobs/[id]` | GET |
| `/api/jobs/recover-stale` | POST |
| `/api/jobs/retry-failed` | POST |
| `/api/jobs` | GET |
| `/api/jobs/run` | POST |
| `/api/jobs/summary` | GET |
| `/api/jobs/tick` | POST |
| `/api/knowledge/ingest` | POST |
| `/api/knowledge/queue` | GET, POST |
| `/api/knowledge` | GET |
| `/api/knowledge/search` | GET |
| `/api/knowledge/suggestions/[id]` | PATCH |
| `/api/leads/[id]/approve` | POST |
| `/api/leads/[id]/artifacts` | GET, POST |
| `/api/leads/[id]/client-success` | GET, POST |
| `/api/leads/[id]/copilot` | POST |
| `/api/leads/[id]/deal-outcome` | POST |
| `/api/leads/[id]/driver/ai-fill` | POST |
| `/api/leads/[id]/driver` | PATCH |
| `/api/leads/[id]/opportunity-brief` | GET |
| `/api/leads/[id]/proposal-sent` | POST |
| `/api/leads/[id]/proposal/revise` | POST |
| `/api/leads/[id]/qualification` | PATCH |
| `/api/leads/[id]/referrals` | GET, POST |
| `/api/leads/[id]/reject` | POST |
| `/api/leads/[id]/reusable-assets` | GET, POST |
| `/api/leads/[id]/roi` | GET, POST |
| `/api/leads/[id]` | GET, PATCH, DELETE |
| `/api/leads/[id]/status` | PATCH |
| `/api/leads/[id]/timeline` | GET |
| `/api/leads/[id]/touches` | GET, POST |
| `/api/leads/bulk-pipeline-run` | POST |
| `/api/leads/driver-summary` | GET |
| `/api/leads/followup-queue` | GET |
| `/api/leads` | GET, POST |
| `/api/learning/ingest` | POST |
| `/api/learning/proposal/[artifactId]` | PATCH |
| `/api/learning` | GET |
| `/api/meta-ads/actions` | GET |
| `/api/meta-ads/actions/status` | POST |
| `/api/meta-ads/asset-health` | GET |
| `/api/meta-ads/dashboard` | GET |
| `/api/meta-ads/mode` | GET |
| `/api/meta-ads/recommendations/[id]/apply` | POST |
| `/api/meta-ads/recommendations/[id]` | PATCH |
| `/api/meta-ads/recommendations/generate` | POST |
| `/api/meta-ads/recommendations` | GET |
| `/api/meta-ads/scheduler/run-cron` | POST |
| `/api/meta-ads/scheduler/run` | POST |
| `/api/meta-ads/scheduler/runs` | GET |
| `/api/meta-ads/settings` | GET, PATCH |
| `/api/metrics/bottlenecks` | GET |
| `/api/metrics/conversion` | GET |
| `/api/metrics/cycle-times` | GET |
| `/api/metrics/revenue` | GET |
| `/api/metrics/snapshot` | POST |
| `/api/metrics/snapshots` | GET |
| `/api/metrics/source-performance` | GET |
| `/api/metrics/summary` | GET |
| `/api/metrics/trends` | GET |
| `/api/networking-events` | GET, POST |
| `/api/next-actions/[id]/execute` | POST |
| `/api/next-actions/[id]` | PATCH |
| `/api/next-actions/[id]/template` | GET |
| `/api/next-actions/preferences/[id]` | GET, PATCH, DELETE |
| `/api/next-actions/preferences` | GET, POST |
| `/api/next-actions` | GET |
| `/api/next-actions/run` | POST |
| `/api/next-actions/summary` | GET |
| `/api/notification-channels/[id]` | GET, PATCH |
| `/api/notification-channels/[id]/test` | POST |
| `/api/notification-channels` | GET, POST |
| `/api/notifications/[id]/retry-failed` | POST |
| `/api/notifications/dispatch` | POST |
| `/api/notifications` | GET |
| `/api/notifications/run-escalations` | POST |
| `/api/notifications/summary` | GET |
| `/api/operator-score/current` | GET |
| `/api/operator-score/history` | GET |
| `/api/operator-score/snapshot` | POST |
| `/api/ops-events/page-view` | POST |
| `/api/ops-events` | GET |
| `/api/ops-events/slow` | GET |
| `/api/ops-events/summary` | GET |
| `/api/ops-events/trends` | GET |
| `/api/ops/brief` | GET, POST |
| `/api/ops/chat/execute` | POST |
| `/api/ops/chat` | POST |
| `/api/ops/command` | GET |
| `/api/ops/feedback` | GET, POST |
| `/api/ops/monetization` | GET, PATCH |
| `/api/ops/orphan-check` | GET |
| `/api/ops/planning-themes` | GET, POST |
| `/api/ops/scoreboard` | GET |
| `/api/ops/settings/recommend` | POST |
| `/api/ops/settings` | GET, POST |
| `/api/ops/strategy-week/ai-fill` | POST |
| `/api/ops/strategy-week/history` | GET |
| `/api/ops/strategy-week/priorities/[id]` | PATCH, DELETE |
| `/api/ops/strategy-week/priorities` | POST |
| `/api/ops/strategy-week/review` | PATCH |
| `/api/ops/strategy-week` | GET, POST |
| `/api/ops/weekly-snapshot` | POST |
| `/api/ops/workday-run` | POST |
| `/api/owned-audience` | GET, POST |
| `/api/pipeline/retry-failed` | POST |
| `/api/pipeline/retry/[leadId]` | POST |
| `/api/pipeline/run/[leadId]` | POST |
| `/api/pipeline/run` | POST |
| `/api/portal/notes` | POST |
| `/api/portfolio/[id]` | POST |
| `/api/position/[id]` | POST |
| `/api/projects/[id]/outcome` | GET, POST, PATCH |
| `/api/projects/[id]` | GET, PATCH |
| `/api/projects/github` | POST |
| `/api/proof-assets` | GET, POST |
| `/api/proof-candidates/[id]/mark-ready` | POST |
| `/api/proof-candidates/[id]/promote` | POST |
| `/api/proof-candidates/[id]/reject` | POST |
| `/api/proof-candidates/[id]` | GET, PATCH |
| `/api/proof-candidates` | GET, POST |
| `/api/proof-candidates/summary` | GET |
| `/api/proof-gaps/summary` | GET |
| `/api/proof-records/[id]` | PATCH |
| `/api/proof-records` | GET |
| `/api/proof/generate` | POST |
| `/api/proof/lead-options` | GET |
| `/api/proof` | GET |
| `/api/proposals/[id]/accept` | POST |
| `/api/proposals/[id]/duplicate` | POST |
| `/api/proposals/[id]/followup-complete` | POST |
| `/api/proposals/[id]/followup-log-call` | POST |
| `/api/proposals/[id]/followup-log-email` | POST |
| `/api/proposals/[id]/followup-schedule` | POST |
| `/api/proposals/[id]/followup-snooze` | POST |
| `/api/proposals/[id]/mark-ready` | POST |
| `/api/proposals/[id]/mark-sent` | POST |
| `/api/proposals/[id]/mark-viewed` | POST |
| `/api/proposals/[id]/reject` | POST |
| `/api/proposals/[id]/response` | POST |
| `/api/proposals/[id]` | GET, PATCH |
| `/api/proposals/[id]/snapshot` | POST |
| `/api/proposals/action-summary` | GET |
| `/api/proposals/followup-summary` | GET |
| `/api/proposals/followups` | GET |
| `/api/proposals/gaps-summary` | GET |
| `/api/proposals` | GET, POST |
| `/api/proposals/summary` | GET |
| `/api/propose/[id]` | POST |
| `/api/prospect/ai` | POST |
| `/api/prospect` | POST |
| `/api/referrals/[referralId]` | PATCH |
| `/api/reminders/[id]/complete` | POST |
| `/api/reminders/[id]` | PATCH |
| `/api/reminders` | GET, POST |
| `/api/reminders/run-rules` | POST |
| `/api/reminders/summary` | GET |
| `/api/research/run` | POST |
| `/api/research/web` | POST |
| `/api/research/web/save-to` | POST |
| `/api/results-ledger` | GET |
| `/api/risk/[id]` | PATCH |
| `/api/risk` | GET |
| `/api/risk/run-rules` | POST |
| `/api/risk/summary` | GET |
| `/api/score/[id]` | POST |
| `/api/search` | GET |
| `/api/signals/items/[id]` | PATCH |
| `/api/signals/items` | GET |
| `/api/signals/sources/[id]` | PATCH, DELETE |
| `/api/signals/sources/[id]/sync` | POST |
| `/api/signals/sources` | GET, POST |
| `/api/site/leads` | POST |
| `/api/youtube/ingest/channel` | POST |
| `/api/youtube/ingest/playlist` | POST |
| `/api/youtube/ingest/video` | POST |
| `/api/youtube/jobs` | GET |
| `/api/youtube/learning/[id]/promote` | POST |
| `/api/youtube/learning/[id]/reject` | POST |
| `/api/youtube/learning` | GET |
| `/api/youtube/transcripts/[id]` | DELETE |
| `/api/youtube/transcripts` | GET |
