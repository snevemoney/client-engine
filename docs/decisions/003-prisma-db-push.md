# ADR-003: Prisma Migration Strategy

## Status: Superseded (Updated March 2026)

## Context
Prisma offers two schema sync strategies:
1. `prisma migrate dev/deploy` — creates migration files, tracks history, supports rollback.
2. `prisma db push` — directly syncs schema to database, no migration files.

Early development had frequent schema changes (75+ models evolved rapidly). Migration history created conflicts when models changed substantially between iterations.

## Original Decision (Accepted)
Use `prisma db push` for all schema changes. No migration history.

## Updated Decision (March 2026)
**Production uses `prisma migrate deploy`.** Local dev uses `db push` for quick iteration.

The system now has 14 committed migrations in `prisma/migrations/`. The schema has stabilized enough that migration discipline is required for production safety.

### Workflow
- **Local dev:** `npx prisma db push` (quick sync) or `npx prisma migrate dev --name descriptive_name` (when creating a migration for production)
- **Production:** `prisma migrate deploy` only (run automatically by `deploy.sh`)
- Commit new migration files in `prisma/migrations/` before deploying

### Why the change
- Schema at 75+ models with real production data — drift risk from `db push --accept-data-loss` is too high
- `deploy-safe.sh` and `deploy-fast.sh` already used `migrate deploy`; `deploy.sh` was inconsistent
- Migration history enables rollback reasoning and change auditing

## Consequences
- Production schema changes now require a committed migration file
- `deploy.sh` runs `prisma migrate deploy` (no more `--accept-data-loss`)
- Database backups remain the primary recovery mechanism
- Local dev retains `db push` for speed during prototyping
