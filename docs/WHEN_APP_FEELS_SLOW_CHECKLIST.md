# When App Feels Slow — Troubleshooting Checklist

When pages take too long or the app feels sluggish, inspect in this order.
Stop at the first thing that's wrong — fix it before continuing.

---

## 1. Server health (check first)

| Check | How | Pass | Fail → do this |
|-------|-----|------|-----------------|
| Health endpoint fast? | `time curl -s https://evenslouis.ca/api/health` | Responds in <2s | Server overloaded → check process/resources below |
| CPU/memory OK? | SSH in: `top` or `htop` | CPU <80%, memory not maxed | Kill runaway processes, restart app |
| Disk not full? | SSH in: `df -h` | <80% used on root partition | Clean up logs, old builds, backups |
| Node process running? | `pm2 status` or `systemctl status client-engine` | Status: online / active | Restart: `pm2 restart all` or `systemctl restart client-engine` |

---

## 2. Database

| Check | How | Pass | Fail → do this |
|-------|-----|------|-----------------|
| DB connected? | Health endpoint: `checks.db.ok` | `true` | Check `DATABASE_URL`, restart DB |
| Tables large? | `SELECT count(*) FROM "PipelineRun"; SELECT count(*) FROM "Artifact";` | Reasonable (< 100k each) | Consider archiving old runs, adding indexes |
| Slow queries? | Check server stdout/stderr for slow Prisma logs | No queries >1s | Add indexes, optimize query in code |

---

## 3. Network / SSL

| Check | How | Pass | Fail → do this |
|-------|-----|------|-----------------|
| Slow from you or everywhere? | Try from phone on cellular, or a different network | Slow everywhere = server issue | Slow only for you = your network |
| SSL valid? | `echo \| openssl s_client -servername evenslouis.ca -connect evenslouis.ca:443 2>/dev/null \| openssl x509 -noout -dates` | Not expired | Renew cert |
| DNS resolving? | `nslookup evenslouis.ca` | Resolves to correct IP | Check DNS records |

---

## 4. Specific pages

| Page | Likely cause | Fix |
|------|-------------|-----|
| **Command Center** | Heavy data aggregation (scorecard, failures, constraint) | Check server logs for slow queries; reduce date range |
| **Metrics** | Many pipeline runs | Paginate or limit date range |
| **Lead detail** | Many artifacts on one lead | Check artifact count; clean duplicates if any |
| **Chat** | LLM response time | Check [OpenAI status](https://status.openai.com); wait or reduce context |
| **Knowledge/Learning ingest** | Transcript fetch or LLM summarization | Check provider status, retry later |

---

## 5. Pipeline / background

| Check | How | Pass | Fail → do this |
|-------|-----|------|-----------------|
| Pipeline run stuck? | `/dashboard/metrics` — any run with no finishedAt? | All runs complete | Cancel stuck run, retry |
| Research cron too frequent? | Check cron logs on VPS | Runs not overlapping | Reduce frequency or add lock |
| Worker running? (if using email ingestion) | `pm2 status` or check worker process | Worker online, Redis connected | Restart worker, check Redis |

---

## 6. Quick fixes (in escalation order)

1. **Restart the app:** `pm2 restart all` or `systemctl restart client-engine`
2. **Clear Next.js cache:** `rm -rf .next/cache && npm run build && npm run start`
3. **Re-sync DB schema:** `npx prisma db push`
4. **Check for missing indexes:** Review Prisma schema for fields used in WHERE/ORDER BY
5. **If nothing helps:** Check `npm run start` stdout for errors; check VPS provider status

---

*See also: [VPS_DEPLOY_CHECKLIST.md](VPS_DEPLOY_CHECKLIST.md) (logs and failures section), [TESTING_SIDE_PANEL.md](TESTING_SIDE_PANEL.md) (testing strategy).*
