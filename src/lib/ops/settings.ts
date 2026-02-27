/**
 * Operator settings stored as OPERATOR_SETTINGS artifact on system lead.
 * Env vars take precedence for research/workday; artifact holds overrides and business copy.
 */

import { db } from "@/lib/db";
import { getCachedSystemLead } from "./cached";

const ARTIFACT_TYPE = "operator_settings";
const ARTIFACT_TITLE = "OPERATOR_SETTINGS";

/** Configurable scoring profile — change niche by updating these, not code */
export type ScoringProfile = {
  idealProjects?: string;   // e.g. "web apps, dashboards, booking systems, course platforms"
  budgetRange?: string;     // e.g. "$1,000-$10,000"
  typicalTimeline?: string; // e.g. "1-4 weeks"
  techStack?: string;       // e.g. "Next.js, React, Node.js, PostgreSQL"
  prefers?: string;         // e.g. "clear scope, responsive clients, repeat potential"
  avoids?: string;          // e.g. "maintenance-only, unrealistic budgets, vague requests"
};

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
  /** Scoring profile — used by pipeline score step. Change niche = update settings */
  scoringProfile?: ScoringProfile;
  /** Cash actually collected (bank) — set in Settings; revenue won is pipeline. */
  cashCollected?: number;
  /** Graduation: target number of repeatable wins (e.g. 10) before moving to productized. */
  graduationTargetWins?: number;
  /** Next milestone text (e.g. "Productized offer readiness: 60%"). */
  graduationMilestone?: string;
};

export async function getOperatorSettings(): Promise<OperatorSettings> {
  const systemLeadId = await getCachedSystemLead();
  const artifact = await db.artifact.findFirst({
    where: { leadId: systemLeadId, type: ARTIFACT_TYPE, title: ARTIFACT_TITLE },
    orderBy: { createdAt: "desc" },
  });
  if (!artifact?.meta || typeof artifact.meta !== "object") return {};
  return artifact.meta as OperatorSettings;
}

export async function setOperatorSettings(settings: OperatorSettings): Promise<void> {
  const systemLeadId = await getCachedSystemLead();
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
