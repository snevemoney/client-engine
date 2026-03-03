# Coding Patterns — AI Rules

When writing code in this codebase, follow these patterns exactly. Do not invent new patterns.

## API Route Pattern

Every route handler MUST use this structure:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/{resource}", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      const data = await db.model.findMany({ ... });
      return NextResponse.json({ data });
    } catch (err) {
      console.error("[{resource}]", err);
      return jsonError("Failed to load", 500);
    }
  });
}
```

**Rules:**
- Always wrap in `withRouteTiming()`
- Always `requireAuth()` first (returns null = unauthorized)
- Use `jsonError()` for all error responses, never raw `new Response()`
- Use `try/catch` — log error with `console.error("[route-name]", err)`
- Never return raw Prisma errors to the client

## Mutation Pattern

```typescript
import { z } from "zod";

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/{resource}", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid input", 400);

    // Rate limit for write endpoints
    const rl = rateLimit(`{resource}:${session.user.id}`, 20, 60_000);
    if (!rl.ok) return jsonError("Rate limited", 429);

    try {
      const result = await db.model.create({ data: parsed.data });
      logOpsEventSafe({ category: "api_action", eventKey: "resource.created", ... });
      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      console.error("[{resource}]", err);
      return jsonError("Failed", 500);
    }
  });
}
```

## Summary/Aggregation Endpoint Pattern

```typescript
import { withSummaryCache } from "@/lib/http/cached-handler";

export async function GET() {
  return withRouteTiming("GET /api/{resource}/summary", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      return await withSummaryCache(
        "resource/summary",
        async () => {
          const [count1, count2] = await Promise.all([
            db.model.count({ where: { ... } }),
            db.model.count({ where: { ... } }),
          ]);
          return { count1, count2 };
        },
        15_000  // 15 second cache
      );
    } catch (err) {
      console.error("[{resource}/summary]", err);
      return jsonError("Failed", 500);
    }
  });
}
```

## Component Pattern

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { AsyncState } from "@/components/ui/AsyncState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export function MyComponent({ entityId }: { entityId: string }) {
  const { data, error, loading, refetch } = useRetryableFetch<MyType>(
    `/api/resource/${entityId}`
  );

  if (loading || error) return <AsyncState loading={loading} error={error} />;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-100">Title</h2>
      {/* Dark theme: bg-neutral-900, text-neutral-100/300/400, border-neutral-800 */}
    </div>
  );
}
```

## Prisma Query Patterns

**Always use `select` when you only need specific fields:**
```typescript
// GOOD
const lead = await db.lead.findFirst({
  where: { id },
  select: { id: true, title: true, score: true },
});

// BAD — fetches all 50+ fields including JSON blobs
const lead = await db.lead.findFirst({ where: { id } });
```

**Parallelize independent queries:**
```typescript
// GOOD
const [leads, proposals, projects] = await Promise.all([
  db.lead.count({ where: { status: "NEW" } }),
  db.proposal.count({ where: { status: "sent" } }),
  db.deliveryProject.count({ where: { status: "in_progress" } }),
]);

// BAD — sequential when independent
const leads = await db.lead.count({ where: { status: "NEW" } });
const proposals = await db.proposal.count({ where: { status: "sent" } });
```

**Use count() for aggregations, not findMany + .length:**
```typescript
// GOOD
const count = await db.lead.count({ where: { status: "NEW" } });

// BAD — fetches all rows just to count
const leads = await db.lead.findMany({ where: { status: "NEW" } });
const count = leads.length;
```

## Error Handling

- Use `jsonError(message, status)` from `@/lib/api-utils` — never raw Response
- Log with `console.error("[route-name]", err)` — always include route context
- Never return raw error messages to clients — sanitize with `sanitizeErrorMessage(err)`
- For fire-and-forget logging: `logOpsEventSafe()` (never await, never throw)

## Naming

- API routes: kebab-case paths (`/api/delivery-projects/[id]/handoff/complete`)
- Lib modules: camelCase filenames (`fetchContext.ts`, `computeAndStore.ts`)
- Components: PascalCase (`ScoreBadge.tsx`, `DeliveryChecklist.tsx`)
- Types/interfaces: PascalCase (`NextActionCandidate`, `BrainStreamEvent`)
- Constants: UPPER_SNAKE_CASE (`AGENT_LIMITS`, `SHARP_DROP_THRESHOLD`)
- Database enums: PascalCase enum name, snake_case or camelCase values

## Imports

```typescript
// 1. External packages
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// 2. @/lib modules
import { db } from "@/lib/db";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { logOpsEventSafe } from "@/lib/ops-events/log";

// 3. @/components
import { Badge } from "@/components/ui/Badge";

// 4. Relative (rare — prefer @/ paths)
import { computeScore } from "./engine";
```

## Things to NEVER Do

- Never use `any` — use `unknown` with type narrowing
- Never `as never` to bypass Prisma enums — validate with Zod
- Never put business logic in route handlers — call `src/lib/` service functions
- Never call the app's own API routes from server code — call services directly
- Never use dynamic `import()` for server-side lib modules — use static imports
- Never fetch all rows when you only need a count
- Never `PATCH /api/leads/[id]` to set status/dealOutcome — use dedicated routes
- Never auto-send proposals or auto-start builds — human approval required
