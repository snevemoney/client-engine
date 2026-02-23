# Meta Ads Monitor — Operator Runbook

Daily 5-minute check for ad performance using the in-app Meta Ads dashboard.

## What the page shows

- **KPI cards** — Spend, impressions, clicks, leads, CPL, CTR, CPC, CPM, frequency
- **Campaigns table** — Per-campaign performance
- **Ad Sets table** — Per-ad-set metrics
- **Ads table** — Per-ad / creative performance
- **Operator Insights** — Rule-based suggestions (high spend no leads, fatigue, top performers, etc.)

## How to read KPI cards

| Metric | Meaning |
|--------|---------|
| Spend | Total ad spend in selected period |
| Impressions | How many times ads were shown |
| Clicks | Link clicks (primary engagement) |
| Leads | Form submits / Lead conversions |
| CPL | Cost per lead (spend ÷ leads) |
| CTR | Click-through rate (clicks ÷ impressions × 100) |
| CPC | Cost per click |
| CPM | Cost per 1000 impressions |
| Freq | Avg times each person saw an ad (impressions ÷ reach) |

## Using insights

1. **High spend, no leads** — Campaign/ad set is spending but not converting. Review targeting or creative.
2. **Frequency fatigue** — People seeing ads too often, CTR dropping. Refresh creative or broaden audience.
3. **CPL above average** — Entity costs more per lead than account. Compare audiences and creative.
4. **Top performer** — Best CPL. Consider scaling or duplicating.
5. **Low CTR creative** — Ad not resonating. Test new hook or angle.
6. **Learning / delivery** — Limited delivery or learning. May need more budget or audience size.

**Actions:** Use pause/resume in-app when you have `ads_management`; other changes in Ads Manager.

## Daily 5-minute review flow

1. Open **Dashboard → Meta Ads**
2. Set range to **7d** (or 14d/30d for trends)
3. Check **"Needs attention"** badge — how many warn/critical insights?
4. Click **Refresh** (or rely on cache if recently synced)
5. Scan KPI cards — trend arrows show vs prior period (spend, leads, CPL, CTR)
6. Read **Operator Insights** — any warnings or recommendations?
7. Skim tables — row badges (No leads, Fatigue, High CPL, Learning, No delivery)
8. Check Delivery column — learning/limited/no delivery?
9. Use **Pause** / **Resume** (with confirm) when needed; or open Ads Manager for other changes

## Weekly creative review flow

1. Set range to **14d** or **30d**
2. Sort mentally or scan Ads table for **Low CTR** badges
3. Identify creatives with CTR &lt; 0.5% and meaningful spend
4. In Ads Manager: duplicate winning structure, test new hooks/angles
5. Pause or refresh fatigued creatives (Frequency &gt; 3)

## What to do for each insight type

| Insight | Action |
|---------|--------|
| High spend, zero leads | Pause or narrow audience; test new creative |
| Frequency fatigue | Expand audience or refresh creative |
| CPL above average | Check audience overlap; pause underperformers |
| Top performer by CPL | Consider scaling budget or duplicating |
| Low CTR creative | A/B test headline and creative |
| Learning limited | Allow 50+ conversions or 7 days; avoid frequent edits |
| No delivery but active | Check budget, audience size, or bidding |
| CPL spike vs prior period | Review recent changes; may need creative refresh |
| CTR drop vs prior period | Consider refreshing creative or audience |
| Paused campaign | Re-activate if ready; otherwise leave paused |

## No data in selected range

When the dashboard shows **"No campaigns in selected range"** with connected status:

1. **Integration is healthy** — The Meta connection and token are valid. The API returned successfully.
2. **No delivery in range** — No campaigns had spend or impressions in the selected date range. Possible causes:
   - All campaigns paused
   - Budget too low or not yet spent
   - Range too narrow (e.g. Today / Yesterday with no activity yet)
3. **What to try**
   - Switch to **30d** or **14d** — campaigns often have delivery over longer windows
   - Check Ads Manager directly to confirm campaign status
   - Verify date range in status strip matches what you expect

## Quick health check (integration verification)

