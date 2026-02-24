import { describe, it, expect } from "vitest";
import { buildProofCandidateFromIntakeLead } from "./build-from-intake";

describe("buildProofCandidateFromIntakeLead", () => {
  it("creates sane title", () => {
    const result = buildProofCandidateFromIntakeLead({
      id: "lead1",
      title: "Dashboard build",
      company: "Acme",
    });
    expect(result.title).toBe("Delivery proof — Dashboard build");
  });

  it("handles empty title", () => {
    const result = buildProofCandidateFromIntakeLead({
      id: "lead1",
      title: "",
    });
    expect(result.title).toBe("Delivery proof — Untitled");
  });

  it("picks triggerType github when githubUrl exists", () => {
    const result = buildProofCandidateFromIntakeLead({
      id: "lead1",
      title: "Work",
      githubUrl: "https://github.com/o/r",
    });
    expect(result.triggerType).toBe("github");
  });

  it("picks triggerType loom when loomUrl exists (no github)", () => {
    const result = buildProofCandidateFromIntakeLead({
      id: "lead1",
      title: "Work",
      loomUrl: "https://loom.com/share/abc",
    });
    expect(result.triggerType).toBe("loom");
  });

  it("picks triggerType manual when no links", () => {
    const result = buildProofCandidateFromIntakeLead({
      id: "lead1",
      title: "Work",
    });
    expect(result.triggerType).toBe("manual");
  });

  it("produces safe proofSnippet fallback", () => {
    const result = buildProofCandidateFromIntakeLead({
      id: "lead1",
      title: "Work",
      company: "Acme",
      deliverySummary: "Built the dashboard",
    });
    expect(result.proofSnippet).toContain("Delivered work for Acme");
    expect(result.proofSnippet).toContain("Built the dashboard");
  });

  it("uses client when company empty", () => {
    const result = buildProofCandidateFromIntakeLead({
      id: "lead1",
      title: "Work",
    });
    expect(result.proofSnippet).toContain("client");
  });

  it("applies proofSnippet override", () => {
    const result = buildProofCandidateFromIntakeLead(
      {
        id: "lead1",
        title: "Work",
        company: "Acme",
      },
      { proofSnippet: "Custom snippet here" }
    );
    expect(result.proofSnippet).toBe("Custom snippet here");
  });
});
