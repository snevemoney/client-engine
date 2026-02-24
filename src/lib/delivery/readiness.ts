/**
 * Phase 2.0: Delivery project readiness and health.
 */

import type { DeliveryProjectStatus } from "@prisma/client";

export type DeliveryProjectLike = {
  status?: string | null;
  dueDate?: Date | string | null;
  completedAt?: Date | string | null;
};

export type ChecklistItemLike = {
  isRequired?: boolean;
  isDone?: boolean;
};

export type MilestoneLike = {
  status?: string | null;
};

export type DeliveryReadinessResult = {
  canComplete: boolean;
  reasons: string[];
  warnings: string[];
};

export type ProjectHealth = "on_track" | "due_soon" | "overdue" | "blocked";

const DUE_SOON_DAYS = 3;

/**
 * Compute whether a delivery project can be marked completed.
 * Cannot complete if: required checklist items incomplete, any milestone blocked.
 */
export function computeDeliveryCompletionReadiness(
  project: DeliveryProjectLike,
  checklist: ChecklistItemLike[],
  milestones: MilestoneLike[],
  options?: { force?: boolean }
): DeliveryReadinessResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (options?.force) {
    return { canComplete: true, reasons: [], warnings: ["Force override applied"] };
  }

  const status = (project.status ?? "").toLowerCase();
  if (status === "completed" || status === "archived") {
    return { canComplete: false, reasons: ["Project already completed or archived"], warnings: [] };
  }

  const requiredIncomplete = checklist.filter((c) => c.isRequired && !c.isDone);
  if (requiredIncomplete.length > 0) {
    reasons.push(`${requiredIncomplete.length} required checklist item(s) incomplete`);
  }

  const blockedMilestones = milestones.filter((m) => (m.status ?? "").toLowerCase() === "blocked");
  if (blockedMilestones.length > 0) {
    reasons.push(`${blockedMilestones.length} milestone(s) blocked`);
  }

  const doneMilestones = milestones.filter((m) => (m.status ?? "").toLowerCase() === "done");
  if (milestones.length > 0 && doneMilestones.length < milestones.length && blockedMilestones.length === 0) {
    warnings.push("Not all milestones marked done");
  }

  const canComplete = reasons.length === 0;

  return { canComplete, reasons, warnings };
}

/**
 * Compute project health: on_track | due_soon | overdue | blocked.
 */
export function computeProjectHealth(project: DeliveryProjectLike): ProjectHealth {
  const status = (project.status ?? "").toLowerCase();
  if (status === "blocked") return "blocked";
  if (status === "completed" || status === "archived") return "on_track";

  const dueDate = project.dueDate;
  if (!dueDate) return "on_track";

  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  if (Number.isNaN(d.getTime())) return "on_track";

  const now = new Date();
  const msPerDay = 86400000;
  const daysUntil = (d.getTime() - now.getTime()) / msPerDay;

  if (daysUntil < 0) return "overdue";
  if (daysUntil <= DUE_SOON_DAYS) return "due_soon";
  return "on_track";
}
