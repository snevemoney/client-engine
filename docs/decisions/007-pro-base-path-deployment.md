# Decision 007: Isolated `/pro` base-path deployment

Date: 2026-08-06

## Context

`evenslouis.pro` currently redirects to the authenticated Client Engine dashboard. The domain is expiring, while the root `evenslouis.ca` application must remain unchanged.

## Decision

Build a second Client Engine image with `NEXT_PUBLIC_BASE_PATH=/pro` and expose it only on `127.0.0.1:3204`. The existing root image remains on `127.0.0.1:3200` with an empty base path. Both instances share the existing PostgreSQL and Redis services.

Browser-native API requests and location changes use `apiPath`/`appPath`, because Next.js does not prefix native `fetch` or `window.location` calls automatically.

## Consequences

- Caddy can route `/pro*` without stripping the prefix.
- Auth.js uses `https://evenslouis.ca/pro` as its public URL.
- The old `.pro` host can redirect permanently to the scoped path.
- One source tree supports both root and path builds without duplicating application data.
