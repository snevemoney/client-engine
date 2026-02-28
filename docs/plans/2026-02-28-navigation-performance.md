# Navigation Performance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce dashboard page navigation time from 2-3s to <1s by converting top pages to RSC + adding HTTP cache headers to API endpoints.

**Architecture:** Convert "use client" pages that fetch via useEffect into server components that query DB directly and pass `initialData` as props to a thin client shell. Add `Cache-Control` headers to read-only API endpoints for pages that stay client-side.

**Tech Stack:** Next.js 15 App Router, Prisma, React Server Components, TypeScript

---

## Task 1: Add cache headers utility for API responses

**Files:**
- Modify: `src/lib/http/response.ts`

**Step 1: Add `swrCacheHeaders` function**

The existing `shortCacheHeaders` uses `max-age=N, stale-while-revalidate=N` (same value for both). Add a more targeted helper:

```typescript
/**
 * SWR cache for browser-side API response caching.
 * maxAge: seconds before browser revalidates.
 * swr: seconds the stale response can be used while revalidating.
 */
export function swrCacheHeaders(maxAge = 15, swr = 60): HeadersInit {
  return {
    "Cache-Control": `private, max-age=${maxAge}, stale-while-revalidate=${swr}`,
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/http/response.ts
git commit -m "feat: add swrCacheHeaders utility for API response caching"
```

---

## Task 2: RSC migration — command-center (P0)

The landing page. Currently 942 lines, all "use client", single `fetch("/api/command-center")`.

**Files:**
- Rename: `src/app/dashboard/command-center/page.tsx` → `src/app/dashboard/command-center/CommandCenterClient.tsx`
- Create: `src/app/dashboard/command-center/page.tsx` (new RSC wrapper)

**Step 1: Extract client component**

Rename the existing `page.tsx` to `CommandCenterClient.tsx`. Change the default export:

```typescript
// CommandCenterClient.tsx — keep "use client" at top
// Change: export default function CommandCenterPage()
// To:     export function CommandCenterClient({ initialData }: { initialData: CommandCenterData })

// Remove the useEffect that fetches /api/command-center
// Replace: const [data, setData] = useState<CommandCenterData | null>(null);
// With:    const [data, setData] = useState<CommandCenterData>(initialData);
// Remove: const [loading, setLoading] = useState(true);
// Remove: const [fetchError, setFetchError] = useState(false);
// Remove: the entire useEffect block (lines ~154-162)
```

**Step 2: Create RSC wrapper**

