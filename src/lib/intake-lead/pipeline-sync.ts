/**
 * Phase 1.5: Safe sync of IntakeLead fields to promoted pipeline Lead.
 * Conservative: does not overwrite advanced pipeline fields.
 */

export type IntakeLeadLike = {
  title?: string | null;
  company?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  summary?: string | null;
  nextAction?: string | null;
  nextActionDueAt?: Date | string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
};

export type LeadLike = {
  id: string;
  title?: string | null;
  description?: string | null;
  nextAction?: string | null;
  nextActionDueAt?: Date | string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  budget?: string | null;
  /** Lead has nextContactAt for follow-up; we map nextActionDueAt */
  nextContactAt?: Date | null;
  /** Advanced: proposal/build shipped — avoid overwriting */
  proposalSentAt?: Date | null;
  buildStartedAt?: Date | null;
  buildCompletedAt?: Date | null;
};

const TRIM = (s: unknown) => (typeof s === "string" ? s.trim() : "");
const parseDate = (d: unknown): Date | null => {
  if (!d) return null;
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d;
  if (typeof d === "string") {
    const x = new Date(d.trim());
    return Number.isNaN(x.getTime()) ? null : x;
  }
  return null;
};

/**
 * Compute safe updates to apply from intake -> pipeline lead.
 * Does not overwrite if pipeline lead is "advanced" (proposal sent or build started).
 */
export function computePipelineSyncUpdates(
  intake: IntakeLeadLike,
  lead: LeadLike
): { updates: Record<string, unknown>; changedFields: string[] } {
  const updates: Record<string, unknown> = {};
  const changedFields: string[] = [];

  const isAdvanced =
    !!lead.proposalSentAt ||
    !!lead.buildStartedAt ||
    !!lead.buildCompletedAt;

  const intakeTitle = TRIM(intake.title);
  if (intakeTitle && lead.title !== intakeTitle && !isAdvanced) {
    updates.title = intakeTitle;
    changedFields.push("title");
  }

  // Lead model has no company field; skip

  const intakeContactName = TRIM(intake.contactName);
  if (intakeContactName !== lead.contactName && !isAdvanced) {
    updates.contactName = intakeContactName || undefined;
    changedFields.push("contactName");
  }

  const intakeContactEmail = TRIM(intake.contactEmail);
  if (intakeContactEmail !== lead.contactEmail && !isAdvanced) {
    updates.contactEmail = intakeContactEmail || undefined;
    changedFields.push("contactEmail");
  }

  const intakeSummary = TRIM(intake.summary);
  if (intakeSummary && lead.description !== intakeSummary && !isAdvanced) {
    updates.description = intakeSummary;
    changedFields.push("description");
  }

  const intakeNextAction = TRIM(intake.nextAction);
  if (intakeNextAction !== lead.nextAction) {
    updates.nextAction = intakeNextAction || undefined;
    changedFields.push("nextAction");
  }

  const intakeNextDue = parseDate(intake.nextActionDueAt);
  const leadNextDue = (lead.nextActionDueAt ?? lead.nextContactAt)
    ? parseDate(lead.nextActionDueAt ?? lead.nextContactAt)
    : null;
  const intakeDueIso = intakeNextDue?.toISOString() ?? null;
  const leadDueIso = leadNextDue?.toISOString() ?? null;
  if (intakeDueIso !== leadDueIso) {
    const due = intakeNextDue ?? undefined;
    updates.nextActionDueAt = due;
    updates.nextContactAt = due;
    changedFields.push("nextActionDueAt");
  }

  const budgetStr =
    intake.budgetMin != null || intake.budgetMax != null
      ? [intake.budgetMin, intake.budgetMax].filter((x) => x != null).join("–")
      : null;
  if (budgetStr !== (lead.budget ?? null) && !isAdvanced) {
    updates.budget = budgetStr ?? undefined;
    changedFields.push("budget");
  }

  return { updates, changedFields };
}
