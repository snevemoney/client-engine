import { describe, it, expect } from "vitest";
import { z } from "zod";

const reviewSchema = z.object({
  campaignShipped: z.boolean().optional(),
  systemImproved: z.boolean().optional(),
  salesActionsDone: z.boolean().optional(),
  proofCaptured: z.boolean().optional(),
  biggestBottleneck: z.string().optional(),
  nextAutomation: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  whatWorked: z.string().optional(),
  whatFailed: z.string().optional(),
  whatChanged: z.string().optional(),
  proofCapturedNotes: z.string().optional(),
  nextWeekCommitments: z.string().optional(),
  complete: z.boolean().optional(),
});

describe("Strategy week review validation", () => {
  it("accepts score in 0-100 range", () => {
    expect(reviewSchema.safeParse({ score: 0 }).success).toBe(true);
    expect(reviewSchema.safeParse({ score: 50 }).success).toBe(true);
    expect(reviewSchema.safeParse({ score: 100 }).success).toBe(true);
  });

  it("rejects score outside 0-100", () => {
    expect(reviewSchema.safeParse({ score: -1 }).success).toBe(false);
    expect(reviewSchema.safeParse({ score: 101 }).success).toBe(false);
  });

  it("accepts complete workflow payload", () => {
    const result = reviewSchema.safeParse({
      score: 75,
      whatWorked: "Shipped campaign",
      whatFailed: "Delayed proof capture",
      whatChanged: "Switched to async reviews",
      nextWeekCommitments: "Ship 2 proposals",
      complete: true,
    });
    expect(result.success).toBe(true);
  });
});