```typescript
// src/app/dashboard/command-center/page.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CommandCenterClient } from "./CommandCenterClient";

// Reuse the existing API handler's logic directly
async function loadCommandCenterData() {
  // Import the internal function from the API route's shared module
  // or call the API internally using the existing cached handler
  const res = await fetch(`${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/command-center`, {
    cache: "no-store",
    headers: { cookie: "" }, // Will be populated by auth
  });
  // Actually — better approach: extract the query logic into a shared function
  // For now, use a lightweight server-side fetch:
  const { fetchCommandCenterData } = await import("@/lib/command-center/fetch-data");
  return fetchCommandCenterData();
}

export default async function CommandCenterPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const data = await loadCommandCenterData();
  return <CommandCenterClient initialData={data} />;
}
```

**Important:** The command-center API route has 11 parallel DB queries wrapped in `withSummaryCache`. Rather than duplicating them, extract the query logic into `src/lib/command-center/fetch-data.ts` that both the API route and the RSC page can call.

**Step 3: Create shared data fetcher**

```typescript
// src/lib/command-center/fetch-data.ts
// Move the query logic from /api/command-center/route.ts into this file.
// Export: async function fetchCommandCenterData(): Promise<CommandCenterData>
// The API route becomes a thin wrapper: handler calls fetchCommandCenterData()
```

**Step 4: Verify**

- Navigate to /dashboard/command-center — data renders immediately, no loading spinner
- `npx tsc --noEmit 2>&1 | grep command-center` — no type errors

**Step 5: Commit**

```bash
git add src/app/dashboard/command-center/ src/lib/command-center/
git commit -m "perf: RSC migration for command-center page"
```

---

## Task 3: RSC migration — delivery (P0)

Currently fetches `/api/delivery-projects` + `/api/internal/delivery/context` in parallel via useEffect.

**Files:**
- Rename: `src/app/dashboard/delivery/page.tsx` → `src/app/dashboard/delivery/DeliveryClient.tsx`
- Create: `src/app/dashboard/delivery/page.tsx` (RSC wrapper)

**Step 1: Extract client component**

Same pattern as Task 2:
- Rename file, change export name to `DeliveryClient`
- Add `initialData` prop with type `{ projects: DeliveryProject[]; pagination: PaginationMeta; summary: Summary; risk: IntelligenceContext["risk"] | null }`
- Remove the initial `useEffect` that fetches data
- Initialize state from `initialData` props
- Keep all mutation/filter/pagination handlers (they re-fetch via API on user interaction)

**Step 2: Create RSC wrapper**

```typescript
// src/app/dashboard/delivery/page.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DeliveryClient } from "./DeliveryClient";

export default async function DeliveryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const now = new Date();
  const [projects, total, summary] = await Promise.all([
    db.deliveryProject.findMany({
      where: { status: { not: "archived" } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    db.deliveryProject.count({ where: { status: { not: "archived" } } }),
    // summary counts — reuse delivery context
    (async () => {
      const { fetchDeliveryContext } = await import("@/lib/delivery/fetch-context");
      return fetchDeliveryContext();
    })(),
  ]);

  return (
    <DeliveryClient
      initialData={{
        projects: projects.map(p => ({
          id: p.id,
          status: p.status,
          title: p.title,
          clientName: p.clientName,
          company: p.company,
          dueDate: p.dueDate?.toISOString() ?? null,
          health: p.health ?? "on_track",
          proofCandidateId: p.proofCandidateId,
          createdAt: p.createdAt.toISOString(),
        })),
        pagination: { page: 1, pageSize: 25, totalItems: total, totalPages: Math.ceil(total / 25) },
        summary,
        risk: null,
      }}
    />
  );
}
```

**Step 3: Verify + Commit**

```bash
git add src/app/dashboard/delivery/
git commit -m "perf: RSC migration for delivery page"
```

---

## Task 4: RSC migration — risk (P0)

Currently fetches `/api/risk` + `/api/risk/summary` in parallel.

**Files:**
- Rename: `src/app/dashboard/risk/page.tsx` → `src/app/dashboard/risk/RiskClient.tsx`
- Create: `src/app/dashboard/risk/page.tsx` (RSC wrapper)

**Step 1: Extract client component**

- Rename, change export to `RiskClient`
- Props: `{ initialItems: RiskFlag[]; initialPagination: PaginationMeta; initialSummary: RiskSummary | null }`
- Remove initial data-loading useEffect
- Keep all filter/sort/mutation/pagination logic (re-fetches via API)

**Step 2: Create RSC wrapper**

Query `db.riskFlag` directly for initial page load (open flags, ordered by severity, page 1). Also query summary counts.

**Step 3: Verify + Commit**

```bash
git add src/app/dashboard/risk/
git commit -m "perf: RSC migration for risk page"
```

---

## Task 5: RSC migration — next-actions (P0)

Currently fetches `/api/next-actions` + `/api/next-actions/summary` + `/api/next-actions/preferences`.

**Files:**
- Rename: `src/app/dashboard/next-actions/page.tsx` → `src/app/dashboard/next-actions/NextActionsClient.tsx`
- Create: `src/app/dashboard/next-actions/page.tsx` (RSC wrapper)

Same pattern. Props include `initialItems`, `initialSummary`, `initialPreferences`. Remove initial useEffect. Keep all interaction handlers.

**Commit:**
```bash
git add src/app/dashboard/next-actions/
git commit -m "perf: RSC migration for next-actions page"
```

---

## Task 6: Add cache headers to remaining API summary endpoints

For pages that stay client-side (P1/P2), add `Cache-Control` headers so revisits are instant.

**Files to modify** (add `swrCacheHeaders()` to response):
- `src/app/api/forecast/current/route.ts` — 30s
- `src/app/api/reminders/summary/route.ts` — 15s
- `src/app/api/notifications/summary/route.ts` — 15s
- `src/app/api/followups/summary/route.ts` — 15s
- `src/app/api/delivery-projects/summary/route.ts` — 15s
- `src/app/api/proposals/summary/route.ts` — 15s
- `src/app/api/operator-score/current/route.ts` — 30s
- `src/app/api/jobs/summary/route.ts` — 15s
- `src/app/api/delivery-projects/handoff-summary/route.ts` — 15s
- `src/app/api/delivery-projects/retention-summary/route.ts` — 15s

**Pattern for each:**
```typescript
import { swrCacheHeaders } from "@/lib/http/response";

// In the handler, change:
return NextResponse.json(data);
// To:
return NextResponse.json(data, { headers: swrCacheHeaders(15, 60) });
```

**Step: Commit**
```bash
git add src/app/api/
git commit -m "perf: add SWR cache headers to summary API endpoints"
```

---

## Task 7: Code-split heavy components

Add `next/dynamic` to pages that import large client components.

**Files to modify:**

```typescript
// src/app/dashboard/scoreboard/page.tsx
import dynamic from "next/dynamic";
const ScoreboardView = dynamic(
  () => import("@/components/dashboard/scoreboard/ScoreboardView"),
  { loading: () => <div className="animate-pulse h-96 bg-neutral-900/50 rounded-lg" /> }
);

// src/app/dashboard/strategy/page.tsx
const StrategyQuadrantPanel = dynamic(
  () => import("@/components/dashboard/strategy/StrategyQuadrantPanel"),
  { loading: () => <div className="animate-pulse h-96 bg-neutral-900/50 rounded-lg" /> }
);

// src/app/dashboard/youtube/page.tsx
const YouTubeIngestClient = dynamic(
  () => import("@/components/dashboard/youtube/YouTubeIngestClient"),
  { loading: () => <div className="animate-pulse h-96 bg-neutral-900/50 rounded-lg" /> }
);

// src/app/dashboard/settings/page.tsx (IntegrationsSection)
const IntegrationsSection = dynamic(
  () => import("@/components/dashboard/settings/IntegrationsSection"),
  { loading: () => <div className="animate-pulse h-48 bg-neutral-900/50 rounded-lg" /> }
);

// src/app/dashboard/meta-ads/page.tsx (MetaAdsSettingsPanel)
const MetaAdsSettingsPanel = dynamic(
  () => import("@/components/dashboard/meta-ads/MetaAdsSettingsPanel"),
  { loading: () => <div className="animate-pulse h-48 bg-neutral-900/50 rounded-lg" /> }
);
```

**Note:** Each component must have a **named default export** for `next/dynamic` to work. Check and add `export default` if needed.

**Commit:**
```bash
git add src/app/dashboard/scoreboard/ src/app/dashboard/strategy/ src/app/dashboard/youtube/ src/app/dashboard/settings/ src/app/dashboard/meta-ads/
git commit -m "perf: code-split heavy dashboard components with next/dynamic"
```

---

## Task 8: Verification

**Step 1: Build check**
```bash
npx tsc --noEmit
npx next build
```

**Step 2: Test suite**
```bash
npx vitest run --no-file-parallelism
```

**Step 3: Manual verification**

Open browser dev tools Network tab:
1. Navigate to /dashboard/command-center — no spinner, data in HTML
2. Navigate to /dashboard/risk — no spinner, data in HTML
3. Navigate to /dashboard/next-actions — no spinner, data in HTML
4. Navigate to /dashboard/delivery — no spinner, data in HTML
5. Navigate to /dashboard/forecast — check `Cache-Control` header on API response
6. Navigate away and back — cached response should be instant
7. Navigate to /dashboard/scoreboard — observe lazy-loaded chunk in Network tab

**Step 4: Commit verification results**
```bash
git commit -m "chore: verify navigation performance improvements"
```
