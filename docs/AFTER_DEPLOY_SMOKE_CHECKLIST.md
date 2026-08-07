# After Deploy Smoke Checklist

Run immediately after every production deploy. Do not skip.
**Goal:** confirm nothing broke. If anything fails, rollback first, investigate second.

**Canonical operator home:** `https://evenslouis.ca/pro/dashboard`  
**Public site:** `https://evenslouis.ca`

---

## Automated (30 seconds)

Run these from your terminal. Both must pass before you do manual checks.

```bash
# 1. Curl-based smoke test (public + /pro login/dashboard/health)
./scripts/smoke-test.sh https://evenslouis.ca https://evenslouis.ca/pro

# 2. Health only (quick sanity)
curl -s https://evenslouis.ca/api/health
curl -s https://evenslouis.ca/pro/api/health
```

**Expected:** smoke-test.sh exits 0. Both health endpoints return `{ "ok": true }` with checks green.

**If health fails → rollback immediately:**
```bash
ssh $DEPLOY_SERVER 'cd /root/client-engine && git reset --hard HEAD~1 && bash deploy.sh'
```

---

## Manual checks (3–5 min)

Open production in a real browser (operator paths under `/pro`).

| # | Check | How | Pass | Fail → do this |
|---|-------|-----|------|-----------------|
| 1 | **Login** | `https://evenslouis.ca/pro/login` → log in | `/pro/dashboard` loads, no redirect loop | Rollback. Check `NEXTAUTH_URL` is origin-only (no `/pro`), `AUTH_TRUST_HOST=true`, `AUTH_SECRET`, run `npm run reset-auth` on VPS |
| 2 | **Command Center** | Open `/pro/dashboard/command` (or founder home) | Scorecard/Failures render, data is not stale | Rollback. Check server logs for query errors |
| 3 | **Lead detail** | Open any lead at `/pro/dashboard/leads/[id]` | Artifacts load, pipeline actions visible | Rollback. Check DB connectivity |
| 4 | **Proposals** | Open `/pro/dashboard/proposals` | List loads | Rollback |
| 5 | **Metrics** | Open `/pro/dashboard/metrics` | Page loads | Rollback |
| 6 | **API auth gate** | `curl -s https://evenslouis.ca/pro/api/leads` | Returns 401 (no cookie = auth working) | **Critical:** Auth is broken. Rollback immediately |
| 7 | **SSL** | smoke-test.sh checks this, or manually check cert | Certificate valid, not expired | Renew cert (certbot or hosting panel) |

---

## Rollback

If any check fails after deploy:

```bash
# Option A: rollback script (if set up)
ssh $DEPLOY_SERVER '/root/rollback-client-engine.sh'

# Option B: manual
ssh $DEPLOY_SERVER 'cd /root/client-engine && git log --oneline -5 && git reset --hard HEAD~1 && bash deploy.sh && curl -fsS https://evenslouis.ca/pro/api/health'
```

See [DEPLOY_SSH_SETUP.md](DEPLOY_SSH_SETUP.md) for full rollback details.

---

## Optional: run Playwright against prod operator OS

```bash
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=https://evenslouis.ca/pro npm run test:e2e
```

Set `E2E_EMAIL`/`E2E_PASSWORD` for authenticated tests. Keep `NEXTAUTH_URL` as origin-only.

---

## Related

- Full Sprint 1–9 path smoke: [DEPLOY_CHECKLIST_SPRINTS_1_9.md](DEPLOY_CHECKLIST_SPRINTS_1_9.md) §5 (use `/pro/...` URLs)
- Architecture: [decisions/007-pro-base-path-deployment.md](decisions/007-pro-base-path-deployment.md)
