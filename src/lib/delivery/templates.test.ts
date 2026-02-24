import { describe, it, expect } from "vitest";
import {
  buildDefaultDeliveryChecklist,
  buildDefaultMilestonesFromProposal,
} from "./templates";

describe("buildDefaultDeliveryChecklist", () => {
  it("returns items for all categories", () => {
    const items = buildDefaultDeliveryChecklist();
    const categories = [...new Set(items.map((i) => i.category))];
    expect(categories).toContain("kickoff");
    expect(categories).toContain("build");
    expect(categories).toContain("qa");
    expect(categories).toContain("handoff");
    expect(categories).toContain("proof");
  });

  it("has required items", () => {
    const items = buildDefaultDeliveryChecklist();
    expect(items.filter((i) => i.isRequired).length).toBeGreaterThan(0);
  });
});

describe("buildDefaultMilestonesFromProposal", () => {
  it("returns generic milestones when no proposal", () => {
    const ms = buildDefaultMilestonesFromProposal(null);
    expect(ms.length).toBeGreaterThan(0);
    expect(ms[0].title).toBe("Discovery");
  });

  it("uses deliverables when present", () => {
    const ms = buildDefaultMilestonesFromProposal({
      deliverables: ["Phase 1", "Phase 2"],
    });
    expect(ms.length).toBe(2);
    expect(ms[0].title).toBe("Phase 1");
    expect(ms[1].title).toBe("Phase 2");
  });

  it("falls back to generic when deliverables empty", () => {
    const ms = buildDefaultMilestonesFromProposal({ deliverables: [] });
    expect(ms.length).toBe(4);
  });
});
