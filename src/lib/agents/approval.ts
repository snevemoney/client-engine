/**
 * Multi-Agent Business Automation — approval gate.
 * Handles write-tool approval flow for agent runs.
 */
import { db } from "@/lib/db";
import type { AgentConfig } from "./types";
import { AGENT_LIMITS } from "./types";
import { executeTool, type ToolContext } from "@/lib/brain/executor";
import { logOpsEventSafe } from "@/lib/ops-events/log";
import { sanitizeMeta } from "@/lib/ops-events/sanitize";

/** Check if a tool needs explicit approval for this agent */
export function requiresApproval(
  config: AgentConfig,
  toolName: string
): boolean {
  // All read tools are auto-approved
  if (toolName.startsWith("get_") || toolName.startsWith("list_") || toolName === "search_knowledge") {
    return false;
  }
  return !config.autoApprovedTools.includes(toolName);
}

/** Create an approval request and pause the agent run */
export async function createApprovalRequest(params: {
  agentRunId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  reason: string;
}): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + AGENT_LIMITS.approvalExpiryHours);

  const approval = await db.agentApproval.create({
    data: {
      agentRunId: params.agentRunId,
      toolName: params.toolName,
      toolInputJson: params.toolInput,
      reason: params.reason,
      expiresAt,
    },
  });

  // Update agent run status
  await db.agentRun.update({
    where: { id: params.agentRunId },
    data: { status: "awaiting_approval" },
  });

  logOpsEventSafe({
    category: "system",
    eventKey: "agent.approval_requested",
    meta: sanitizeMeta({
      agentRunId: params.agentRunId,
      approvalId: approval.id,
      toolName: params.toolName,
    }),
  });

  // Send in-app notification
  try {
    const { createNotificationEvent, queueNotificationDeliveries } = await import(
      "@/lib/notifications/service"
    );
    const { id: eventId, created } = await createNotificationEvent({
      eventKey: "agent.approval_needed",
      title: `Agent needs approval: ${params.toolName}`,
      message: params.reason,
      severity: "warning",
      sourceType: "agent",
      sourceId: params.agentRunId,
      actionUrl: "/dashboard/operator/agents",
      dedupeKey: `agent:approval:${approval.id}`,
      createdByRule: "agent.approval_gate",
    });
    if (created) await queueNotificationDeliveries(eventId, ["in_app"]);
  } catch {
    // Non-blocking
  }

  return approval.id;
}

/** Process an approval decision (approve or reject) */
export async function processApproval(params: {
  approvalId: string;
  approved: boolean;
  actorUserId: string;
  toolContext: ToolContext;
}): Promise<{ success: boolean; toolResult?: unknown; error?: string }> {
  const approval = await db.agentApproval.findUnique({
    where: { id: params.approvalId },
    include: { agentRun: true },
  });

  if (!approval) return { success: false, error: "Approval not found" };
  if (approval.status !== "pending") return { success: false, error: `Approval already ${approval.status}` };

  // Check expiry
  if (approval.expiresAt && approval.expiresAt < new Date()) {
    await db.agentApproval.update({
      where: { id: params.approvalId },
      data: { status: "expired", decidedAt: new Date() },
    });
    return { success: false, error: "Approval expired" };
  }

  const newStatus = params.approved ? "approved" : "rejected";
  await db.agentApproval.update({
    where: { id: params.approvalId },
    data: {
      status: newStatus,
      decidedBy: params.actorUserId,
      decidedAt: new Date(),
    },
  });

  logOpsEventSafe({
    category: "api_action",
    eventKey: `agent.approval_${newStatus}`,
    actorType: "user",
    actorId: params.actorUserId,
    meta: sanitizeMeta({
      approvalId: params.approvalId,
      agentRunId: approval.agentRunId,
      toolName: approval.toolName,
    }),
  });

  if (!params.approved) {
    // Mark agent run as failed
    await db.agentRun.update({
      where: { id: approval.agentRunId },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: `Approval rejected for ${approval.toolName}`,
      },
    });

    // Ingest rejection into operator memory as negative signal
    try {
      const { ingestFromAgentRejection } = await import("@/lib/memory/agent-ingest");
      await ingestFromAgentRejection(
        approval.agentRunId,
        approval.toolName,
        params.actorUserId
      );
    } catch {
      // Non-blocking — memory ingestion failure shouldn't break the rejection flow
    }

    return { success: true };
  }

  // Execute the approved tool
  const toolInput = (approval.toolInputJson as Record<string, unknown>) || {};
  const toolResult = await executeTool(
    approval.toolName,
    toolInput,
    params.toolContext
  );

  // Check if there are more pending approvals for this run
  const remainingApprovals = await db.agentApproval.count({
    where: { agentRunId: approval.agentRunId, status: "pending" },
  });

  if (remainingApprovals === 0) {
    await db.agentRun.update({
      where: { id: approval.agentRunId },
      data: { status: "completed", finishedAt: new Date() },
    });
  }

  return {
    success: true,
    toolResult: toolResult.result,
    error: toolResult.error,
  };
}

/** Expire stale approvals (called by system agent or cron) */
export async function expireStaleApprovals(): Promise<number> {
  const now = new Date();
  const expired = await db.agentApproval.updateMany({
    where: {
      status: "pending",
      expiresAt: { lt: now },
    },
    data: { status: "expired", decidedAt: now },
  });
  return expired.count;
}

/** Mark stale running agent runs as timed out */
export async function reapStaleRuns(): Promise<number> {
  const cutoff = new Date(Date.now() - AGENT_LIMITS.staleRunTimeoutMinutes * 60 * 1000);
  const timedOut = await db.agentRun.updateMany({
    where: {
      status: "running",
      startedAt: { lt: cutoff },
    },
    data: {
      status: "timed_out",
      finishedAt: new Date(),
      errorMessage: `Timed out after ${AGENT_LIMITS.staleRunTimeoutMinutes} minutes`,
    },
  });
  return timedOut.count;
}
