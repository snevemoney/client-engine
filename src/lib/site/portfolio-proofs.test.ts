import { describe, expect, it } from "vitest";
import {
  allPortfolioProofRows,
  HELD_BACK_PORTFOLIO_PROOFS,
  PORTFOLIO_PROOF_SLUGS,
} from "./portfolio-proofs";

describe("portfolio proofs catalog", () => {
  it("ships four proofs and holds the unfinished cinematic cards", () => {
    expect([...PORTFOLIO_PROOF_SLUGS]).toEqual([
      "working-volumes",
      "field-manuals",
      "betawise-earth",
      "sketchbook",
    ]);
    expect([...HELD_BACK_PORTFOLIO_PROOFS]).toEqual([
      "afterlight",
      "grove",
      "meridian",
      "energy-orb",
      "inner-green",
    ]);
    expect(PORTFOLIO_PROOF_SLUGS.some((slug) => (HELD_BACK_PORTFOLIO_PROOFS as readonly string[]).includes(slug))).toBe(
      false
    );
  });

  it("writes live cards with null repo/demo and public screenshot paths", () => {
    const forbidden = /client engine|hive|n8n|agent|vps|cursor|grok|business os|github/i;

    for (const row of allPortfolioProofRows()) {
      expect(row.status).toBe("live");
      expect(row.demoUrl).toBeNull();
      expect(row.repoUrl).toBeNull();
      expect(row.repoPath).toBeNull();
      expect(row.screenshots).toEqual([`/screenshots/${row.slug}/1-hero.jpg`]);
      expect(row.techStack.every((t) => !forbidden.test(t))).toBe(true);
      expect(row.description).not.toMatch(forbidden);
    }
  });
});
