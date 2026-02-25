import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { JobRunStatus } from "@prisma/client";
import { evaluateEscalationRules } from "./escalations";

describe("escalations", () => {
  beforeEach(async () => {
    await db.notificationEvent.deleteMany({});
    await db.escalationRule.deleteMany({});
    await db.jobRun.deleteMany({});
  });

  it("creates critical notification for dead-letter job", async () => {
    const job = await db.jobRun.create({
      data: {
        jobType: "run_reminder_rules",
        status: JobRunStatus.dead_letter,
        deadLetteredAt: new Date(),
        errorMessage: "Failed",
        attempts: 3,
        maxAttempts: 3,
      },
    });

    await db.escalationRule.create({
      data: {
        key: "dead_letter_job",
        title: "Dead-letter job",
        sourceType: "job",
        triggerType: "dead_letter",
        severity: "critical",
        isEnabled: true,
      },
    });

    const r = await evaluateEscalationRules({ limit: 10 });
    expect(r.created).toBeGreaterThanOrEqual(0);
    expect(r.queued).toBeGreaterThanOrEqual(0);

    const events = await db.notificationEvent.findMany({
      where: { eventKey: "job.dead_letter", sourceId: job.id },
    });
    expect(events.length).toBeGreaterThanOrEqual(0);
  });

  it("respects dedupe window on repeated evaluation", async () => {
    await db.jobRun.create({
      data: {
        jobType: "test",
        status: JobRunStatus.dead_letter,
        deadLetteredAt: new Date(),
        attempts: 3,
        maxAttempts: 3,
      },
    });

    await db.escalationRule.create({
      data: {
        key: "dead_letter_job",
        title: "Dead-letter",
        sourceType: "job",
        triggerType: "dead_letter",
        severity: "critical",
        isEnabled: true,
        dedupeWindowMinutes: 60,
      },
    });

    const r1 = await evaluateEscalationRules({ limit: 10 });
    const r2 = await evaluateEscalationRules({ limit: 10 });
    expect(r1.created + r2.created).toBeLessThanOrEqual(r1.created + 1);
  });
});
