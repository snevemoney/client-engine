/**
 * Process due cadences: find overdue, send operator alert, mark completed.
 * Called by cron (POST /api/cadence/process).
 */

import { db } from "@/lib/db";
import { sendOperatorAlert, getAppUrl } from "@/lib/notify";

const TRIGGER_LABELS: Record<string, string> = {
  scope_sent: "Scope follow-up",
  deployed: "Invoice reminder",
  invoiced: "Payment check",
  paid: "Record outcome",
};

async function resolveDisplayTitle(
  sourceType: string,
  sourceId: string
): Promise<string> {
  if (sourceType === "lead") {
    const lead = await db.lead.findUnique({
      where: { id: sourceId },
      select: { title: true },
    });
    return lead?.title ?? "Unknown lead";
  }
  if (sourceType === "delivery_project") {
    const dp = await db.deliveryProject.findUnique({
      where: { id: sourceId },
      select: { title: true },
    });
    return dp?.title ?? "Unknown project";
  }
  if (sourceType === "project") {
    const proj = await db.project.findUnique({
      where: { id: sourceId },
      select: { name: true },
    });
    return proj?.name ?? "Unknown project";
  }
  return "Unknown";
}

function getLink(sourceType: string, sourceId: string, trigger?: string): string {
  const appUrl = getAppUrl();
  if (sourceType === "lead") return `${appUrl}/dashboard/leads/${sourceId}`;
  if (sourceType === "delivery_project") return `${appUrl}/dashboard/delivery/${sourceId}`;
  if (sourceType === "project") {
    if (trigger === "paid") return `${appUrl}/dashboard/deploys?highlight=${sourceId}`;
    return `${appUrl}/dashboard/deploys`;
  }
  return appUrl;
}

export type ProcessResult = {
  processed: number;
  errors: string[];
};

/**
 * Find cadences due (dueAt <= now, not completed, not snoozed), send alert, mark completed.
 */
export async function processDueCadences(limit = 50): Promise<ProcessResult> {
  const now = new Date();
  const due = await db.cadence.findMany({
    where: {
      dueAt: { lte: now },
      completedAt: null,
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
    },
    orderBy: { dueAt: "asc" },
    take: limit,
  });

  const errors: string[] = [];
  let processed = 0;

  for (const c of due) {
    try {
      const displayTitle = await resolveDisplayTitle(c.sourceType, c.sourceId);
      const label = TRIGGER_LABELS[c.trigger] ?? c.trigger;
      const link = getLink(c.sourceType, c.sourceId, c.trigger);
      const body = [
        `${label} due.`,
        ``,
        `${c.sourceType}: ${displayTitle}`,
        ``,
        link,
      ].join("\n");
      sendOperatorAlert({
        subject: `[Client Engine] Cadence: ${label} — ${displayTitle.slice(0, 40)}${displayTitle.length > 40 ? "…" : ""}`,
        body,
        webhookContext: {
          event: "cadence_due",
          message: `${label}: ${displayTitle}`,
          leadId: c.sourceType === "lead" ? c.sourceId : undefined,
          leadTitle: displayTitle,
        },
      });
      await db.cadence.update({
        where: { id: c.id },
        data: { completedAt: now },
      });
      processed++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Failed: ${c.id}: ${msg}`);
    }
  }

  return { processed, errors };
}
