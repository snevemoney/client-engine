# Phase 1 — Deployment Readiness

**Generated:** Phase 1 implementation complete  
**Status:** Ready for deploy

---

## 1) What Was Implemented

### A) Integrations System (Settings page)
- **Mode enum:** OFF | MOCK | MANUAL | LIVE on `IntegrationConnection`
- **Fields:** category, prodOnly, displayName, sortOrder (already present; ensured)
- **Providers:** meta, upwork, rss, linkedin, crm, hubspot, pipedrive, calendly, calcom, loom, ga4, search_console, instagram, x, google_business_profile, youtube, stripe, google-ads, github
- **Default modes:** rss=MOCK; upwork, linkedin, crm, calendly, calcom, loom, instagram, x, search_console, google_business_profile, github=MANUAL; meta=OFF
- **Settings UI:** Mode badges, prod-only badges, category labels, mode dropdown in config modal, LIVE disabled in local when prodOnly
- **API:** GET/PATCH /api/integrations, POST /api/integrations/[provider]/test, POST disconnect; PATCH validates mode enum

### B) Provider Resolver + Placeholder Clients
- **Resolver:** `src/lib/integrations/resolver.ts` — `resolveIntegration()`, `resolveConnection()`
  - OFF → shouldRun=false
  - MOCK → useMock=true
  - MANUAL → useManual=true
  - LIVE → useLive=true (or downgrade to MOCK when prodOnly + non-production)
- **Placeholder clients:** `src/lib/integrations/clients/` — upwork, rss, linkedin, calendly, github
- **Runner:** `runProvider(conn)` — dispatches to client by provider
- **Test route:** Uses mode: OFF=skipped, MOCK=mock success, MANUAL=manual message, LIVE=real test (meta token) or "not implemented"

### C) Strategy Logic + Emotion
- **StrategyWeek fields:** keyMetric, keyMetricTarget, biggestBottleneck, missionStatement, whyThisWeekMatters, dreamStatement, fuelStatement
- **Strategy UI:** Logic + Emotion panel (2-column); summary strip (weekly target, key metric, fuel)
- **API:** POST /api/ops/strategy-week accepts new fields

### D) Weekly Reviews Upgrade
- **StrategyWeekReview fields:** score (0–100), whatWorked, whatFailed, whatChanged, nextWeekCommitments, completedAt
- **Reviews UI:** Table, expand, score 1–10 display (stored 0–100), whatWorked, whatFailed, whatChanged, nextWeekCommitments, Complete button
- **API:** PATCH /api/ops/strategy-week/review with validation

### E) Scoreboard (Operator Cockpit)
- **Cards:** Execution, Review status, Operator health, Integration readiness, Alerts, Priorities
- **Execution:** weekly target, key metric, key metric target, fuel statement
- **Alerts:** no weekly target, no key metric, no priorities, review not completed, all integrations OFF
- **API:** GET /api/ops/scoreboard returns keyMetric, keyMetricTarget, fuelStatement, alerts, integrationByMode

---

## 2) Database

- **Schema:** No destructive changes. Uses `prisma db push` (no migrate folder in repo).
- **Run before deploy:**
  ```bash
  npx prisma generate
  npx prisma db push   # if schema changed
  npm run db:seed-integrations   # upsert providers
  ```

---

## 3) New Env Vars

None required for Phase 1. Existing integrations (e.g. Meta Ads) continue to use:
- `META_ADS_ACCESS_TOKEN`
- `META_ADS_ACCOUNT_ID`

---

## 4) Integrations Readiness

| Provider                    | MOCK | MANUAL | LIVE |
|----------------------------|------|--------|------|
| meta                       | ✓    | ✓      | ✓ (token test) |
| upwork                     | ✓    | ✓      | stub |
| rss                        | ✓    | ✓      | ✓ (via SignalSource) |
| linkedin                   | ✓    | ✓      | stub |
| calendly / calcom          | ✓    | ✓      | stub |
| github                     | ✓    | ✓      | stub |
| crm, loom, instagram, x…   | —    | ✓      | stub |

---

## 5) Manual Steps for Production

1. **OAuth / API setup (per platform):**
   - Meta Ads: App in Meta Developers, token, account ID
   - LinkedIn, Instagram, X, Google: OAuth apps, callbacks, scopes (when LIVE is wired)
   - Calendly, GitHub: Personal/org tokens (when LIVE is wired)

2. **Post-deploy:**
   - Visit `/dashboard/settings` — run integration seed if providers missing
   - Set mode per provider (MANUAL/MOCK for most until LIVE is built)

---

## 6) Post-Deploy Smoke Checklist

- [ ] `/dashboard/settings` — integrations list, mode badges, config modal
- [ ] `/dashboard/strategy` — Logic + Emotion panel, summary strip
- [ ] `/dashboard/reviews` — table, expand, complete modal, score
- [ ] `/dashboard/scoreboard` — all cards, alerts list
- [ ] Meta Ads: Test connection (if configured)

---

## 7) Known Limitations

- **LIVE clients:** upwork, linkedin, calendly, github are placeholders; return "not yet integrated"
- **Review score:** Stored 0–100; UI can show 1–10 scale if desired
- **Provider structure:** Single-file clients (`clients/upwork.ts`) instead of per-mode folders; behavior equivalent
- **Lint:** Pre-existing warnings/errors; ScoreboardView Date.now() fixed for purity rule

---

## 8) Production Hardening (Complete)

- **Scoreboard:** API response validated (weekStart required); invalid dates render "—"; priorities/integration counts null-safe; fetch errors set data to null
- **Reviews:** formatWeekRange guards invalid weekStart; expanded row fields optional
- **Integrations:** modeBadge handles undefined/legacy mode; statusBadge/prodOnly/category use optional chaining; formatRelative guards NaN/invalid dates
- **Scoreboard API:** integration byMode only counts valid enum values

---

## 9) Remaining Manual Setup (Only These)

1. **OAuth / API credentials (per platform when ready for LIVE):**
   - Meta Ads: `META_ADS_ACCESS_TOKEN`, `META_ADS_ACCOUNT_ID` (or via Settings)
   - LinkedIn, Instagram, X, Google: Create OAuth apps, set callback URLs, add env vars
   - Calendly, GitHub: Personal/org API tokens when LIVE is wired

2. **Post-deploy:**
   - Run `npm run db:seed-integrations` if providers are missing
   - Visit `/dashboard/settings` and set mode per integration (MANUAL/MOCK typical until LIVE ready)

3. **No other manual steps.** Schema, migrations, seeds, and app logic are automated.

---

## 10) Scripts

```bash
npm run build
npm test
npm run db:seed-integrations
npm run db:push
```
