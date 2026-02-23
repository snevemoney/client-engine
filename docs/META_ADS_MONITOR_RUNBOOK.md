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

**Actions:** All changes happen in Ads Manager. The dashboard is read-only. Use insights as signals, then open Ads Manager to adjust.

## Daily 5-minute review flow

1. Open **Dashboard → Meta Ads**
2. Set range to **7d** (or 14d/30d for trends)
3. Check **"Needs attention"** badge — how many warn/critical insights?
4. Click **Refresh** (or rely on cache if recently synced)
5. Scan KPI cards — trend arrows show vs prior period (spend, leads, CPL, CTR)
6. Read **Operator Insights** — any warnings or recommendations?
7. Skim tables — row badges (No leads, Fatigue, High CPL, Learning, No delivery)
8. Check Delivery column — learning/limited/no delivery?
9. If action needed, open Ads Manager and make changes there

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

## Limitations (V1.1)

- Read-only. No edits from the app.
- Single account. Multi-account support is a future enhancement.
- Lead metrics depend on Meta Pixel/CAPI Lead events being set up.
- Cache: 10 min TTL. Click Refresh with bypass for fresh data.
- Thumbnails not shown (to avoid rate limits).
- Delivery/learning fields may be empty for some account types.
