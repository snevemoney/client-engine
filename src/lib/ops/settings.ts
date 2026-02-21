/**
 * Operator settings stored as OPERATOR_SETTINGS artifact on system lead.
 * Env vars take precedence for research/workday; artifact holds overrides and business copy.
 */

import { db } from "@/lib/db";
import { getOrCreateSystemLead } from "./systemLead";

const ARTIFACT_TYPE = "operator_settings";
const ARTIFACT_TITLE = "OPERATOR_SETTINGS";

export type OperatorSettings = {
  workdayEnabled?: boolean;
  workdayIntervalMinutes?: number;
  workdayMaxLeadsPerRun?: number;
  workdayMaxRunsPerDay?: number;
  quietHoursStart?: string; // "22" for 10 PM
  quietHoursEnd?: string;   // "06" for 6 AM
  nicheStatement?: string;
  offerStatement?: string;
  buyerProfile?: string;
  promiseProblemStatement?: string;
  /** Cash actually collected (bank) — set in Settings; revenue won is pipeline. */
  cashCollected?: number;
  /** Graduation: target number of repeatable wins (e.g. 10) before moving to productized. */
  graduationTargetWins?: number;
  /** Next milestone text (e.g. "Productized offer readiness: 60%"). */
  graduationMilestone?: string;
};

export async function getOperatorSettings(): Promise<OperatorSettings> {
  const systemLeadId = await getOrCreateSystemLead();
  const artifact = await db.artifact.findFirst({
    where: { leadId: systemLeadId, type: ARTIFACT_TYPE, title: ARTIFACT_TITLE },
    orderBy: { createdAt: "desc" },
  });
  if (!artifact?.meta || typeof artifact.meta !== "object") return {};
  return artifact.meta as OperatorSettings;
}

export async function setOperatorSettings(settings: OperatorSettings): Promise<void> {
  const systemLeadId = await getOrCreateSystemLead();
  const existing = await db.artifact.findFirst({
    where: { leadId: systemLeadId, type: ARTIFACT_TYPE, title: ARTIFACT_TITLE },
  });
  const payload = JSON.stringify(settings);
  if (existing) {
    await db.artifact.update({
      where: { id: existing.id },
      data: { content: payload, meta: settings },
    });
  } else {
    await db.artifact.create({
      data: {
        leadId: systemLeadId,
        type: ARTIFACT_TYPE,
        title: ARTIFACT_TITLE,
        content: payload,
        meta: settings,
      },
    });
  }
}
