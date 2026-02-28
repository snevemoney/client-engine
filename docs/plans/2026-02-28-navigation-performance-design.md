# Navigation Performance Optimization

## Problem

Every dashboard page navigation takes 2-3 seconds. The flow is:
1. Click sidebar link
2. Layout server component: `auth()` DB hit
3. Page JS loads (all "use client", 354KB shared chunk)
4. React mounts with `loading: true`
5. `useEffect` fires `fetch("/api/...")` — another auth() + DB query
6. Data arrives, re-render

That's 3 round trips before content shows. `force-dynamic` on 204 routes disables prefetching.

## Diagnosis

| Metric | Value |
|--------|-------|
| Dashboard pages | 79 |
| Client-side pages ("use client") | 58 (73%) |
| Server-side pages (RSC) | 21 (27%) |
| `force-dynamic` routes | 204 |
| Dynamic imports (`next/dynamic`) | 2 (2.5%) |
| Largest client component | 1,179 lines (ScoreboardView) |
| Largest shared JS chunk | 354KB |
| Static output | 2.8MB / 104 chunks |

## Solution: RSC Migration + API Caching + Code Splitting

### A. RSC Migration (top 15 pages)

Convert "client fetch" pages to "server component + thin client shell":

**Before:**
```tsx
"use client";
export default function RiskPage() {
  const [data, setData] = useState(null);
  useEffect(() => { fetch("/api/risk").then(r => r.json()).then(setData); }, []);
  return loading ? <Spinner /> : <RiskTable data={data} />;
}
```

**After:**
```tsx
// page.tsx — server component
import { db } from "@/lib/db";
import { RiskPageClient } from "./RiskPageClient";

export default async function RiskPage() {
  const session = await auth();
  const data = await db.riskFlag.findMany({ ... });
  return <RiskPageClient initialData={data} />;
}

// RiskPageClient.tsx — "use client" (interactivity only)
export function RiskPageClient({ initialData }) {
  const [data, setData] = useState(initialData);
  // mutations, filters, etc.
}
```

**Target pages:**

P0 (landing/frequent):
- command-center (942 lines)
- risk (485 lines)
- next-actions (569 lines)
- delivery (478 lines)

P1 (medium traffic):
- forecast, proposals, reminders, followups, proposal-followups

P2 (lower traffic):
- retention, inbox, jobs, notifications, handoffs, growth

### B. API Response Caching

Add `Cache-Control: private, max-age=15, stale-while-revalidate=60` to read-only summary endpoints:

- `/api/command-center` — 15s
- `/api/forecast/current` — 30s
- `/api/risk/summary`, `/api/next-actions/summary` — 15s
- `/api/notifications/summary`, `/api/reminders/summary` — 15s
- `/api/delivery-projects/summary` — 15s
- `/api/operator-score/current` — 30s
- All other `/api/*/summary` — 15s

No caching on mutation endpoints (POST/PUT/DELETE).

### C. Code Splitting

Add `next/dynamic` to heavy components not on primary nav path:

- `ScoreboardView` (1,179 lines)
- `StrategyQuadrantPanel` (778 lines)
- `YouTubeIngestClient` (590 lines)
- `IntegrationsSection` (578 lines)
- `MetaAdsSettingsPanel` (515 lines)

### Not Doing (YAGNI)

- Not migrating all 79 pages — just top 15
- Not rewriting data layer — keeping Prisma queries
- Not adding React Query/SWR — RSC eliminates the need
- Not implementing ISR/SSG — private dashboard, always dynamic
- Not splitting 1000+ line components (refactoring, not perf)

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| P0 page time-to-content | ~2-3s | ~0.5-1s |
| Revisiting cached pages | Same 2-3s | Instant |
| Shared JS bundle | 354KB | ~200KB + lazy chunks |
| Loading spinners | Every page | Only on mutations |

## Verification

1. Lighthouse: measure LCP/FCP before and after on command-center
2. `next build` output: check bundle sizes
3. Network tab: confirm cache headers on summary endpoints
4. Manual: navigate 5 pages rapidly, no spinner on any RSC page
