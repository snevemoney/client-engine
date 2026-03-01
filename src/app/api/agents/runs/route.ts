/**
 * GET /api/agents/runs — list recent agent runs
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
  const agentId = url.searchParams.get("agentId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  const runs = await db.agentRun.findMany({
    where: {
      ...(agentId ? { agentId } : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: {
      approvals: {
        select: { id: true, toolName: true, status: true, createdAt: true },
      },
    },
    orderBy: { startedAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    items: runs.map((r) => ({
      id: r.id,
      agentId: r.agentId,
      triggerType: r.triggerType,
      triggerSource: r.triggerSource,
      taskPrompt: r.taskPrompt.slice(0, 200),
      status: r.status,
      resultSummary: r.resultSummary?.slice(0, 500) ?? null,
      toolCallCount: Array.isArray(r.toolCallsJson) ? (r.toolCallsJson as unknown[]).length : 0,
      tokenUsage: r.tokenUsage,
      errorMessage: r.errorMessage?.slice(0, 200) ?? null,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      durationMs: r.finishedAt
        ? r.finishedAt.getTime() - r.startedAt.getTime()
        : null,
      approvals: r.approvals.map((a) => ({
        id: a.id,
        toolName: a.toolName,
        status: a.status,
        createdAt: a.createdAt.toISOString(),
      })),
    })),
  });
}
