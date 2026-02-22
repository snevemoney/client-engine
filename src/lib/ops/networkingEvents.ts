/**
 * Networking event quality score and list for Command Center.
 */

import { db } from "@/lib/db";

export type NetworkingEventWithScore = {
  id: string;
  name: string;
  eventDate: string;
  audienceType: string | null;
  relevanceScore: number | null;
  contactsMade: number;
  followUpsSent: number;
  opportunitiesCreated: number;
  revenue: number | null;
  notes: string | null;
  qualityScore: number;
  createdAt: string;
};

/** Simple quality score 0–100: relevance + contacts + follow-ups + opportunities + revenue. */
function computeQualityScore(e: {
  relevanceScore: number | null;
  contactsMade: number;
  followUpsSent: number;
  opportunitiesCreated: number;
  revenue: number | null;
}): number {
  let s = 0;
  if (e.relevanceScore != null) s += Math.min(30, e.relevanceScore * 3);
  s += Math.min(25, e.contactsMade * 5);
  s += Math.min(20, e.followUpsSent * 4);
  s += Math.min(20, e.opportunitiesCreated * 5);
  if (e.revenue != null && e.revenue > 0) s += 5;
  return Math.min(100, Math.round(s));
}

export async function getNetworkingEventsWithScores(limit = 10): Promise<NetworkingEventWithScore[]> {
  const events = await db.networkingEvent.findMany({
    orderBy: { eventDate: "desc" },
    take: limit,
  });
  return events.map((e) => ({
    id: e.id,
    name: e.name,
    eventDate: e.eventDate.toISOString(),
    audienceType: e.audienceType,
    relevanceScore: e.relevanceScore,
    contactsMade: e.contactsMade,
    followUpsSent: e.followUpsSent,
    opportunitiesCreated: e.opportunitiesCreated,
    revenue: e.revenue,
    notes: e.notes,
    qualityScore: computeQualityScore(e),
    createdAt: e.createdAt.toISOString(),
  }));
}
