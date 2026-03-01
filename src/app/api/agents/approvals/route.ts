/**
 * GET /api/agents/approvals — list pending approvals
 * POST /api/agents/approvals — approve or reject an approval request
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { processApproval } from "@/lib/agents/approval";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const approvals = await db.agentApproval.findMany({
    where: { status: "pending" },
    include: {
      agentRun: {
        select: { agentId: true, triggerType: true, taskPrompt: true, startedAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    items: approvals.map((a) => ({
      id: a.id,
      agentRunId: a.agentRunId,
      agentId: a.agentRun.agentId,
      triggerType: a.agentRun.triggerType,
      toolName: a.toolName,
      toolInput: a.toolInputJson,
      reason: a.reason,
      status: a.status,
      expiresAt: a.expiresAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { approvalId, approved } = body as {
    approvalId?: string;
    approved?: boolean;
  };

  if (!approvalId || typeof approved !== "boolean") {
    return NextResponse.json(
      { error: "approvalId (string) and approved (boolean) required" },
      { status: 400 }
    );
  }

  const result = await processApproval({
    approvalId,
    approved,
    actorUserId: session.user.id,
    toolContext: { userId: session.user.id, baseUrl: "", entityType: "command_center", entityId: "command_center" },
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    approved,
    toolResult: result.toolResult ?? null,
    error: result.error ?? null,
  });
}
