# After Deploy Smoke Checklist

Run immediately after every production deploy. Do not skip.
**Goal:** confirm nothing broke. If anything fails, rollback first, investigate second.

---

## Automated (30 seconds)

Run these from your terminal. Both must pass before you do manual checks.

```bash
# 1. Curl-based smoke test (homepage, login, dashboard, health, ops/command, SSL)
./scripts/smoke-test.sh https://evenslouis.ca

# 2. Health only (quick sanity)
curl -s https://evenslouis.ca/api/health
```

**Expected:** smoke-test.sh exits 0. Health returns `{ "ok": true }` with all checks green.

**If health fails → rollback immediately:**
```bash
ssh root@69.62.66.78 'cd /root/client-engine && git reset --hard HEAD~1 && bash deploy.sh'
```

---

## Manual checks (3–5 min)

Open production in MCP browser or a real browser.

| # | Check | How | Pass | Fail → do this |
|---|-------|-----|------|-----------------|
| 1 | **Login** | `https://evenslouis.ca/login` → log in | Dashboard loads, no redirect loop | Rollback. Check `NEXTAUTH_URL`, `AUTH_SECRET`, run `npm run reset-auth` on VPS |
| 2 | **Command Center** | Open `/dashboard/command` | Scorecard renders, Failures card renders, data is not stale | Rollback. Check server logs for query errors |
| 3 | **Lead detail** | Open any lead at `/dashboard/leads/[id]` | Artifacts load, pipeline actions visible | Rollback. Check DB connectivity |
| 4 | **Proposals** | Open `/dashboard/proposals` | List loads, at least one proposal visible (if any exist) | Rollback |
| 5 | **Metrics** | Open `/dashboard/metrics` | Page loads, recent runs visible | Rollback |
| 6 | **API auth gate** | `curl -s https://evenslouis.ca/api/leads` | Returns 401 (no cookie = auth working) | **Critical:** Auth is broken. Rollback immediately |
| 7 | **SSL** | smoke-test.sh checks this, or manually check cert | Certificate valid, not expired | Renew cert (certbot or hosting panel) |

---

## Rollback

If any check fails after deploy:

```bash
# Option A: rollback script (if set up)
ssh root@69.62.66.78 '/root/rollback-client-engine.sh'

# Option B: manual
ssh root@69.62.66.78 'cd /root/client-engine && git log --oneline -5 && git reset --hard HEAD~1 && bash deploy.sh && curl -fsS https://evenslouis.ca/api/health'
```

See [DEPLOY_SSH_SETUP.md](DEPLOY_SSH_SETUP.md) for full rollback details.

---

## Optional: run Playwright against prod

```bash
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=https://evenslouis.ca npm run test:e2e
```

21 tests run without login. Set `E2E_EMAIL`/`E2E_PASSWORD` for all tests.

---

*See also: [VPS_DEPLOY_CHECKLIST.md](VPS_DEPLOY_CHECKLIST.md) (full deploy process), [TESTING_SIDE_PANEL.md](TESTING_SIDE_PANEL.md) (testing strategy).*
