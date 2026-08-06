# Session: evenslouis.pro path migration

## Goal

Move the authenticated Client Engine product from the expiring `evenslouis.pro` redirect onto `https://evenslouis.ca/pro` without changing the root application or its data.

## Decisions

- Use an isolated path-aware build on port 3204.
- Keep the existing root build on port 3200.
- Share the existing PostgreSQL and Redis services.
- Prefix native browser API requests and location changes explicitly.

## What was built

- Environment-driven Next.js `basePath`.
- `appPath` and `apiPath` helpers.
- Path-safe API fetches, redirects, proxy auth, and Auth.js sign-in path.
- Docker build arguments and a `pro` Compose service.

## Insights

Next.js prefixes framework navigation, but native `fetch`, raw anchors, and location assignments require explicit handling. A separate build avoids changing root-site URLs or cookies.

## Next steps

- Build and smoke the `/pro` image against the production database.
- Add the Caddy `/pro*` route.
- Verify login, callback, dashboard, and health endpoints before redirecting `evenslouis.pro`.
