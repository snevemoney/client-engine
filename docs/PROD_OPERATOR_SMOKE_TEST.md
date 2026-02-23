# Prod Operator Smoke Test

**Time:** 5–10 minutes  
**Purpose:** Daily check that the app is usable before operating.

---

## Prerequisites

- Logged-in session (or credentials ready)
- Browser or curl

---

## 1. Health (30 sec)

```bash
curl -s https://evenslouis.ca/api/health | jq .
# Expect: "ok": true, all checks ok
```

Or: open https://evenslouis.ca/api/health — JSON with `ok: true`.

---

## 2. Public site (1 min)

- **Homepage:** https://evenslouis.ca/ — loads, no errors
- **Work:** https://evenslouis.ca/work — projects visible, images load
- **Contact form:** Scroll to #contact, fill email + message, submit — success message or email received

---

## 3. Login (30 sec)

- Go to https://evenslouis.ca/login
- Sign in with admin credentials
- Redirect to /dashboard

---

## 4. Dashboard pages (3–4 min)

Visit each; confirm page loads, no error boundary:

| Page | URL | Quick check |
|------|-----|-------------|
| Command Centre | /dashboard/command | Cards visible, Section2 loads |
| Strategy | /dashboard/strategy | Panel loads, save strategy + review |
| Ops Health | /dashboard/ops-health | Status visible |
| Sales Leak | /dashboard/sales-leak | Data or empty state |
| Results Ledger | /dashboard/results | Table or empty |
| Leads | /dashboard/leads | List or empty |
| Proposals | /dashboard/proposals | Inbox or empty |
| Build Ops | /dashboard/build-ops | Content loads |
| Metrics | /dashboard/metrics | Scorecard visible |
| Chatbot | /dashboard/chat | Input + send works |
| Learning | /dashboard/learning | Inbox or ingest UI |
| Settings | /dashboard/settings | Page loads |
| Proof | /dashboard/proof | Generate or list |
| Checklist | /dashboard/checklist | List or generate |
| Deploys | /dashboard/deploys | Info visible |
| Conversion | /dashboard/conversion | Data or empty |
| Knowledge | /dashboard/knowledge | May take 15–30s; content loads |
| Meta Ads | /dashboard/meta-ads | KPIs or empty state; Asset health link |

---

## 5. Core workflow (2 min)

1. **Create lead:** /dashboard/leads/new → fill title + source → Create
2. **Lead detail:** Open the new lead → artifacts/pipeline visible
3. **Chat:** Send one message in /dashboard/chat → reply appears

---

## 6. If it fails

| Symptom | Action |
|---------|--------|
| Health not ok | Check DB, Redis, env vars; `docker compose logs app` |
| Login redirect loop | Verify NEXTAUTH_URL, AUTH_SECRET; run reset-auth on server |
| 500 on page | Check `[api:error]` and `[SLOW]` in logs |
| Blank/error boundary | Check browser console; verify API returns 200 |
| Knowledge very slow | Expected; consider reducing limit or adding loading UI |

---

## Meta Ads V2 (optional, when configured)

If META_ACCESS_TOKEN and META_AD_ACCOUNT_ID are set:

1. **Dashboard:** /dashboard/meta-ads — loads, ranges work, KPIs or empty state
2. **Asset Health:** /dashboard/meta-ads/health — connection, permissions, Pages/Pixels
3. **Pause/Resume:** With ads_management token, pause a test ad → verify → resume

See META_ADS_MONITOR_RUNBOOK.md for safe action smoke test.

---

## One-liner smoke (no UI)

```bash
./scripts/smoke-test.sh https://evenslouis.ca
# Expect: Smoke test passed
```
