# Session: P3005 Baseline and Migrate — 2025-03-03

## Goal

Fix P3005 on production: Prisma's migration history table was empty but the database already had tables from prior deploys. Baseline existing migrations and apply the new Sprint 5–9 schema so the dashboard, proof page, and campaigns page load correctly.

## Decisions Made

- **Baseline approach**: Use `prisma migrate resolve --applied <name>` for each of the 12 existing migrations rather than recreating the DB or manually inserting into `_prisma_migrations`.
- **Migration mount**: The worker image was built without the new migration file. Used `-v /root/client-engine/prisma:/app/prisma` when running `prisma migrate deploy` so the host's migrations (including rsynced 20260307) were visible to the container.

## What Was Built

- **Production (SSH)**: Baselined 12 migrations, applied `20260307_add_sprint_5_9_schema`, restarted app and worker.
- **Rsync**: Synced `prisma/migrations/20260307_add_sprint_5_9_schema/` to server (it was untracked locally, so not in the prior deploy).
- **CHANGELOG.md**: Added Fixed entry for P3005 baseline.

## Key Insights

- When `prisma migrate deploy` reports "No pending migrations" but a new migration folder exists on the host, the container is using the built image's prisma folder (from build time), not the host's. Mount the host prisma dir to apply migrations from rsynced code.
- The migration `20260307_add_sprint_5_9_schema` was never committed; it existed only locally. Future deploys should commit and push migrations before sync-and-deploy so they're included in the build.

## Trade-offs Accepted

- Ran migrate from a one-off container with a volume mount instead of rebuilding the app image. Rebuild would have required committing the migration first; the mount approach unblocked production immediately.

## Open Questions

- Should the deploy script run migrations with a volume mount so host migrations always apply, or should we require migrations to be committed before deploy?

## Next Steps

- [ ] Commit and push `prisma/migrations/20260307_add_sprint_5_9_schema` and `docs/BASELINE_AND_MIGRATE_RUNBOOK.md` so future deploys include them.
- [ ] Consider adding a deploy step that mounts host prisma when running migrate, or document the mount approach in the runbook.
