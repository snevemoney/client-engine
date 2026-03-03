# ADR-003: Prisma db push (No Migration History)

## Status: Accepted

## Context
Prisma offers two schema sync strategies:
1. `prisma migrate dev/deploy` — creates migration files, tracks history, supports rollback.
2. `prisma db push` — directly syncs schema to database, no migration files.

Early development had frequent schema changes (75+ models evolved rapidly). Migration history created conflicts when models changed substantially between iterations.

## Decision
Use `prisma db push` for all schema changes. No migration history.

Reasons:
- **Speed:** Schema changes apply instantly without migration file management.
- **No conflicts:** Avoids migration history divergence during rapid prototyping.
- **Single operator:** This is a private system with one developer. Migration rollback is less critical.
- **Simplicity:** One command (`npx prisma db push`) handles everything.

## Consequences
- No rollback capability from migration history. Must use database backups for recovery.
- No migration files to review in PRs (schema diff is the only record).
- If multiple developers join, should migrate to `prisma migrate` for coordination.
- Production schema changes require careful testing (no automatic rollback on failure).