1. Open **Dashboard → Meta Ads**
2. Check **Data status strip** at top: Connection = Connected, Token implied valid if data loads
3. If error: see error message and doc hint; check META_ADS_MONITOR_SETUP.md
4. If "No campaigns in selected range" — integration OK; try 30d or verify in Ads Manager
5. Click **Refresh** — button shows loading state, then "Fresh" for a few seconds after bypass
6. Cache state: Cached = served from 10‑min cache; Fresh = just fetched from Meta API

## Asset Health (V2)

- **Dashboard → Meta Ads → Asset health** — Read-only diagnostics
- Shows: connection, ad account, permissions (if META_APP_ID/SECRET set), Pages, IG, Pixels, WhatsApp
- Use to verify: ads_management present? Pages/Pixels connected?

## Safe action smoke test (V2)

1. Open **Dashboard → Meta Ads**
2. Find a test campaign, ad set, or ad that is ACTIVE
3. Click **Pause** — confirm — wait for success
4. Verify status changes in app and in Meta Ads Manager
5. Click **Resume** — confirm — verify again

If pause/resume fails: token may lack `ads_management`. Check Asset Health page and META_ADS_MONITOR_SETUP.md.

## Failure modes

| Scenario | Expected behavior |
|----------|-------------------|
| Token missing | Error message, doc hint |
| Permission missing (e.g. ads_management) | Pause/resume returns 403; Asset Health may show warn |
| No campaigns in range | Empty state; integration healthy |
| No prior period data | KPI cards show no trend arrows |
| Partial asset-health fetch | Page shows partial data; some checks warn/fail |

## V3 Recommendations lifecycle

1. **Generate** — Click Generate in Recommendations tab. Rules run on current dashboard data (7d range). Recommendations are stored as `queued`.
2. **Review** — Each recommendation shows rule, evidence (spend, leads, CPL, etc.), severity, confidence.
3. **Approve / Dismiss** — Approve to enable Apply; Dismiss to hide.
4. **Apply** — Executes the Meta action (pause, resume, budget). Respects Settings dry-run.
5. **Audit** — Every apply writes to Action History. Status: success, failed, or simulated (dry-run).

## Approval flow

- **queued** → Approve → **approved** → Apply → **applied** (or **failed**)
- **queued** → Dismiss → **dismissed**
- **approved** / **dismissed** → Reset → **queued**

Apply requires approval unless you pass `forceQueued: true` (not exposed in UI by default).

## Dry-run mode

- **ON** (default): Apply simulates the action, writes to Action History as `simulated`, does not call Meta API.
- **OFF**: Apply executes real Meta API call. Toggle in Settings.

## Guardrails

- No autonomous scheduler. All applies are explicit user clicks.
- refresh_creative and wait are recommendation-only — no Meta write.
- Budget changes: ad set level only (documented).
- Protected campaign IDs: rules skip these entities.

## What actions are safe vs not yet automated

| Action | Automated? | Notes |
|--------|------------|------|
| Pause campaign/adset/ad | Yes | Via Apply |
| Resume campaign/adset/ad | Yes | Via Apply |
| Increase ad set budget | Yes | Ad set only, % increase |
| Decrease ad set budget | Yes | Ad set only |
| Refresh creative | No | Recommendation only |
| Campaign budget | No | Ad set only supported |

## Testing (Tier A / Tier B)

**Tier A (local automated):**
- `npm run test -- src/lib/meta-ads/recommendations-rules.test.ts` — rules engine unit tests

**Tier B (manual, MCP/browser):**
1. Meta Ads page loads; tabs Overview, Recommendations, Action History, Settings
2. Generate recommendations (requires dashboard data)
3. Approve/dismiss recommendations
4. Apply in dry-run — Action History shows `simulated`
5. Turn dry-run OFF in Settings; Apply a real pause — verify in Ads Manager
6. Settings persist after save

**Dry-run first:** Always test with dry-run ON before turning off.

- Single account. Multi-account support is a future enhancement.
- Lead metrics depend on Meta Pixel/CAPI Lead events being set up.
- Cache: 10 min TTL. Click Refresh with bypass for fresh data.
- Thumbnails not shown (to avoid rate limits).
- Delivery/learning fields may be empty for some account types.
