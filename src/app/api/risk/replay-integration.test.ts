/**
 * Phase 4.0.1.3: Risk API chain replay — run-rules → summary/list → idempotency.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { RiskSeverity, RiskSourceType } from "@prisma/client";

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

describe("Risk replay integration", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: `risk-replay-${Date.now()}` }, expires: "" } as never);
    await db.riskFlag.deleteMany({ where: { dedupeKey: { startsWith: "risk:score_in_critical_band" } } });
    await db.notificationEvent.deleteMany({ where: { dedupeKey: { contains: "score_in_critical_band" } } });
    await db.scoreSnapshot.deleteMany({ where: { entityId: "command_center" } });
  });

  it("run-rules → summary and list contain created risks; rerun does not duplicate", async () => {
    await db.scoreSnapshot.create({
      data: {
        entityType: "command_center",
        entityId: "command_center",
        score: 40,
        band: "critical",
        delta: -10,
        factorsJson: [],
        reasonsJson: [],
        computedAt: new Date(),
      },
    });

    const { POST } = await import("./run-rules/route");
    const { GET } = await import("./route");
    const { GET: summaryGet } = await import("./summary/route");

    const runRes = await POST(new Request("http://x/api/risk/run-rules", { method: "POST" }));
    expect(runRes.status).toBe(200);
    const runData = await runRes.json();
    expect(runData.created).toBeGreaterThanOrEqual(1);

    const listReq = new NextRequest("http://x/api/risk?status=open");
    const listRes = await GET(listReq);
    const listData = await listRes.json();
    const riskItems = listData.items.filter((r: { createdByRule: string }) => r.createdByRule === "score_in_critical_band");
    expect(riskItems.length).toBeGreaterThanOrEqual(1);

    const summaryReq = new NextRequest("http://x/api/risk/summary");
    const summaryRes = await summaryGet(summaryReq);
    const summaryData = await summaryRes.json();
    expect(summaryData.openBySeverity.critical).toBeGreaterThanOrEqual(1);

    const run2Res = await POST(new Request("http://x/api/risk/run-rules", { method: "POST" }));
    const run2Data = await run2Res.json();
    expect(run2Data.created).toBe(0);
    expect(run2Data.updated).toBeGreaterThanOrEqual(1);
  });
});
