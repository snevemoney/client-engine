/**
 * POST /api/agents/run — run a specific agent on demand.
 * Body: { agentId: string, task?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runAgent } from "@/lib/agents/runner";
import { getAgentConfig } from "@/lib/agents/registry";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { agentId, task } = body as { agentId?: string; task?: string };

  if (!agentId) {
    return NextResponse.json({ error: "agentId required" }, { status: 400 });
  }

  const config = getAgentConfig(agentId as Parameters<typeof getAgentConfig>[0]);
  if (!config) {
    return NextResponse.json({ error: `Unknown agent: ${agentId}` }, { status: 400 });
  }

  // Use provided task or default to the first scheduled run's task
  const taskPrompt = task || config.scheduledRuns[0]?.taskPrompt || `Run ${config.name} default task.`;

  const protocol = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "localhost:3000";
  const baseUrl = `${protocol}://${host}`;
  const cookie = req.headers.get("cookie") || undefined;

  try {
    const result = await runAgent(config.id, taskPrompt, {
      userId: session.user.id,
      baseUrl,
      cookie,
      entityType: "command_center",
      entityId: "command_center",
    }, {
      triggerType: "event",
      triggerSource: "manual_dashboard",
    });

    return NextResponse.json({
      ok: result.status !== "failed",
      agentRunId: result.agentRunId,
      status: result.status,
      resultSummary: result.resultSummary,
      toolCalls: result.toolCalls.length,
      pendingApprovals: result.pendingApprovals.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Agent run failed";
    return NextResponse.json({ error: message, ok: false }, { status: 500 });
  }
}
