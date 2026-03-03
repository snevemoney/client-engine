# ADR-001: Postgres-Backed Job Queue

## Status: Accepted

## Context
The system needs a job queue for background tasks (pipeline runs, scheduled agents, notification delivery, metric snapshots). Options: Redis-only BullMQ, Postgres-backed custom queue, or a dedicated service like Temporal.

BullMQ with Redis is already used for workers (email ingestion, monitoring), but the main application jobs needed stronger durability guarantees and visibility.

## Decision
Use a Postgres-backed job queue (JobRun model) for application jobs. Keep BullMQ for worker-level queues (enrich, score, monitor).

Reasons:
- **Durability:** Jobs survive Redis restarts. Postgres is the source of truth.
- **Visibility:** Jobs are queryable via Prisma, visible in the dashboard (`/dashboard/jobs`).
- **Simplicity:** No additional infrastructure beyond the existing Postgres database.
- **Recovery:** Stale jobs (stuck >10min) are automatically requeued. Dead-letter for repeated failures.
- **Transactions:** Job state changes can participate in Prisma transactions with business data.

## Consequences
- Slightly higher latency than Redis-only (Postgres polling vs Redis pub/sub).
- Job throughput limited by Postgres connection pool (acceptable at current scale).
- BullMQ workers still exist for specialized tasks, creating two queue systems to maintain.
