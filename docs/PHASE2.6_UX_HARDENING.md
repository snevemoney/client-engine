# Phase 2.6 — UX Hardening + Async Reliability Layer

## Overview

Phase 2.6 hardens the operator UX so the app feels fast, safe, and reliable during real usage. This phase is **not** about new business features. It focuses on debouncing, request dedupe, stale request cancellation, consistent loading/error states, and double-click protection across the dashboard.

## What Was Added

### Shared Utilities

| File | Purpose |
|------|---------|
| `src/lib/ui/debounce.ts` | Generic `debounce()` and `throttle()` utilities |
| `src/lib/ui/date-safe.ts` | `formatDateSafe()`, `formatDateTimeSafe()` — centralized date formatting with "—" fallback |
| `src/lib/ui/error-message.ts` | `toErrorMessage()`, `isAbortError()` — normalize unknown errors to user-friendly strings |
| `src/lib/http/request-key.ts` | `buildRequestKey()`, `fingerprintBody()` — stable keys for dedupe/abort |
| `src/lib/http/fetch-json.ts` | `fetchJson()`, `fetchJsonThrow()` — fetch wrapper with AbortController, JSON parsing, error normalization, optional timeout |

### Hooks

| File | Purpose |
|------|---------|
| `src/hooks/useDebouncedValue.ts` | Debounced value (default 300ms). Input updates immediately; downstream effects use debounced value. |
| `src/hooks/useAbortableAsync.ts` | Run async requests; cancels prior in-flight request when `run()` is called again. Ignores AbortError in UI. |
| `src/hooks/useAsyncAction.ts` | Mutation wrapper with pending lock, double-click protection, optional optimistic callbacks, toast/error normalization |
| `src/hooks/useRetryableFetch.ts` | GET fetch with 1 retry on transient failure, backoff, abort on unmount |

### UI Components

| File | Purpose |
|------|---------|
| `src/components/ui/AsyncState.tsx` | Reusable loading / error / empty / success UI. Supports retry callback. |
| `src/components/ui/LoadingButton.tsx` | Button with `pending` spinner, `disabled` when pending, `aria-busy`, optional `preventDoubleClick` |

## Pages Upgraded

### Debounce + Query Sync + Abort + AsyncState

| Page | Changes |
|------|---------|
| `/dashboard/intake` | Debounced search (300ms), abort stale fetches, AsyncState for loading/error/empty, `formatDateSafe` |
| `/dashboard/followups` | Debounced search, abort stale fetches, AsyncState |
| `/dashboard/proposals` | Debounced search, abort stale fetches, AsyncState, `formatDateSafe` |
| `/dashboard/proposal-followups` | Debounced search, abort stale fetches, AsyncState, `formatDateSafe` |

### Double-Submit Protection

- **Intake create**: `handleCreate` guards with `if (createLoading) return`
- **Followups / proposal-followups**: Existing `actionLoading` + `disabled={loading}` on action buttons

## How to Use Shared Hooks

### Debounced search

```tsx
const [search, setSearch] = useState("");
const debouncedSearch = useDebouncedValue(search, 300);

const fetchData = useCallback(async () => {
  const params = new URLSearchParams();
  if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
  // ...
}, [debouncedSearch, /* other deps */]);
```

### Abort stale fetches

```tsx
const abortRef = useRef<AbortController | null>(null);
const runIdRef = useRef(0);

const fetchData = useCallback(async () => {
  if (abortRef.current) abortRef.current.abort();
  const controller = new AbortController();
  abortRef.current = controller;
  const runId = ++runIdRef.current;
  try {
    const res = await fetch(url, { signal: controller.signal, /* ... */ });
    if (controller.signal.aborted || runId !== runIdRef.current) return;
    // handle response
  } catch (e) {
    if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) return;
    // handle error
  } finally {
    if (runId === runIdRef.current) abortRef.current = null;
  }
}, [/* deps */]);

useEffect(() => {
  void fetchData();
  return () => { if (abortRef.current) abortRef.current.abort(); };
}, [fetchData]);
```

### AsyncState

```tsx
<AsyncState
  loading={loading}
  error={error}
  empty={!loading && !error && items.length === 0}
  emptyMessage="No items match these filters."
  onRetry={fetchData}
>
  {items.length > 0 ? <Table items={items} /> : null}
</AsyncState>
```

### LoadingButton

```tsx
<LoadingButton pending={pending} preventDoubleClick onClick={handleSubmit}>
  Save
</LoadingButton>
```

## Optimistic Updates

**Not implemented in this phase.** The spec allows optimistic UI only for low-risk, reversible actions (e.g. checklist toggle, reminder complete/snooze). Those can be added in a follow-up using `useAsyncAction` with `optimistic`, `onMutate`, and `onError` (rollback).

**Do NOT use optimistic updates for:** promote to pipeline, accept/reject proposal, create proof candidate, delivery complete, handoff complete, or anything with cascading side effects.

## Manual Verification Checklist

- [ ] Intake list: type in search — no request per keypress; debounced fetch after ~300ms
- [ ] Intake list: change filters quickly — only latest request completes; no stale data overwrite
- [ ] Intake create: double-click Create — only one lead created
- [ ] Followups: search debounced; actions disabled while pending
- [ ] Proposals list: search debounced; loading/error/empty states render correctly
- [ ] Error states: retry button works
- [ ] Empty states: clear message + next action hint

## Known Limitations

- `useRetryableFetch` runs on mount/url change; does not support manual refetch with same URL (use `refetch()` which creates a new run)
- Toast normalization: `useAsyncAction` accepts optional `toast` callback; project currently uses `alert()` for errors in many places
- Not all list pages upgraded yet (delivery, proof-candidates, proposal-followups, reminders, automation, etc.) — can be applied incrementally using the same patterns

## Tests

| File | Coverage |
|------|----------|
| `src/lib/ui/debounce.test.ts` | debounce emits after delay, cancels prior, resets timer |
| `src/lib/http/request-key.test.ts` | same/different keys, fingerprintBody |
| `src/lib/ui/error-message.test.ts` | toErrorMessage, isAbortError |
| `src/lib/ui/date-safe.test.ts` | formatDateSafe, formatDateTimeSafe, invalid fallback |
| `src/lib/http/fetch-json.test.ts` | valid JSON, non-ok with error, non-JSON, abort |

Run: `npm run test`
