/**
 * Owned audience (newsletter/blog) ledger: health + trend for Command Center card.
 */

import { db } from "@/lib/db";

export type OwnedAudienceHealth = {
  at: string;
  subscribers: number;
  sends: number;
  replies: number;
  clicks: number;
  inquiriesInfluenced: number;
  trend: "up" | "down" | "flat";
  previousSubscribers: number | null;
  summary: string;
};

export async function getOwnedAudienceHealth(): Promise<OwnedAudienceHealth | null> {
  const [latest, previous] = await Promise.all([
    db.ownedAudienceLedger.findFirst({
      orderBy: { at: "desc" },
    }),
    db.ownedAudienceLedger.findFirst({
      orderBy: { at: "desc" },
      skip: 1,
    }),
  ]);

  if (!latest) {
    return null;
  }

  const prevSubs = previous?.subscribers ?? null;
  const trend =
    prevSubs == null ? "flat" : latest.subscribers > prevSubs ? "up" : latest.subscribers < prevSubs ? "down" : "flat";

  const parts: string[] = [];
  if (latest.subscribers > 0) parts.push(`${latest.subscribers} subs`);
  if (latest.sends > 0) parts.push(`${latest.sends} sends`);
  if (latest.replies > 0) parts.push(`${latest.replies} replies`);
  if (latest.inquiriesInfluenced > 0) parts.push(`${latest.inquiriesInfluenced} inquiries influenced`);
  const summary = parts.length > 0 ? parts.join(", ") : "No activity logged yet.";

  return {
    at: latest.at.toISOString(),
    subscribers: latest.subscribers,
    sends: latest.sends,
    replies: latest.replies,
    clicks: latest.clicks,
    inquiriesInfluenced: latest.inquiriesInfluenced,
    trend,
    previousSubscribers: prevSubs,
    summary,
  };
}
