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

  it("labels cinematic proofs as proof only and keeps visitor-facing copy", () => {
    const slugs = [
      "working-volumes",
      "field-manuals",
      "betawise-earth",
      "sketchbook",
      "outer-heaven-landing",
      "northline-clinic",
      "harbor-and-co",
      "ledgerline",
      "atelier-cohort",
      "quay-team",
      "ashford-and-vale",
      "ironlane-studio",
    ] as const;
    const forbidden = /client engine|hive|n8n|agent|vps|cursor|grok|business os/i;

    for (const slug of slugs) {
      const copy = resolveCaseCopy({ slug, description: "" });
      expect(copy.proofOnly).toBe(true);
      expect(copy.description).toMatch(/proof \/ concept/i);
      expect(copy.result).toMatch(/no shipped app/i);
      expect(copy.description).not.toMatch(forbidden);
      expect(copy.problem).not.toMatch(forbidden);
      expect(copy.result).not.toMatch(forbidden);
    }
  });

  it("does not catalog held-back proofs until they have more craft time", () => {
    const held = ["afterlight", "grove", "meridian", "energy-orb", "inner-green"] as const;
    for (const slug of held) {
      expect(resolveCaseCopy({ slug }).proofOnly).toBe(false);
      expect(resolveCaseCopy({ slug }).description).toBe("");
    }
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
