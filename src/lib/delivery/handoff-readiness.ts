/**
 * Phase 2.2: Handoff readiness for delivery projects.
 * Null-safe, manual-first.
 */

export type DeliveryProjectLike = {
  status?: string | null;
  completedAt?: Date | string | null;
  handoffStartedAt?: Date | string | null;
  handoffCompletedAt?: Date | string | null;
};

export type ChecklistItemLike = {
  isRequired?: boolean;
  isDone?: boolean;
};

export type HandoffReadinessResult = {
  isReadyForHandoff: boolean;
  reasons: string[];
  warnings: string[];
};

function parseDate(input: unknown): Date | null {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN((input as Date).getTime()) ? null : (input as Date);
  if (typeof input === "string") {
    const d = new Date(input.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Compute whether a delivery project is ready for handoff.
 * Rules:
 * - project exists
 * - project status not canceled/lost (completed or archived)
 * - checklist minimally complete (or warning if not)
 * - completion date/status present (or warning)
 */
export function computeHandoffReadiness(
  project: DeliveryProjectLike,
  checklist: ChecklistItemLike[] = []
): HandoffReadinessResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  const status = (project.status ?? "").toString().toLowerCase();

  if (status === "blocked") {
    reasons.push("Project is blocked");
    return { isReadyForHandoff: false, reasons, warnings };
  }

  if (status !== "completed" && status !== "archived") {
    reasons.push("Project must be completed or archived before handoff");
    return { isReadyForHandoff: false, reasons, warnings };
  }

  const completedAt = parseDate(project.completedAt);
  if (!completedAt) {
    warnings.push("No completion date set");
  }

  const requiredIncomplete = checklist.filter((c) => c.isRequired && !c.isDone);
  if (requiredIncomplete.length > 0) {
    warnings.push(`${requiredIncomplete.length} required checklist item(s) incomplete`);
  }

  const isReadyForHandoff = reasons.length === 0;

  return { isReadyForHandoff, reasons, warnings };
}
