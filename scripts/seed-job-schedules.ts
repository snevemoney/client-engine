/**
 * Phase 2.8.5: Seed default job schedules (idempotent).
 * Run: npm run db:seed-job-schedules
 */
import { db } from "../src/lib/db";
import { createSchedule } from "../src/lib/jobs/schedules/service";
import { DEFAULT_SCHEDULES } from "../src/lib/jobs/schedules/defaults";

async function main() {
  for (const s of DEFAULT_SCHEDULES) {
    const existing = await db.jobSchedule.findUnique({ where: { key: s.key } });
    if (existing) {
      console.log(`Schedule ${s.key} already exists, skipping`);
      continue;
    }
    await createSchedule({
      key: s.key,
      title: s.title,
      description: s.description,
      jobType: s.jobType,
      cadenceType: s.cadenceType,
      intervalMinutes: s.intervalMinutes ?? null,
      dayOfWeek: s.dayOfWeek ?? null,
      dayOfMonth: s.dayOfMonth ?? null,
      hour: s.hour ?? null,
      minute: s.minute ?? null,
      isEnabled: s.isEnabled ?? false,
    });
    console.log(`Created schedule: ${s.key}`);
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
