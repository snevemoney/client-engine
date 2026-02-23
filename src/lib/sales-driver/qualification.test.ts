import { describe, it, expect } from "vitest";
import { getQualificationTotal, getPriorityBadge } from "./qualification";

describe("getQualificationTotal", () => {
  it("sums valid 0-2 scores", () => {
    expect(
      getQualificationTotal({
        scorePain: 1,
        scoreUrgency: 2,
        scoreBudget: 0,
        scoreResponsiveness: 1,
        scoreDecisionMaker: 2,
        scoreFit: 1,
      })
    ).toBe(7);
  });

  it("ignores null/undefined", () => {
    expect(getQualificationTotal({ scorePain: 2, scoreUrgency: null })).toBe(2);
  });

  it("ignores out-of-range values", () => {
    expect(getQualificationTotal({ scorePain: 3, scoreUrgency: -1 })).toBe(0);
  });

  it("returns 0 for empty", () => {
    expect(getQualificationTotal({})).toBe(0);
  });
});

describe("getPriorityBadge", () => {
  it("returns Low for 0-4", () => {
    expect(getPriorityBadge(0)).toBe("Low");
    expect(getPriorityBadge(4)).toBe("Low");
  });

  it("returns Medium for 5-8", () => {
    expect(getPriorityBadge(5)).toBe("Medium");
    expect(getPriorityBadge(8)).toBe("Medium");
  });

  it("returns High for 9-12", () => {
    expect(getPriorityBadge(9)).toBe("High");
    expect(getPriorityBadge(12)).toBe("High");
  });
});
