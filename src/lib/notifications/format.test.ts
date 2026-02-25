import { describe, it, expect } from "vitest";
import { formatNotificationTitle, formatNotificationMessage } from "./format";

describe("formatNotificationTitle", () => {
  it("formats job.dead_letter", () => {
    const t = formatNotificationTitle({
      eventKey: "job.dead_letter",
      meta: { jobType: "run_reminder_rules" },
    });
    expect(t).toBe("Job dead-lettered: run_reminder_rules");
  });

  it("formats reminder.overdue", () => {
    const t = formatNotificationTitle({
      eventKey: "reminder.overdue",
      meta: { title: "Follow up" },
    });
    expect(t).toBe("Reminder overdue: Follow up");
  });

  it("formats review.weekly_missing", () => {
    const t = formatNotificationTitle({ eventKey: "review.weekly_missing" });
    expect(t).toBe("Weekly review missing");
  });

  it("formats snapshot.metrics_missing", () => {
    const t = formatNotificationTitle({ eventKey: "snapshot.metrics_missing" });
    expect(t).toBe("Metrics snapshot missing");
  });

  it("falls back for unknown eventKey", () => {
    const t = formatNotificationTitle({ eventKey: "unknown", meta: { title: "Custom" } });
    expect(t).toBe("Custom");
  });
});

describe("formatNotificationMessage", () => {
  it("formats job.dead_letter", () => {
    const m = formatNotificationMessage({
      eventKey: "job.dead_letter",
      sourceId: "job-1",
      meta: { jobType: "run_reminder_rules", attempts: 3, error: "Timeout" },
    });
    expect(m).toContain("run_reminder_rules");
    expect(m).toContain("3");
    expect(m).toContain("Timeout");
  });

  it("formats reminder.overdue", () => {
    const m = formatNotificationMessage({
      eventKey: "reminder.overdue",
      meta: { title: "Follow up", dueAt: "2025-02-20T10:00:00Z" },
    });
    expect(m).toContain("Follow up");
  });

  it("returns empty for unknown", () => {
    const m = formatNotificationMessage({ eventKey: "unknown" });
    expect(m).toBe("");
  });
});
