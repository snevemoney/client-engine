/**
 * Operator feedback notes: persist as OPERATOR_FEEDBACK_NOTE artifact on system lead.
 */

import { db } from "@/lib/db";
import { getOrCreateSystemLead } from "./systemLead";

const ARTIFACT_TYPE = "operator_feedback";
const ARTIFACT_TITLE = "OPERATOR_FEEDBACK_NOTE";

export async function addOperatorFeedbackNote(
  content: string,
  meta?: { tags?: string[] }
): Promise<string> {
  const systemLeadId = await getOrCreateSystemLead();
  const artifact = await db.artifact.create({
    data: {
      leadId: systemLeadId,
      type: ARTIFACT_TYPE,
      title: ARTIFACT_TITLE,
      content: content.slice(0, 10000),
      meta: meta ? { tags: meta.tags ?? [] } : undefined,
    },
  });
  return artifact.id;
}

export async function getRecentOperatorFeedbackNotes(limit = 10): Promise<
  { id: string; content: string; createdAt: Date; meta: unknown }[]
> {
  const systemLead = await db.lead.findFirst({
    where: { source: "system", title: "Research Engine Runs" },
    select: { id: true },
  });
  if (!systemLead) return [];

  const artifacts = await db.artifact.findMany({
    where: { leadId: systemLead.id, type: ARTIFACT_TYPE, title: ARTIFACT_TITLE },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, content: true, createdAt: true, meta: true },
  });
  return artifacts;
}
