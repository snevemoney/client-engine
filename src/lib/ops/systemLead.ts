import { db } from "@/lib/db";

const SYSTEM_LEAD_SOURCE = "system";
const SYSTEM_LEAD_TITLE = "Research Engine Runs";

/** Get or create the single system lead used for operational artifacts (run reports, briefings, feedback). */
export async function getOrCreateSystemLead(): Promise<string> {
  const existing = await db.lead.findFirst({
    where: { source: SYSTEM_LEAD_SOURCE, title: SYSTEM_LEAD_TITLE },
    select: { id: true },
  });
  if (existing) return existing.id;
  const lead = await db.lead.create({
    data: { title: SYSTEM_LEAD_TITLE, source: SYSTEM_LEAD_SOURCE },
  });
  return lead.id;
}
