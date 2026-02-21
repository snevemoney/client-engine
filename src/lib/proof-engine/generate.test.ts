import { describe, it, expect } from "vitest";
import { buildProofLines, type ProofInput } from "./proof-lines";

const base: ProofInput = {
  saw: "Client needed help reducing tool sprawl.",
  totalCost: 0,
  hasPositioning: false,
  hasProposal: false,
  reframedSnippet: null,
  dealOutcome: null,
  buildCompletedAt: null,
  buildStartedAt: null,
  approvedAt: null,
  leadTitle: "Test lead",
};

describe("buildProofLines", () => {
  it("returns 5–10 lines including Saw, Cost, Changed, Result, CTA", () => {
    const lines = buildProofLines(base);
    expect(lines.length).toBeGreaterThanOrEqual(5);
    expect(lines.length).toBeLessThanOrEqual(10);
    expect(lines[0]).toMatch(/^Saw:/);
    expect(lines.some((l) => l.startsWith("Cost:"))).toBe(true);
    expect(lines.some((l) => l.startsWith("Changed:"))).toBe(true);
    expect(lines.some((l) => l.startsWith("Result:"))).toBe(true);
    expect(lines.some((l) => l.includes("CHECKLIST"))).toBe(true);
  });

  it("uses 'not measured' when totalCost is 0", () => {
    const lines = buildProofLines({ ...base, totalCost: 0 });
    const costLine = lines.find((l) => l.startsWith("Cost:"));
    expect(costLine).toBe("Cost: not measured for this run.");
  });

  it("uses 'approx $X' only when totalCost > 0 (no invented metrics)", () => {
    const lines = buildProofLines({ ...base, totalCost: 0.0123 });
    const costLine = lines.find((l) => l.startsWith("Cost:"));
    expect(costLine).toMatch(/approx \$0\.0123/);
  });

  it("does not contain hype or urgency language", () => {
    const lines = buildProofLines(base);
    const text = lines.join("\n");
    expect(text).not.toMatch(/\bguarantee(s|d)?\b/i);
    expect(text).not.toMatch(/\b100%\b/);
    expect(text).not.toMatch(/\bact now\b/i);
    expect(text).not.toMatch(/\blimited time\b/i);
  });

  it("throws if output would contain hype (reframedSnippet with forbidden word)", () => {
    expect(() =>
      buildProofLines({
        ...base,
        hasPositioning: true,
        reframedSnippet: "We guarantee the best results.",
      })
    ).toThrow(/hype|urgency/);
  });

  it("includes result line for deal won/lost and in pipeline", () => {
    const won = buildProofLines({ ...base, dealOutcome: "won" });
    expect(won.some((l) => l.includes("deal won"))).toBe(true);

    const lost = buildProofLines({ ...base, dealOutcome: "lost" });
    expect(lost.some((l) => l.includes("closed without win"))).toBe(true);

    const pipeline = buildProofLines(base);
    expect(pipeline.some((l) => l.includes("in pipeline"))).toBe(true);
  });
});
