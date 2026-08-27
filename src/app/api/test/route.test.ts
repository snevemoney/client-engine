import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/api-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-utils")>("@/lib/api-utils");
  return {
    ...actual,
    requireAuth: vi.fn(async () => null),
    withRouteTiming: (_name: string, fn: () => Promise<Response>) => fn(),
  };
});

describe("GET /api/test", () => {
  it("returns 401 without a session", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });
});
