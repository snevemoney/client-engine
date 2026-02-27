# Phase 4.2 — Environment Variable Changes

**Scope:** Phase 4.2 (Delivery Paths, Next Best Action execute, etc.)

## Summary

Phase 4.2 introduces **no new environment variables**. All new functionality uses existing auth and configuration.

| Var Name | Required? | Safe Local Default | Where Used |
|----------|-----------|--------------------|------------|
| *(none new)* | — | — | — |

## Existing Vars Used by Phase 4.2

- `DATABASE_URL` — Prisma / NextActionExecution table
- NextAuth / session vars — `POST /api/next-actions/[id]/execute` requires auth

No runtime guard needed for Phase 4.2–specific vars.
