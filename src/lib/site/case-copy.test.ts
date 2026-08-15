import { describe, expect, it } from "vitest";
import { isStaleCaseDescription, resolveCaseCopy } from "./case-copy";

describe("resolveCaseCopy", () => {
  it("replaces ProofCheck team-QC lie with nursing claim-verify", () => {
    const copy = resolveCaseCopy({
      slug: "proof-qc-assist",
      description:
        "A quality control assistant application for managing and reviewing proof documents. Designed for teams with approval pipelines.",
    });
    expect(copy.description).toMatch(/sciences infirmières/i);
    expect(copy.description).not.toMatch(/managing and reviewing proof documents/i);
    expect(copy.problem).toMatch(/nursing/i);
    expect(copy.result).toMatch(/Verify Now/i);
    expect(copy.proofOnly).toBe(false);
  });

  it("does not claim QuickMarket favorites", () => {
    const copy = resolveCaseCopy({
      slug: "quickmarket",
      description: "buyers can browse, save favorites, and contact sellers directly.",
    });
    expect(copy.description.toLowerCase()).not.toContain("save favorites");
    expect(copy.description).toMatch(/no favorites/i);
    expect(copy.description).toMatch(/demo \$5/i);
  });

  it("labels Autoflow as proof only and does not invent a shipped result", () => {
    const copy = resolveCaseCopy({
      slug: "autoflow",
      description: "Visual editor, triggers, steps, and run history — so teams can automate without writing code.",
    });
    expect(copy.proofOnly).toBe(true);
    expect(copy.description).toMatch(/proof \/ concept/i);
    expect(copy.result).toMatch(/no shipped app/i);
    expect(copy.result).not.toBe("—");
  });

  it("uses DB problem/result when present", () => {
    const copy = resolveCaseCopy({
      slug: "clearfield",
      description: "Civic/OSINT workbench that structures claims and evidence.",
      problem: "DB problem",
      result: "DB result",
    });
    expect(copy.problem).toBe("DB problem");
    expect(copy.result).toBe("DB result");
    expect(copy.description).toMatch(/Civic\/OSINT/);
  });
});

describe("isStaleCaseDescription", () => {
  it("flags the live ProofCheck BUILD lie", () => {
    expect(
      isStaleCaseDescription("managing and reviewing proof documents with approval pipelines")
    ).toBe(true);
  });
});
