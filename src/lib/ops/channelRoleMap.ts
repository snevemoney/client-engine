/**
 * Channel Role Map: strategy roles per channel and weekly imbalance critique.
 * See docs/CHANNEL_ROLE_MAP.md. Surfaces warnings when activity is imbalanced.
 */

import { db } from "@/lib/db";

export type ChannelRoleWarning = {
  code: string;
  message: string;
  severity: "info" | "warning";
};

/** Roles each channel is meant to play (for critique logic). */
const CHANNEL_ROLES: Record<string, { reach: boolean; authority: boolean; trust: boolean; ownedCapture: boolean; conversion: boolean }> = {
  LINKEDIN: { reach: true, authority: true, trust: false, ownedCapture: false, conversion: true },
  YOUTUBE: { reach: true, authority: true, trust: false, ownedCapture: false, conversion: false },
  TIKTOK: { reach: true, authority: false, trust: false, ownedCapture: false, conversion: false },
  INSTAGRAM: { reach: true, authority: false, trust: false, ownedCapture: false, conversion: false },
  X: { reach: true, authority: true, trust: false, ownedCapture: false, conversion: true },
  THREADS: { reach: true, authority: false, trust: false, ownedCapture: false, conversion: false },
  NETWORKING_EVENT: { reach: false, authority: true, trust: true, ownedCapture: true, conversion: true },
  REFERRAL: { reach: false, authority: true, trust: true, ownedCapture: false, conversion: true },
  REFERRAL_INTRO: { reach: false, authority: true, trust: true, ownedCapture: false, conversion: true },
  NEWSLETTER: { reach: false, authority: true, trust: true, ownedCapture: true, conversion: true },
  OTHER: { reach: false, authority: false, trust: false, ownedCapture: false, conversion: false },
};

const normalize = (s: string | null) =>
  (s ?? "").toUpperCase().replace(/-/g, "_").replace(/\s+/g, "_") || "OTHER";

export type ChannelRoleCritique = {
  at: string;
  warnings: ChannelRoleWarning[];
  summary: string | null;
};

/**
 * Returns weekly critique warnings for channel activity imbalance.
 * Heuristics: only reach channels active → "only reach, no authority";
 * no newsletter/owned ledger entries → "no owned audience capture";
 * no proposals sent → "no conversion support".
 */
export async function getChannelRoleCritique(): Promise<ChannelRoleCritique> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [leadsThisWeek, proposalCount, ownedLedgerRecent] = await Promise.all([
    db.lead.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: { leadSourceChannel: true },
    }),
    db.lead.count({ where: { proposalSentAt: { not: null }, updatedAt: { gte: weekAgo } } }),
    db.ownedAudienceLedger.findFirst({
      where: { at: { gte: weekAgo } },
      orderBy: { at: "desc" },
    }),
  ]);

  const warnings: ChannelRoleWarning[] = [];
  const channelsActive = new Set(leadsThisWeek.map((l) => normalize(l.leadSourceChannel)).filter(Boolean));

  const reachOnlyChannels = new Set(["LINKEDIN", "YOUTUBE", "TIKTOK", "INSTAGRAM", "X", "THREADS"]);
  const authorityChannels = new Set(["LINKEDIN", "YOUTUBE", "X", "NETWORKING_EVENT", "REFERRAL", "REFERRAL_INTRO", "NEWSLETTER"]);
  const hasReachOnly = [...channelsActive].some((c) => reachOnlyChannels.has(c));
  const hasAuthority = [...channelsActive].some((c) => authorityChannels.has(c));
  if (hasReachOnly && !hasAuthority) {
    warnings.push({
      code: "ONLY_REACH_NO_AUTHORITY",
      message: "Activity is mostly reach channels (LinkedIn, YouTube, etc.) with little authority/conversion (newsletter, referral, networking).",
      severity: "warning",
    });
  }

  if (!ownedLedgerRecent && channelsActive.size > 0) {
    warnings.push({
      code: "NO_OWNED_AUDIENCE_CAPTURE",
      message: "No owned audience (newsletter/ledger) entry this week. Consider logging subscribers/sends to capture audience.",
      severity: "warning",
    });
  }

  if (proposalCount === 0 && leadsThisWeek.length >= 2) {
    warnings.push({
      code: "NO_CONVERSION_SUPPORT",
      message: "New leads this week but no proposals sent. Ensure activity supports conversion (next step, proposal).",
      severity: "info",
    });
  }

  const summary =
    warnings.length === 0
      ? "Channel mix looks balanced this week."
      : warnings.length === 1
        ? warnings[0].message
        : `${warnings.length} channel-balance warnings this week.`;

  return {
    at: now.toISOString(),
    warnings,
    summary,
  };
}
