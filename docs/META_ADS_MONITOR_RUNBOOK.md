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

## Daily 5-minute routine

1. Open **Dashboard → Meta Ads**
2. Set range to **7d** (or 14d/30d for trends)
3. Click **Refresh**
4. Scan KPI cards — Is spend on track? Are leads coming in?
5. Read **Operator Insights** — Any warnings or recommendations?
6. Skim tables — Paused campaigns, zero-spend ad sets, high-CPL ads
7. If action needed, open Ads Manager and make changes there

## What to do when alerts appear

| Alert | Action |
|-------|--------|
| High spend, zero leads | Pause or narrow audience; test new creative |
| Frequency > 3 | Expand audience or refresh creative |
| CPL spike | Check audience overlap; pause underperformers |
| Low CTR | A/B test headline and creative |
| Learning limited | Increase budget or broaden audience |
| Paused campaign | Re-activate if ready; otherwise leave paused |

## Limitations (V1)

- Read-only. No edits from the app.
- Single account. Multi-account support is a future enhancement.
- Lead metrics depend on Meta Pixel/CAPI Lead events being set up.
- Data is fetched live; no persistent cache. Refresh to get latest.
- Thumbnails not shown (to avoid rate limits).
