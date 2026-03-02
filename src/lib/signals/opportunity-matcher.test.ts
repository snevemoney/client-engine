import { describe, it, expect, vi, beforeEach } from "vitest";
import { matchSignalToProspects } from "./opportunity-matcher";

vi.mock("@/lib/db", () => ({
  db: {
    signalItem: {
      findUnique: vi.fn(),
    },
    prospect: {
      findMany: vi.fn(),
    },
  },
}));

const DENTAL_SIGNAL = {
  id: "s1",
  title: "Dental clinics losing leads to slow follow-up",
  summary: "New study shows dental practices lose 40% of patients due to response time gaps",
  tags: ["dental", "follow-up"],
  url: "https://example.com/dental-study",
  score: 65,
  status: "new",
};

const PROSPECTS = [
  {
    id: "p1",
    name: "Smile Dental",
    handle: "smiledental",
    niche: "dental practice",
    platform: "instagram",
    opportunityScore: 8,
    currentWebPresence: "canva site",
    notes: null,
    deals: [],
  },
  {
    id: "p2",
    name: "Bob's Plumbing",
    handle: "bobplumb",
    niche: "plumbing contractor",
    platform: "google",
    opportunityScore: 3,
    currentWebPresence: "google forms",
    notes: null,
    deals: [],
  },
  {
    id: "p3",
    name: "Legal Eagles",
    handle: "legaleagles",
    niche: "legal firm",
    platform: "linkedin",
    opportunityScore: 5,
    currentWebPresence: null,
    notes: null,
    deals: [],
  },
];

describe("matchSignalToProspects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ranked matches sorted by relevance", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.signalItem.findUnique).mockResolvedValue(DENTAL_SIGNAL as never);
    vi.mocked(db.prospect.findMany).mockResolvedValue(PROSPECTS as never);

    const result = await matchSignalToProspects("s1");

    expect(result.signalId).toBe("s1");
    expect(result.signalTitle).toBe(DENTAL_SIGNAL.title);
    expect(result.matches.length).toBeGreaterThan(0);
    // Dental prospect should rank first due to niche match
    expect(result.matches[0].prospectId).toBe("p1");
    // Matches should be sorted descending by relevanceScore
    for (let i = 1; i < result.matches.length; i++) {
      expect(result.matches[i - 1].relevanceScore).toBeGreaterThanOrEqual(
        result.matches[i].relevanceScore
      );
    }
  });

  it("higher score for niche keyword overlap", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.signalItem.findUnique).mockResolvedValue(DENTAL_SIGNAL as never);
    vi.mocked(db.prospect.findMany).mockResolvedValue(PROSPECTS as never);

    const result = await matchSignalToProspects("s1");

    const dentalMatch = result.matches.find((m) => m.prospectId === "p1");
    const plumbingMatch = result.matches.find((m) => m.prospectId === "p2");

    expect(dentalMatch).toBeDefined();
    // Plumbing may or may not match (follow-up boost might give some score)
    if (plumbingMatch) {
      expect(dentalMatch!.relevanceScore).toBeGreaterThan(plumbingMatch.relevanceScore);
    }
  });

  it("penalizes late-stage deals", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.signalItem.findUnique).mockResolvedValue(DENTAL_SIGNAL as never);

    const prospectWithDeal = {
      ...PROSPECTS[0],
      deals: [{ id: "d1", stage: "proposal_sent" }],
    };
    const prospectNoDeal = { ...PROSPECTS[0], id: "p1b", deals: [] };

    vi.mocked(db.prospect.findMany).mockResolvedValue([prospectWithDeal, prospectNoDeal] as never);

    const result = await matchSignalToProspects("s1");

    const withDeal = result.matches.find((m) => m.prospectId === "p1");
    const noDeal = result.matches.find((m) => m.prospectId === "p1b");

    expect(noDeal).toBeDefined();
    expect(withDeal).toBeDefined();
    expect(noDeal!.relevanceScore).toBeGreaterThan(withDeal!.relevanceScore);
  });

  it("suggests correct template for canva web presence", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.signalItem.findUnique).mockResolvedValue({
      ...DENTAL_SIGNAL,
      tags: ["dental"], // no follow-up tag
    } as never);
    vi.mocked(db.prospect.findMany).mockResolvedValue([
      { ...PROSPECTS[0], currentWebPresence: "canva site" },
    ] as never);

    const result = await matchSignalToProspects("s1");

    expect(result.matches[0].suggestedTemplateKey).toBe("canva_site_upgrade");
  });

  it("suggests followup_leakage_audit for follow-up signals", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.signalItem.findUnique).mockResolvedValue(DENTAL_SIGNAL as never);
    vi.mocked(db.prospect.findMany).mockResolvedValue([
      { ...PROSPECTS[0], currentWebPresence: "professional site" },
    ] as never);

    const result = await matchSignalToProspects("s1");

    // Signal has "follow-up" tag, so template should be followup_leakage_audit
    expect(result.matches[0].suggestedTemplateKey).toBe("followup_leakage_audit");
  });

  it("suggests big_audience_no_site for prospects with no web presence", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.signalItem.findUnique).mockResolvedValue({
      ...DENTAL_SIGNAL,
      tags: ["dental"], // no follow-up tag
    } as never);
    vi.mocked(db.prospect.findMany).mockResolvedValue([
      { ...PROSPECTS[0], currentWebPresence: null },
    ] as never);

    const result = await matchSignalToProspects("s1");

    expect(result.matches[0].suggestedTemplateKey).toBe("big_audience_no_site");
  });

  it("throws when signal not found", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.signalItem.findUnique).mockResolvedValue(null);

    await expect(matchSignalToProspects("missing")).rejects.toThrow(
      "SignalItem not found: missing"
    );
  });

  it("returns empty matches when no prospects", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.signalItem.findUnique).mockResolvedValue(DENTAL_SIGNAL as never);
    vi.mocked(db.prospect.findMany).mockResolvedValue([] as never);

    const result = await matchSignalToProspects("s1");

    expect(result.matches).toEqual([]);
  });

  it("respects topK option", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.signalItem.findUnique).mockResolvedValue(DENTAL_SIGNAL as never);
    // Create many prospects that will all match
    const manyProspects = Array.from({ length: 10 }, (_, i) => ({
      ...PROSPECTS[0],
      id: `p${i}`,
      name: `Dental Clinic ${i}`,
      deals: [],
    }));
    vi.mocked(db.prospect.findMany).mockResolvedValue(manyProspects as never);

    const result = await matchSignalToProspects("s1", { topK: 3 });

    expect(result.matches.length).toBeLessThanOrEqual(3);
  });

  it("includes follow-up in matchedTags when signal mentions follow-up", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.signalItem.findUnique).mockResolvedValue(DENTAL_SIGNAL as never);
    vi.mocked(db.prospect.findMany).mockResolvedValue(PROSPECTS as never);

    const result = await matchSignalToProspects("s1");

    const dentalMatch = result.matches.find((m) => m.prospectId === "p1");
    expect(dentalMatch).toBeDefined();
    expect(dentalMatch!.matchedTags).toContain("follow-up");
  });
});
