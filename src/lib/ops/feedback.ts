/**
 * Operator feedback notes: persist as OPERATOR_FEEDBACK_NOTE artifact on system lead.
 */

import { db } from "@/lib/db";
import { getCachedSystemLead } from "./cached";

const ARTIFACT_TYPE = "operator_feedback";
const ARTIFACT_TITLE = "OPERATOR_FEEDBACK_NOTE";

export async function addOperatorFeedbackNote(
  content: string,
  meta?: { tags?: string[] }
): Promise<string> {
  const systemLeadId = await getCachedSystemLead();
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
  const systemLeadId = await getCachedSystemLead();
  if (!systemLeadId) return [];

  const artifacts = await db.artifact.findMany({
    where: { leadId: systemLeadId, type: ARTIFACT_TYPE, title: ARTIFACT_TITLE },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, content: true, createdAt: true, meta: true },
  });
  return artifacts;
}
