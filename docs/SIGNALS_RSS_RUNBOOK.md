# Signal Engine RSS Runbook

Signal Engine ingests RSS/Atom feeds, scores items by keyword relevance, and surfaces them in the dashboard.

## Setup

1. **DB**: Prisma models `SignalSource`, `SignalItem`, `SignalSyncLog` are in `prisma/schema.prisma`. Run `npx prisma db push` if needed.

2. **Add source**: Go to `/dashboard/signals`, click "Add source", enter name and feed URL. Default mode is MOCK.

3. **Sync**: Click "Sync" on a source. Behavior depends on mode.

## Modes

| Mode   | Local (dev)            | Production           |
|--------|------------------------|----------------------|
| **OFF**   | No sync                | No sync              |
| **MOCK**  | Inserts 3 mock items   | Inserts 3 mock items |
| **MANUAL**| No auto sync           | No auto sync         |
| **LIVE**  | Skipped (prod only)    | Fetches real feed    |

- **OFF**: No sync regardless of environment.
- **MOCK**: Use in local to test UI and scoring without hitting external URLs.
- **MANUAL**: Reserved for future manual paste/import; no sync now.
- **LIVE**: Real feed fetch. Only runs when `NODE_ENV=production`.

## Scoring (V1)

- Keywords defined in `src/lib/signals/scoring-rules.ts`
- Default keywords: hiring, budget, ads, marketing, automation, ai, lead, sales, growth, saas, startup, revenue, integration, api, newsletter, content, conversion
- Score 0–100; matched keywords become tags.

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/signals/sources` | GET | List sources |
| `/api/signals/sources` | POST | Create source |
| `/api/signals/sources/[id]` | PATCH | Update source |
| `/api/signals/sources/[id]` | DELETE | Delete source |
| `/api/signals/sources/[id]/sync` | POST | Trigger sync |
| `/api/signals/items` | GET | List items (filters: sourceId, status, minScore) |
| `/api/signals/items/[id]` | PATCH | Update status/tags |

## Manual Smoke Test Checklist

- [ ] Navigate to `/dashboard/signals`
- [ ] Add source (name + URL)
- [ ] Set mode to MOCK, click Sync → items appear
- [ ] Change mode to OFF, Sync → "no sync" message, no new items
- [ ] Change mode to LIVE (local), Sync → "production only" message, no fetch
- [ ] Filter items by source, status, min score
- [ ] Change item status (new → read → archived)
- [ ] Verify score badges and tags
- [ ] Add LIVE source with real feed URL, deploy to prod, Sync → real items

## Troubleshooting

**Sync fails with "Feed fetch failed"**
- Check feed URL is valid and reachable
- CORS: feeds must allow server-side fetch (most RSS do)
- Use MOCK in local to bypass network

**No items after Sync**
- OFF/MANUAL: expected
- LIVE in local: expected (use prod or MOCK)
- MOCK: first sync creates 3 items; repeat sync skips (dedupe by URL)

**Score always 0**
- Check `scoring-rules.ts` keywords
- Add keywords if your domain terms differ

## Files

- `prisma/schema.prisma` — SignalSource, SignalItem, SignalSyncLog
- `src/lib/signals/rss-sync.ts` — Sync logic
- `src/lib/signals/scoring-rules.ts` — Keyword scoring
- `src/app/api/signals/**` — API routes
- `src/app/dashboard/signals/page.tsx` — Dashboard page
- `src/components/dashboard/signals/SignalsDashboard.tsx` — UI
