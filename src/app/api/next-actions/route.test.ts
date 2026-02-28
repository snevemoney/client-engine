/**
 * Phase 4.0.1: Next Actions list route contract tests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { NextActionPriority, NextActionStatus, RiskSourceType } from "@prisma/client";

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

describe("GET /api/next-actions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1", email: "t@t.com" }, expires: "" } as never);
    await db.nextBestAction.deleteMany({ where: { title: { startsWith: "Test NBA " } } });
  });

  it("returns items array and pagination with correct shape", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.pagination).toMatchObject({
      page: 1,
      pageSize: 25,
      total: expect.any(Number),
      totalPages: expect.any(Number),
      hasNext: expect.any(Boolean),
      hasPrev: expect.any(Boolean),
    });
  });

  it("pagination works: pageSize=2 returns max 2 items and correct meta", async () => {
    await db.nextBestAction.deleteMany({ where: { createdByRule: "test_pagination" } });
    await db.nextBestAction.createMany({
      data: [
        {
          title: "Test NBA 1",
          priority: NextActionPriority.high,
          score: 75,
          status: NextActionStatus.queued,
          sourceType: RiskSourceType.proposal,
          dedupeKey: "test_nba_pag_1:sys",
          createdByRule: "test_pagination",
        },
        {
          title: "Test NBA 2",
          priority: NextActionPriority.medium,
          score: 55,
          status: NextActionStatus.queued,
          sourceType: RiskSourceType.proposal,
          dedupeKey: "test_nba_pag_2:sys",
          createdByRule: "test_pagination",
        },
        {
          title: "Test NBA 3",
          priority: NextActionPriority.low,
          score: 30,
          status: NextActionStatus.queued,
          sourceType: RiskSourceType.proposal,
          dedupeKey: "test_nba_pag_3:sys",
          createdByRule: "test_pagination",
        },
      ],
    });

    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions?page=1&pageSize=2&status=queued");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items.length).toBeLessThanOrEqual(2);
    expect(data.pagination.pageSize).toBe(2);
  });

  it("filter by entityType/entityId scope returns only scoped items", async () => {
    await db.nextBestAction.deleteMany({ where: { createdByRule: "test_scope" } });
    await db.nextBestAction.createMany({
      data: [
        {
          title: "Test NBA command_center",
          priority: NextActionPriority.high,
          score: 75,
          status: NextActionStatus.queued,
          sourceType: RiskSourceType.proposal,
          dedupeKey: "test_nba_scope_cc:cmd",
          createdByRule: "test_scope",
          entityType: "command_center",
          entityId: "command_center",
        },
        {
          title: "Test NBA review_stream",
          priority: NextActionPriority.medium,
          score: 55,
          status: NextActionStatus.queued,
          sourceType: RiskSourceType.proposal,
          dedupeKey: "test_nba_scope_rs:cmd",
          createdByRule: "test_scope",
          entityType: "review_stream",
          entityId: "review_stream",
        },
      ],
    });

    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions?entityType=command_center&entityId=command_center&status=queued");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items.every((a: { entityType: string }) => a.entityType === "command_center")).toBe(true);
  });

  it("Phase 4.2: hides snoozed items (snoozedUntil > now) when status=queued", async () => {
    vi.useFakeTimers();
    try {
      await db.nextBestAction.deleteMany({ where: { createdByRule: "test_snooze" } });
      const fixedNow = new Date("2024-06-15T12:00:00Z");
      vi.setSystemTime(fixedNow);
      const tomorrow = new Date(fixedNow);
      tomorrow.setDate(tomorrow.getDate() + 1);
      await db.nextBestAction.create({
        data: {
          title: "Test NBA snoozed",
          priority: NextActionPriority.high,
          score: 75,
          status: NextActionStatus.queued,
          sourceType: RiskSourceType.proposal,
          dedupeKey: "test_nba_snoozed:sys",
          createdByRule: "test_snooze",
          snoozedUntil: tomorrow,
        },
      });
      await db.nextBestAction.create({
        data: {
          title: "Test NBA not snoozed",
          priority: NextActionPriority.medium,
          score: 55,
          status: NextActionStatus.queued,
          sourceType: RiskSourceType.proposal,
          dedupeKey: "test_nba_not_snoozed:sys",
          createdByRule: "test_snooze",
        },
      });

      const { GET } = await import("./route");
      const req = new NextRequest("http://x/api/next-actions?status=queued&pageSize=100");
      const res = await GET(req);
      const data = await res.json();
      const snoozed = data.items.find((a: { title: string }) => a.title === "Test NBA snoozed");
      const notSnoozed = data.items.find((a: { title: string }) => a.title === "Test NBA not snoozed");
      expect(snoozed).toBeUndefined();
      expect(notSnoozed).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("filter by status works", async () => {
    await db.nextBestAction.deleteMany({ where: { title: { in: ["Test NBA queued", "Test NBA done"] } } });
    await db.nextBestAction.create({
      data: {
        title: "Test NBA queued",
        priority: NextActionPriority.high,
        score: 75,
        status: NextActionStatus.queued,
        sourceType: RiskSourceType.proposal,
        dedupeKey: "test_nba_queued:sys",
        createdByRule: "test",
      },
    });
    await db.nextBestAction.create({
      data: {
        title: "Test NBA done",
        priority: NextActionPriority.low,
        score: 30,
        status: NextActionStatus.done,
        sourceType: RiskSourceType.proposal,
        dedupeKey: "test_nba_done:sys",
        createdByRule: "test",
      },
    });

    const { GET } = await import("./route");
    const req = new NextRequest("http://x/api/next-actions?status=queued");
    const res = await GET(req);
    const data = await res.json();
    expect(data.items.every((a: { status: string }) => a.status === "queued")).toBe(true);
  });
});
