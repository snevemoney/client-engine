/**
 * Phase 6.2: Founder OS week route tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

vi.mock("@/lib/http/cached-handler", () => ({
  withSummaryCache: vi.fn((_key: string, handler: () => Promise<unknown>) =>
    Promise.resolve(handler()).then((data) =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=15" },
      })
    )
  ),
}));

const mockWeek = {
  id: "w1",
  weekStart: new Date("2025-02-24"),
  weekEnd: new Date("2025-03-02"),
  quarterId: "q1",
  focusConstraint: "focus",
  createdAt: new Date(),
  updatedAt: new Date(),
  plan: {
    id: "p1",
    topOutcomesJson: ["o1"],
    milestonesJson: ["m1"],
    commitmentsJson: [],
  },
  review: null,
};

vi.mock("@/lib/db", () => ({
  db: {
    founderWeek: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    founderWeekPlan: {
      create: vi.fn(),
      update: vi.fn(),
    },
    founderWeekReview: {
      create: vi.fn(),
      update: vi.fn(),
    },
    founderQuarter: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe("GET /api/internal/founder/os/week", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);
    const { db } = await import("@/lib/db");
    vi.mocked(db.founderWeek.findUnique).mockResolvedValue(null);
  });

  it("401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValueOnce(null);

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/founder/os/week");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("200 returns week shape when no week exists", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/founder/os/week");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("week");
    expect(data).toHaveProperty("plan");
    expect(data).toHaveProperty("review");
    expect(data.plan).toHaveProperty("topOutcomes");
    expect(data.plan).toHaveProperty("milestones");
    expect(data.review).toHaveProperty("wins");
    expect(data.review).toHaveProperty("misses");
  });

  it("200 returns week when exists", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.founderWeek.findUnique).mockResolvedValue(mockWeek as never);

    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/founder/os/week");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.week.id).toBe("w1");
    expect(data.plan.topOutcomes).toEqual(["o1"]);
  });
});

describe("PUT /api/internal/founder/os/week", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);
    const { db } = await import("@/lib/db");
    vi.mocked(db.founderWeek.findUnique).mockResolvedValue(mockWeek as never);
    vi.mocked(db.founderQuarter.findFirst).mockResolvedValue(null);
    vi.mocked(db.founderWeek.update).mockResolvedValue(mockWeek as never);
    vi.mocked(db.founderWeekPlan.update).mockResolvedValue({} as never);
  });

  it("401 when unauthenticated", async () => {
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValueOnce(null);

    const { PUT } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/founder/os/week", {
      method: "PUT",
      body: JSON.stringify({ plan: { topOutcomes: ["o1"], milestones: [], commitments: [] } }),
    });
    const res = await PUT(req);

    expect(res.status).toBe(401);
  });

  it("200 persists plan and returns updated shape", async () => {
    const { db } = await import("@/lib/db");
    const updatedWeek = {
      ...mockWeek,
      plan: {
        id: "p1",
        topOutcomesJson: ["o1", "o2"],
        milestonesJson: ["m1"],
        commitmentsJson: [],
      },
    };
    vi.mocked(db.founderWeek.findUnique).mockResolvedValue(updatedWeek as never);

    const { PUT } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/internal/founder/os/week", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        focusConstraint: "new focus",
        plan: { topOutcomes: ["o1", "o2"], milestones: ["m1"], commitments: [] },
      }),
    });
    const res = await PUT(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("plan");
    expect(data.plan).toHaveProperty("topOutcomes");
    expect(Array.isArray(data.plan.topOutcomes)).toBe(true);
  });
});
