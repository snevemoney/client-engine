import { describe, it, expect } from "vitest";
import { computeSourcePerformance } from "./source-performance";

describe("computeSourcePerformance", () => {
  it("returns empty for empty input", () => {
    const r = computeSourcePerformance({ rows: [] });
    expect(r.sourceRows).toHaveLength(0);
    expect(r.topSourceByWins).toBeNull();
    expect(r.topSourceByRevenue).toBeNull();
  });

  it("computes rates correctly", () => {
    const r = computeSourcePerformance({
      rows: [
        { source: "linkedin", intakeCount: 10, promotedCount: 5, proposalCount: 5, sentCount: 4, acceptedCount: 2, deliveredCount: 1, revenue: 5000 },
      ],
    });
    expect(r.sourceRows[0].intakeToWinRate).toBe(0.2);
    expect(r.sourceRows[0].proposalToAcceptedRate).toBe(0.5);
  });

  it("handles zero denominator", () => {
    const r = computeSourcePerformance({
      rows: [
        { source: "x", intakeCount: 0, promotedCount: 0, proposalCount: 0, sentCount: 0, acceptedCount: 0, deliveredCount: 0, revenue: 0 },
      ],
    });
    expect(r.sourceRows[0].intakeToWinRate).toBe(0);
    expect(r.sourceRows[0].proposalToAcceptedRate).toBe(0);
  });

  it("returns top source by wins", () => {
    const r = computeSourcePerformance({
      rows: [
        { source: "a", intakeCount: 5, promotedCount: 5, proposalCount: 5, sentCount: 5, acceptedCount: 1, deliveredCount: 0, revenue: 0 },
        { source: "b", intakeCount: 5, promotedCount: 5, proposalCount: 5, sentCount: 5, acceptedCount: 3, deliveredCount: 0, revenue: 0 },
      ],
    });
    expect(r.topSourceByWins).toBe("b");
  });

  it("returns top source by revenue", () => {
    const r = computeSourcePerformance({
      rows: [
        { source: "a", intakeCount: 1, promotedCount: 1, proposalCount: 1, sentCount: 1, acceptedCount: 1, deliveredCount: 1, revenue: 1000 },
        { source: "b", intakeCount: 1, promotedCount: 1, proposalCount: 1, sentCount: 1, acceptedCount: 1, deliveredCount: 1, revenue: 5000 },
      ],
    });
    expect(r.topSourceByRevenue).toBe("b");
  });
});
