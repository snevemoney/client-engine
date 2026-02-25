import { describe, it, expect } from "vitest";
import {
  classifyRetentionBucket,
  computeRetentionStale,
  computeRetentionNextDate,
} from "./retention";

describe("classifyRetentionBucket", () => {
  const now = new Date("2025-02-22T12:00:00Z");

  it("returns none when no date", () => {
    expect(classifyRetentionBucket(null, now)).toBe("none");
    expect(classifyRetentionBucket(undefined, now)).toBe("none");
  });

  it("returns overdue when date is in the past", () => {
    const past = new Date("2025-02-21T00:00:00Z");
    expect(classifyRetentionBucket(past, now)).toBe("overdue");
  });

  it("returns today when date is today", () => {
    const today = new Date("2025-02-22T12:00:00Z");
    expect(classifyRetentionBucket(today, now)).toBe("today");
  });

  it("returns upcoming when within 7 days", () => {
    const in3Days = new Date("2025-02-25T12:00:00Z");
    expect(classifyRetentionBucket(in3Days, now)).toBe("upcoming");
  });

  it("returns none when beyond upcoming window", () => {
    const in10Days = new Date("2025-03-04T12:00:00Z");
    expect(classifyRetentionBucket(in10Days, now)).toBe("none");
  });
});

describe("computeRetentionStale", () => {
  it("returns not stale when not completed", () => {
    const result = computeRetentionStale({
      status: "in_progress",
      handoffCompletedAt: new Date(),
    });
    expect(result.isStale).toBe(false);
  });

  it("returns not stale when no handoff completed", () => {
    const result = computeRetentionStale({
      status: "completed",
      handoffCompletedAt: null,
    });
    expect(result.isStale).toBe(false);
  });

  it("returns stale when handoff done and no activity after N days", () => {
    const handoffDate = new Date();
    handoffDate.setDate(handoffDate.getDate() - 20);
    const result = computeRetentionStale(
      {
        status: "completed",
        handoffCompletedAt: handoffDate,
        testimonialRequestedAt: null,
        testimonialReceivedAt: null,
        referralRequestedAt: null,
        referralReceivedAt: null,
        reviewRequestedAt: null,
        reviewReceivedAt: null,
        retentionLastContactedAt: null,
      },
      14
    );
    expect(result.isStale).toBe(true);
  });

  it("returns not stale when recent activity", () => {
    const handoffDate = new Date();
    handoffDate.setDate(handoffDate.getDate() - 20);
    const recentActivity = new Date();
    recentActivity.setDate(recentActivity.getDate() - 5);
    const result = computeRetentionStale(
      {
        status: "completed",
        handoffCompletedAt: handoffDate,
        testimonialRequestedAt: recentActivity,
        testimonialReceivedAt: null,
        referralRequestedAt: null,
        referralReceivedAt: null,
        reviewRequestedAt: null,
        reviewReceivedAt: null,
        retentionLastContactedAt: null,
      },
      14
    );
    expect(result.isStale).toBe(false);
  });
});

describe("computeRetentionNextDate", () => {
  const from = new Date("2025-02-22T12:00:00Z");

  it("returns +7 days for 7d preset", () => {
    const result = computeRetentionNextDate({ preset: "7d" }, from);
    expect(result).not.toBeNull();
    const expected = new Date(from);
    expected.setDate(expected.getDate() + 7);
    expect(result!.toISOString().slice(0, 10)).toBe(expected.toISOString().slice(0, 10));
  });

  it("returns +14 days for 14d preset", () => {
    const result = computeRetentionNextDate({ preset: "14d" }, from);
    expect(result).not.toBeNull();
    const expected = new Date(from);
    expected.setDate(expected.getDate() + 14);
    expect(result!.toISOString().slice(0, 10)).toBe(expected.toISOString().slice(0, 10));
  });

  it("returns +30 days for 30d preset", () => {
    const result = computeRetentionNextDate({ preset: "30d" }, from);
    expect(result).not.toBeNull();
    const expected = new Date(from);
    expected.setDate(expected.getDate() + 30);
    expect(result!.toISOString().slice(0, 10)).toBe(expected.toISOString().slice(0, 10));
  });

  it("returns next month for next_month preset", () => {
    const result = computeRetentionNextDate({ preset: "next_month" }, from);
    expect(result).not.toBeNull();
    expect(result!.getMonth()).toBe((from.getMonth() + 1) % 12);
  });

  it("returns null for custom without customDate", () => {
    const result = computeRetentionNextDate({ preset: "custom" }, from);
    expect(result).toBeNull();
  });

  it("returns parsed date for custom with customDate", () => {
    const result = computeRetentionNextDate(
      { preset: "custom", customDate: "2025-03-15T00:00:00Z" },
      from
    );
    expect(result).not.toBeNull();
    expect(result!.toISOString().slice(0, 10)).toBe("2025-03-15");
  });
});
