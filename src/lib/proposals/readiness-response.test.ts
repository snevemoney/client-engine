/**
 * Phase 2.1: Proposal response readiness lib tests.
 */
import { describe, it, expect } from "vitest";
import { computeProposalResponseReadiness } from "./readiness-response";

describe("computeProposalResponseReadiness", () => {
  it("canMarkSent when status is ready and not sent", () => {
    const r = computeProposalResponseReadiness({ status: "ready", sentAt: null });
    expect(r.canMarkSent).toBe(true);
    expect(r.canLogResponse).toBe(false);
  });

  it("canMarkSent false when already sent", () => {
    const r = computeProposalResponseReadiness({ status: "sent", sentAt: new Date() });
    expect(r.canMarkSent).toBe(false);
  });

  it("canLogResponse when sent and not closed", () => {
    const r = computeProposalResponseReadiness({ status: "sent", sentAt: new Date() });
    expect(r.canLogResponse).toBe(true);
  });

  it("canLogResponse false when accepted", () => {
    const r = computeProposalResponseReadiness({ status: "sent", sentAt: new Date(), acceptedAt: new Date() });
    expect(r.canLogResponse).toBe(false);
  });

  it("canBookMeeting when sent and no meeting booked", () => {
    const r = computeProposalResponseReadiness({ status: "sent", sentAt: new Date() });
    expect(r.canBookMeeting).toBe(true);
  });

  it("canBookMeeting false when meeting already booked", () => {
    const r = computeProposalResponseReadiness({
      status: "sent",
      sentAt: new Date(),
      meetingBookedAt: new Date(),
    });
    expect(r.canBookMeeting).toBe(false);
  });

  it("adds warning when sent but no response", () => {
    const r = computeProposalResponseReadiness({ status: "sent", sentAt: new Date() });
    expect(r.warnings).toContain("No response logged yet");
  });
});
