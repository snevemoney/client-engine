import { db } from "@/lib/db";

const SYSTEM_SOURCE = "system";
const PROOF_CHECKLIST_LEAD_TITLE = "Proof & Checklist Engine";

export async function getOrCreateProofChecklistSystemLead(): Promise<string> {
  const existing = await db.lead.findFirst({
    where: { source: SYSTEM_SOURCE, title: PROOF_CHECKLIST_LEAD_TITLE },
    select: { id: true },
  });
  if (existing) return existing.id;
  const lead = await db.lead.create({
    data: { title: PROOF_CHECKLIST_LEAD_TITLE, source: SYSTEM_SOURCE },
  });
  return lead.id;
}
