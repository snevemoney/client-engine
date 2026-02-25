/**
 * Phase 2.1: Proposal follow-up lib tests.
 */
import { describe, it, expect } from "vitest";
import {
  isProposalFollowupDue,
  classifyProposalFollowupBucket,
  computeProposalStaleState,
  computeNextProposalFollowupDate,
} from "./followup";

describe("isProposalFollowupDue", () => {
  it("returns false when nextFollowUpAt is null", () => {
    expect(isProposalFollowupDue({})).toBe(false);
    expect(isProposalFollowupDue({ nextFollowUpAt: null })).toBe(false);
  });

  it("returns true when nextFollowUpAt is in the past", () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    expect(isProposalFollowupDue({ nextFollowUpAt: past })).toBe(true);
  });

  it("returns false when nextFollowUpAt is in the future", () => {
    const future = new Date();
    future.setDate(future.getDate() + 2);
    expect(isProposalFollowupDue({ nextFollowUpAt: future })).toBe(false);
  });
});

describe("classifyProposalFollowupBucket", () => {
  const now = new Date("2025-02-24T12:00:00Z");

  it("returns none when nextFollowUpAt is null", () => {
    expect(classifyProposalFollowupBucket(null, now)).toBe("none");
    expect(classifyProposalFollowupBucket(undefined, now)).toBe("none");
  });

  it("returns overdue when due is before today", () => {
    const overdue = new Date("2025-02-23T10:00:00Z");
    expect(classifyProposalFollowupBucket(overdue, now)).toBe("overdue");
  });

  it("returns today when due is today", () => {
    const today = new Date("2025-02-24T14:00:00Z");
    expect(classifyProposalFollowupBucket(today, now)).toBe("today");
  });

  it("returns upcoming when due is within 7 days", () => {
    const upcoming = new Date("2025-02-26T10:00:00Z");
    expect(classifyProposalFollowupBucket(upcoming, now)).toBe("upcoming");
  });

  it("returns none when due is beyond 7 days", () => {
    const far = new Date("2025-03-10T10:00:00Z");
    expect(classifyProposalFollowupBucket(far, now)).toBe("none");
  });
});

describe("computeProposalStaleState", () => {
  it("returns not stale when not sent", () => {
    expect(computeProposalStaleState({})).toEqual({ isStale: false, staleDays: 0 });
    expect(computeProposalStaleState({ sentAt: null })).toEqual({ isStale: false, staleDays: 0 });
  });

  it("returns not stale when accepted or rejected", () => {
    const sent = new Date();
    sent.setDate(sent.getDate() - 10);
    expect(computeProposalStaleState({ sentAt: sent, acceptedAt: new Date() })).toEqual({
      isStale: false,
      staleDays: 0,
    });
    expect(computeProposalStaleState({ sentAt: sent, rejectedAt: new Date() })).toEqual({
      isStale: false,
      staleDays: 0,
    });
  });

  it("returns not stale when responded", () => {
    const sent = new Date();
    sent.setDate(sent.getDate() - 10);
    expect(computeProposalStaleState({ sentAt: sent, respondedAt: new Date() })).toEqual({
      isStale: false,
      staleDays: 0,
    });
  });

  it("returns stale when sent > 7 days ago with no response", () => {
    const sent = new Date();
    sent.setDate(sent.getDate() - 10);
    const { isStale } = computeProposalStaleState({ sentAt: sent });
    expect(isStale).toBe(true);
  });

  it("returns not stale when sent < 7 days ago", () => {
    const sent = new Date();
    sent.setDate(sent.getDate() - 3);
    const { isStale } = computeProposalStaleState({ sentAt: sent });
    expect(isStale).toBe(false);
  });

  it("respects staleAfterDays override", () => {
    const sent = new Date();
    sent.setDate(sent.getDate() - 5);
    const { isStale } = computeProposalStaleState({ sentAt: sent, staleAfterDays: 3 });
    expect(isStale).toBe(true);
  });
});

describe("computeNextProposalFollowupDate", () => {
  const from = new Date("2025-02-24T12:00:00Z");

  it("2d adds 2 days", () => {
    const result = computeNextProposalFollowupDate({ preset: "2d" }, from);
    expect(result).toBeTruthy();
    expect(result!.getDate()).toBe(26);
  });

  it("5d adds 5 days", () => {
    const result = computeNextProposalFollowupDate({ preset: "5d" }, from);
    expect(result).toBeTruthy();
    expect(result!.getDate()).toBe(1);
  });

  it("next_monday returns next Monday", () => {
    const result = computeNextProposalFollowupDate({ preset: "next_monday" }, from);
    expect(result).toBeTruthy();
    expect(result!.getDay()).toBe(1);
  });

  it("custom uses customDate when provided", () => {
    const result = computeNextProposalFollowupDate({ preset: "custom", customDate: "2025-03-01T10:00:00Z" }, from);
    expect(result).toBeTruthy();
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(1);
  });

  it("custom returns null when customDate empty", () => {
    const result = computeNextProposalFollowupDate({ preset: "custom" }, from);
    expect(result).toBeNull();
  });
});
