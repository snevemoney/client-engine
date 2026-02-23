# Production Operator Loop

Short runbook for daily prod operation.

---

## Deploy

```bash
./scripts/sync-and-deploy.sh      # from your Mac
# or
./scripts/deploy-remote.sh        # if server has deploy key
./scripts/deploy-remote.sh --full # with DB sync (Prisma changed)
```

---

## Health check

```bash
curl -s https://evenslouis.ca/api/health
```

Expect `{"ok":true,"checks":{...}}`. If not, check app/worker logs.

---

## 5-minute smoke test

1. **Homepage** — Loads without error
2. **Login** — Sign in works
3. **Command Center** — `/dashboard/command` loads, cards render
4. **Workday run** — Click Start Workday Automation, completes, Today's AI Activity refreshes
5. **Lead detail** — Open a lead, load detail, try one safe action (e.g. status change)

## Meta Ads operator loop (when configured)

1. **Refresh dashboard** — Overview tab → Refresh (or rely on cache).
2. **Generate recommendations** — Recommendations tab → Generate.
3. **Review critical/warn** — Scan severity badges; read evidence.
4. **Mark false positives** — If a rec is wrong, click False + to train thresholds.
5. **Approve safe actions** — Approve recs you agree with; Dismiss others.
6. **Apply** — Dry-run first (Settings → dry-run ON). Apply approved recs; Action History shows simulated.
7. **Check Action History** — Verify status (simulated/blocked/success), message, evidence.
8. **Verify in Meta Ads Manager** — For live applies (dry-run OFF), confirm changes in Ads Manager.

Settings: dry-run, target CPL, protected IDs, cooldown, daily cap. See META_ADS_MONITOR_RUNBOOK.md.

---

## Webhook fails

- **Env:** `NOTIFY_WEBHOOK_URL` or `DISCORD_WEBHOOK_URL` must be set
- **Payload:** Includes `event`, `leadId`, `leadTitle`, `leadStatus`, `stepName`, `message`, `appUrl`
- **Links:** App URL for webhook links uses `NEXT_PUBLIC_APP_URL` → `APP_URL` → `https://evenslouis.ca`
- **Check:** Test with a pipeline failure or new research lead; Discord/Slack should receive
- **If no alerts:** Verify URL, check app logs for `[notify] Webhook error`

---

## Logs

**On VPS (Docker):**
```bash
docker compose logs --tail=100 app worker
docker compose logs -f app worker   # follow
```

**From Mac:**
```bash
ssh root@69.62.66.78 "cd /root/client-engine && docker compose logs --tail=50 app worker"
```

---

## Quick links

| What | Where |
|------|-------|
| Deploy | `./scripts/sync-and-deploy.sh` |
| Health | `curl -s https://evenslouis.ca/api/health` |
| Metrics | `/dashboard/metrics` |
| Ops panel | `/dashboard/ops-health` |
| Full runbook | `docs/VPS_DEPLOY_CHECKLIST.md` |
