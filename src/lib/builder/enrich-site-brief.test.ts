/**
 * Unit tests for site brief enrichment.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  packContentHintsForBuilder,
  type EnrichedSiteBrief,
} from "./enrich-site-brief";
import { buildSiteBriefPrompt } from "./site-brief-prompt";

describe("packContentHintsForBuilder", () => {
  it("returns baseHints when clientInfo is empty", () => {
    expect(packContentHintsForBuilder("base", undefined)).toBe("base");
    expect(packContentHintsForBuilder("base", {})).toBe("base");
  });

  it("appends hero, features, CTA when clientInfo provided", () => {
    const clientInfo: EnrichedSiteBrief["clientInfo"] = {
      heroHeadline: "Six Word Headline Here",
      heroSubhead: "Fifteen word subheadline goes right here for the hero.",
      ctaPrimary: "Book a call",
      features: [
        { title: "Feature 1", body: "Body 1" },
        { title: "Feature 2", body: "Body 2" },
      ],
      tone: "professional",
    };
    const result = packContentHintsForBuilder(undefined, clientInfo);
    expect(result).toContain("Hero headline (6 words): Six Word Headline Here");
    expect(result).toContain("Hero subhead (15 words):");
    expect(result).toContain("Primary CTA: Book a call");
    expect(result).toContain("Feature 1: Feature 1 — Body 1");
    expect(result).toContain("Feature 2: Feature 2 — Body 2");
    expect(result).toContain("Tone: professional");
  });

  it("merges baseHints with clientInfo parts", () => {
    const result = packContentHintsForBuilder("Base context", {
      heroHeadline: "Test",
      ctaPrimary: "CTA",
    });
    expect(result).toContain("Base context");
    expect(result).toContain("Hero headline");
    expect(result).toContain("Primary CTA: CTA");
  });
});

describe("buildSiteBriefPrompt", () => {
  it("produces system and user prompts with context", () => {
    const { system, user } = buildSiteBriefPrompt({
      clientName: "Sophie Lavoie",
      title: "Holistic Health Coaching",
      industry: "health_coaching",
      description: "Gut health specialist",
      feltProblem: "Overwhelmed by diet options",
      reframedOffer: "Gentle functional nutrition",
    });
    expect(system).toContain("JSON");
    expect(system).toContain("scope");
    expect(system).toContain("brandColors");
    expect(user).toContain("Sophie Lavoie");
    expect(user).toContain("Holistic Health Coaching");
    expect(user).toContain("health_coaching");
    expect(user).toContain("Overwhelmed by diet options");
    expect(user).toContain("Gentle functional nutrition");
  });
});
