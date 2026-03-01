/**
 * POST /api/agents/cron
 * Runs scheduled agent tasks. Protected by AGENT_CRON_SECRET (Bearer token)
 * or session auth for manual triggers from the dashboard.
 *
 * Intended to be called by Vercel Cron (3x daily: 8am, 12pm, 6pm ET)
 * or manually by the operator.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getScheduledRuns } from "@/lib/agents/scheduler";
import { runAgent } from "@/lib/agents/runner";
import { reapStaleRuns, expireStaleApprovals } from "@/lib/agents/approval";
import { logOpsEventSafe } from "@/lib/ops-events/log";
import { sanitizeMeta } from "@/lib/ops-events/sanitize";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — agents may take a while

const CRON_SECRET = process.env.AGENT_CRON_SECRET;

async function authenticate(req: NextRequest): Promise<string | null> {
  // Bearer token auth for cron jobs
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token === CRON_SECRET) return "cron";
  }

  // Session auth for manual triggers
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  return null;
}

export async function POST(req: NextRequest) {
  const userId = await authenticate(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Housekeeping: expire stale approvals and reap timed-out runs
    await Promise.allSettled([
      expireStaleApprovals(),
      reapStaleRuns(),
    ]);

    const tasks = await getScheduledRuns();

    if (tasks.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No scheduled tasks due",
        ran: 0,
      });
    }

    const results: Array<{
      agentId: string;
      cronLabel: string;
      status: string;
      agentRunId: string;
      toolCalls: number;
    }> = [];

    // Run agents sequentially to respect concurrency limits
    for (const task of tasks) {
      const result = await runAgent(task.agentId, task.taskPrompt, {
        userId: userId === "cron" ? "system" : userId,
        baseUrl: "",
        entityType: "command_center",
        entityId: "command_center",
      }, {
        triggerType: "scheduled",
        triggerSource: task.cronLabel,
        dedupeKey: task.dedupeKey,
      });

      results.push({
        agentId: task.agentId,
        cronLabel: task.cronLabel,
        status: result.status,
        agentRunId: result.agentRunId,
        toolCalls: result.toolCalls.length,
      });
    }

    logOpsEventSafe({
      category: "system",
      eventKey: "agents.cron.completed",
      meta: sanitizeMeta({
        tasksFound: tasks.length,
        results: results.map((r) => `${r.agentId}:${r.status}`),
      }),
    });

    return NextResponse.json({
      ok: true,
      ran: results.length,
      results,
    });
  } catch (err) {
    console.error("[agents/cron]", err);
    logOpsEventSafe({
      category: "system",
      eventKey: "agents.cron.failed",
      status: "failure",
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent cron failed" },
      { status: 500 }
    );
  }
}
