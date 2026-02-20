import { db } from "@/lib/db";

const LOCK_PREFIX = "lead:";

/**
 * Try to acquire a Postgres advisory lock for the given lead.
 * Key is derived from leadId so the same lead always maps to the same lock.
 * Returns true if lock was acquired, false if another process holds it.
 */
export async function tryAdvisoryLock(leadId: string): Promise<boolean> {
  const key = LOCK_PREFIX + leadId;
  const result = await db.$queryRaw<[{ pg_try_advisory_lock: boolean }]>`
    SELECT pg_try_advisory_lock(hashtext(${key}))
    AS pg_try_advisory_lock
  `;
  return result[0]?.pg_try_advisory_lock ?? false;
}

/**
 * Release the advisory lock for the given lead.
 * Call in a finally block after runPipelineIfEligible.
 */
export async function releaseAdvisoryLock(leadId: string): Promise<void> {
  const key = LOCK_PREFIX + leadId;
  await db.$executeRaw`SELECT pg_advisory_unlock(hashtext(${key}))`;
}
