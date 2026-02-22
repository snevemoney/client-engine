/**
 * Prospecting source metrics: leads/won/cash by channel (leadSourceChannel).
 * Powers the Prospecting Sources Command Center card.
 */

import { db } from "@/lib/db";
import type { ProspectingSourceMetrics, ProspectingSourceRow } from "./types";

const CHANNELS = [
  "LINKEDIN",
  "YOUTUBE",
  "TIKTOK",
  "INSTAGRAM",
  "X",
  "TWITTER",
  "THREADS",
  "NETWORKING_EVENT",
  "REFERRAL",
  "NEWSLETTER",
  "EMAIL_OUTREACH",
  "DIRECT_MESSAGE",
  "WEBSITE_INBOUND",
  "OTHER",
] as const;

const CHANNEL_LABELS: Record<string, string> = {
  LINKEDIN: "LinkedIn",
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  X: "X",
  TWITTER: "X",
  THREADS: "Threads",
  NETWORKING_EVENT: "Networking Event",
  REFERRAL: "Referral",
  REFERRAL_INTRO: "Referral",
  NEWSLETTER: "Newsletter",
  EMAIL_OUTREACH: "Email outreach",
  DIRECT_MESSAGE: "DM",
  WEBSITE_INBOUND: "Inbound/site",
  OTHER: "Other",
};

function parseBudget(budget: string | null): number {
  if (!budget) return 0;
  const n = parseFloat(budget.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

export async function getProspectingSourceMetrics(): Promise<ProspectingSourceMetrics> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const leads = await db.lead.findMany({
    where: { createdAt: { gte: monthStart, lte: monthEnd } },
    select: {
      id: true,
      leadSourceChannel: true,
      score: true,
      dealOutcome: true,
      budget: true,
      proposalSentAt: true,
    },
  });

  const QUALIFIED_SCORE = 6;
  const normalize = (s: string | null) =>
    (s ?? "")
      .toUpperCase()
      .replace(/-/g, "_")
      .replace(/\s+/g, "_") || "OTHER";
  const channelMatch = (leadChannel: string | null, ch: string) => {
    const n = normalize(leadChannel);
    if (n === ch) return true;
    if (ch === "REFERRAL" && n === "REFERRAL_INTRO") return true;
    return false;
  };
  const rows: ProspectingSourceRow[] = CHANNELS.map((ch) => {
    const channelLeads = leads.filter((l) => channelMatch(l.leadSourceChannel, ch));
    const newLeads = channelLeads.length;
    const qualified = channelLeads.filter((l) => (l.score ?? 0) >= QUALIFIED_SCORE).length;
    const proposals = channelLeads.filter((l) => l.proposalSentAt != null).length;
    const won = channelLeads.filter((l) => l.dealOutcome === "won").length;
    const cashCollected = channelLeads
      .filter((l) => l.dealOutcome === "won")
      .reduce((s, l) => s + parseBudget(l.budget), 0);
    const conversionPct = newLeads > 0 ? Math.round((won / newLeads) * 1000) / 10 : null;
    return {
      channel: CHANNEL_LABELS[ch] ?? ch,
      newLeads,
      qualified,
      proposals,
      won,
      cashCollected,
      conversionPct,
    };
  }).filter((r) => r.newLeads > 0 || r.won > 0);

  const withLeads = rows.filter((r) => r.newLeads > 0);
  const best = withLeads.length > 0
    ? withLeads.reduce((a, b) => (b.won > a.won || (b.won === a.won && b.cashCollected > a.cashCollected) ? b : a))
    : null;
  const bestSourceThisMonth = best ? best.channel : null;

  const weak = rows.find((r) => r.newLeads >= 3 && r.won === 0);
  const weakSourceWarning = weak ? `${weak.channel}: ${weak.newLeads} leads, 0 wins` : null;

  const totalRevenue = rows.reduce((s, r) => s + r.cashCollected, 0);
  const channelRoiSummary =
    best && totalRevenue > 0
      ? `Best ROI: ${best.channel} (${best.won} won, $${totalRevenue.toLocaleString()} revenue)`
      : best
        ? `Top channel: ${best.channel} (${best.won} won)`
        : null;

  return {
    at: now.toISOString(),
    bestSourceThisMonth,
    weakSourceWarning,
    channelRoiSummary,
    rows,
  };
}
