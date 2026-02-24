import { describe, it, expect } from "vitest";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["not_connected", "connected", "error", "disabled"]).optional(),
  mode: z.enum(["off", "mock", "manual", "live"]).optional(),
  accountLabel: z.string().max(200).optional().nullable(),
  configJson: z.record(z.string(), z.unknown()).optional(),
  isEnabled: z.boolean().optional(),
});

describe("Integration PATCH validation", () => {
  it("accepts valid mode values", () => {
    expect(patchSchema.safeParse({ mode: "off" }).success).toBe(true);
    expect(patchSchema.safeParse({ mode: "mock" }).success).toBe(true);
    expect(patchSchema.safeParse({ mode: "manual" }).success).toBe(true);
    expect(patchSchema.safeParse({ mode: "live" }).success).toBe(true);
  });

  it("rejects invalid mode values", () => {
    expect(patchSchema.safeParse({ mode: "invalid" }).success).toBe(false);
    expect(patchSchema.safeParse({ mode: "" }).success).toBe(false);
    expect(patchSchema.safeParse({ mode: "LIVE" }).success).toBe(false); // uppercase
  });

  it("accepts empty body", () => {
    expect(patchSchema.safeParse({}).success).toBe(true);
  });

  it("accepts configJson with additionalQueryParams", () => {
    const result = patchSchema.safeParse({
      configJson: { additionalQueryParams: { hl: "en", gl: "us" } },
    });
    expect(result.success).toBe(true);
  });
});
