import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateContentPostDrafts,
  schedulePost,
  executePost,
} from "./service";

vi.mock("@/lib/db", () => ({
  db: {
    proofRecord: {
      findUnique: vi.fn(),
    },
    contentPost: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const MOCK_PROOF = {
  id: "proof1",
  title: "Dental clinic website rebuild",
  company: "Smile Dental",
  beforeState: "Losing 40% of leads to slow follow-up",
  afterState: "Automated booking captures every lead",
  metricValue: "3x",
  metricLabel: "more bookings per month",
  proofSnippet: "We finally stopped losing patients to slow callbacks.",
};

describe("distribution service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateContentPostDrafts", () => {
    it("creates draft for valid proof record", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.proofRecord.findUnique).mockResolvedValue(MOCK_PROOF as never);
      vi.mocked(db.contentPost.findFirst).mockResolvedValue(null);
      vi.mocked(db.contentPost.create).mockResolvedValue({
        id: "cp1",
        platform: "linkedin",
        status: "draft",
      } as never);

      const result = await generateContentPostDrafts("proof1", ["linkedin"]);

      expect(result).toHaveLength(1);
      expect(result[0].contentPostId).toBe("cp1");
      expect(result[0].platform).toBe("linkedin");
      expect(result[0].status).toBe("draft");
      expect(db.contentPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            proofRecordId: "proof1",
            platform: "linkedin",
            status: "draft",
            generatedBy: "system",
          }),
        })
      );
    });

    it("skips if post already exists for platform", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.proofRecord.findUnique).mockResolvedValue(MOCK_PROOF as never);
      vi.mocked(db.contentPost.findFirst).mockResolvedValue({ id: "existing" } as never);

      const result = await generateContentPostDrafts("proof1", ["linkedin"]);

      expect(result).toHaveLength(0);
      expect(db.contentPost.create).not.toHaveBeenCalled();
    });

    it("throws for missing proof record", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.proofRecord.findUnique).mockResolvedValue(null);

      await expect(generateContentPostDrafts("missing")).rejects.toThrow(
        "ProofRecord not found: missing"
      );
    });

    it("generates for multiple platforms", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.proofRecord.findUnique).mockResolvedValue(MOCK_PROOF as never);
      vi.mocked(db.contentPost.findFirst).mockResolvedValue(null);
      let callCount = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.contentPost.create).mockImplementation((async () => {
        callCount++;
        return { id: `cp${callCount}`, platform: callCount === 1 ? "linkedin" : "twitter", status: "draft" };
      }) as any);

      const result = await generateContentPostDrafts("proof1", ["linkedin", "twitter"]);

      expect(result).toHaveLength(2);
      expect(db.contentPost.create).toHaveBeenCalledTimes(2);
    });

    it("uses custom generatedBy when provided", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.proofRecord.findUnique).mockResolvedValue(MOCK_PROOF as never);
      vi.mocked(db.contentPost.findFirst).mockResolvedValue(null);
      vi.mocked(db.contentPost.create).mockResolvedValue({ id: "cp1", platform: "linkedin", status: "draft" } as never);

      await generateContentPostDrafts("proof1", ["linkedin"], "distribution_ops");

      expect(db.contentPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ generatedBy: "distribution_ops" }),
        })
      );
    });

    it("LinkedIn content includes proof title and closing line", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.proofRecord.findUnique).mockResolvedValue(MOCK_PROOF as never);
      vi.mocked(db.contentPost.findFirst).mockResolvedValue(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.contentPost.create).mockImplementation((async (args: any) => {
        return { id: "cp1", platform: "linkedin", status: "draft", ...args.data };
      }) as any);

      await generateContentPostDrafts("proof1", ["linkedin"]);

      const createCall = vi.mocked(db.contentPost.create).mock.calls[0][0] as { data: { content: string } };
      expect(createCall.data.content).toContain("Dental clinic website rebuild");
      expect(createCall.data.content).toContain("No hype. Just results.");
      expect(createCall.data.content).toContain("Smile Dental");
    });
  });

  describe("schedulePost", () => {
    it("updates status to scheduled with date", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.contentPost.update).mockResolvedValue({ id: "cp1", status: "scheduled" } as never);

      const scheduledFor = new Date("2026-03-15T10:00:00Z");
      const result = await schedulePost("cp1", scheduledFor);

      expect(result.status).toBe("scheduled");
      expect(db.contentPost.update).toHaveBeenCalledWith({
        where: { id: "cp1" },
        data: { status: "scheduled", scheduledFor },
      });
    });
  });

  describe("executePost", () => {
    it("updates status to posted with timestamp", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.contentPost.update).mockResolvedValue({ id: "cp1", status: "posted" } as never);

      const result = await executePost("cp1");

      expect(result.status).toBe("posted");
      expect(db.contentPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "cp1" },
          data: expect.objectContaining({ status: "posted" }),
        })
      );
      const updateCall = vi.mocked(db.contentPost.update).mock.calls[0][0] as { data: { postedAt: unknown } };
      expect(updateCall.data.postedAt).toBeInstanceOf(Date);
    });
  });
});
