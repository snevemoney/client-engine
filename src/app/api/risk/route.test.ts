/**
 * Phase 4.0.1: Risk list route contract tests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { RiskSeverity, RiskStatus, RiskSourceType } from "@prisma/client";

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

describe("GET /api/risk", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);
    await db.riskFlag.deleteMany({ where: { key: { startsWith: "test_risk_" } } });
  });

  it("returns items array and pagination with correct shape", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/risk");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.pagination).toBeDefined();
    expect(data.pagination).toMatchObject({
      page: 1,
      pageSize: 25,
      total: expect.any(Number),
      totalPages: expect.any(Number),
      hasNext: expect.any(Boolean),
      hasPrev: expect.any(Boolean),
    });
  });

  it("pagination works: page=1 pageSize=2 returns max 2 items", async () => {
    await db.riskFlag.deleteMany({ where: { createdByRule: "test_pagination" } });
    const now = new Date();
    await db.riskFlag.createMany({
      data: [
        {
          key: "test_risk_pag_1",
          title: "R1",
          severity: RiskSeverity.low,
          status: RiskStatus.open,
          sourceType: RiskSourceType.proposal,
          dedupeKey: "test_risk_pag_1:sys",
          createdByRule: "test_pagination",
          lastSeenAt: now,
        },
        {
          key: "test_risk_pag_2",
          title: "R2",
          severity: RiskSeverity.medium,
          status: RiskStatus.open,
          sourceType: RiskSourceType.proposal,
          dedupeKey: "test_risk_pag_2:sys",
          createdByRule: "test_pagination",
          lastSeenAt: now,
        },
        {
          key: "test_risk_pag_3",
          title: "R3",
          severity: RiskSeverity.high,
          status: RiskStatus.open,
          sourceType: RiskSourceType.proposal,
          dedupeKey: "test_risk_pag_3:sys",
          createdByRule: "test_pagination",
          lastSeenAt: now,
        },
      ],
    });

    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/risk?page=1&pageSize=2&status=open");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items.length).toBeLessThanOrEqual(2);
    expect(data.pagination.pageSize).toBe(2);
    expect(data.pagination.total).toBeGreaterThanOrEqual(3);
  });

  it("filter by status returns only matching status", async () => {
    await db.riskFlag.deleteMany({ where: { createdByRule: "test_status_filter" } });
    const now = new Date();
    await db.riskFlag.create({
      data: {
        key: "test_risk_open",
        title: "Open",
        severity: RiskSeverity.high,
        status: RiskStatus.open,
        sourceType: RiskSourceType.proposal,
        dedupeKey: "test_risk_open:sys",
        createdByRule: "test_status_filter",
        lastSeenAt: now,
      },
    });
    await db.riskFlag.create({
      data: {
        key: "test_risk_dismissed",
        title: "Dismissed",
        severity: RiskSeverity.low,
        status: RiskStatus.dismissed,
        sourceType: RiskSourceType.proposal,
        dedupeKey: "test_risk_dismissed:sys",
        createdByRule: "test_status_filter",
        lastSeenAt: now,
      },
    });

    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/risk?status=open");
    const res = await GET(req);
    const data = await res.json();
    expect(data.items.every((r: { status: string }) => r.status === "open")).toBe(true);
  });

  it("search filter works", async () => {
    const unique = "Phase401TestSearchXyZ99";
    await db.riskFlag.deleteMany({ where: { dedupeKey: "test_risk_searchable:sys" } });
    const now = new Date();
    await db.riskFlag.create({
      data: {
        key: "test_risk_searchable",
        title: unique,
        severity: RiskSeverity.low,
        status: RiskStatus.open,
        sourceType: RiskSourceType.proposal,
        dedupeKey: "test_risk_searchable:sys",
        createdByRule: "test",
        lastSeenAt: now,
      },
    });

    const { GET } = await import("./route");
    const req = new NextRequest(`http://x/api/risk?search=${encodeURIComponent(unique)}`);
    const res = await GET(req);
    const data = await res.json();
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    expect(data.items.some((r: { title: string }) => r.title.includes(unique))).toBe(true);
  });
});
