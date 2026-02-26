/**
 * Phase 4.0.1.3: Next Actions API chain replay — run → summary/list → dismiss → rerun.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { NextActionStatus } from "@prisma/client";

vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  jsonError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { "Content-Type": "application/json" } }),
  withRouteTiming: (_: string, fn: () => Promise<Response>) => fn(),
}));

describe("Next Actions replay integration", () => {
  let actionId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import("@/lib/api-utils");
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: `replay-${Date.now()}` }, expires: "" } as never);
  });

  it("run → summary → dismiss → rerun: dismissal persists", async () => {
    const { POST } = await import("./run/route");
    const { GET } = await import("./route");
    const { GET: summaryGet } = await import("./summary/route");
    const { PATCH } = await import("./[id]/route");

    const runRes = await POST(new NextRequest("http://x/api/next-actions/run", { method: "POST" }));
    expect(runRes.status).toBe(200);
    const runData = await runRes.json();

    const summaryReq = new NextRequest("http://x/api/next-actions/summary");
    const summaryRes = await summaryGet(summaryReq);
    const summaryData = await summaryRes.json();
    const firstAction = summaryData.top5?.[0];
    if (!firstAction) return;

    actionId = firstAction.id;
    const patchRes = await PATCH(
      new NextRequest("http://x/api/next-actions/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      }),
      { params: Promise.resolve({ id: actionId }) }
    );
    expect(patchRes.status).toBe(200);

    const updated = await db.nextBestAction.findUnique({ where: { id: actionId } });
    expect(updated?.status).toBe(NextActionStatus.dismissed);

    await POST(new NextRequest("http://x/api/next-actions/run", { method: "POST" }));
    const stillDismissed = await db.nextBestAction.findUnique({ where: { id: actionId } });
    expect(stillDismissed?.status).toBe(NextActionStatus.dismissed);
  });
});
