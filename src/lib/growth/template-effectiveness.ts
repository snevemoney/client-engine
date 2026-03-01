/**
 * Growth template effectiveness — aggregates reply rates from OutreachMessage data.
 * Deterministic: no AI calls, pure DB aggregation.
 */
import { db } from "@/lib/db";

export type TemplateStats = {
  templateKey: string;
  label: string;
  sent: number;
  replied: number;
  replyRate: number; // 0-100
  bounced: number;
};

const TEMPLATE_LABELS: Record<string, string> = {
  broken_link_fix: "Broken Link Fix",
  google_form_upgrade: "Google Form Upgrade",
  linktree_cleanup: "Linktree Cleanup",
  big_audience_no_site: "Big Audience, No Site",
  canva_site_upgrade: "Canva Site Upgrade",
  calendly_blank_fix: "Calendly Blank Fix",
};

export async function getTemplateEffectiveness(): Promise<TemplateStats[]> {
  const messages = await db.outreachMessage.groupBy({
    by: ["templateKey", "status"],
    _count: { id: true },
  });

  // Aggregate by templateKey
  const byTemplate: Record<string, { sent: number; replied: number; bounced: number }> = {};
  for (const row of messages) {
    const entry = byTemplate[row.templateKey] ?? (byTemplate[row.templateKey] = { sent: 0, replied: 0, bounced: 0 });
    if (row.status === "sent" || row.status === "replied" || row.status === "bounced" || row.status === "ignored") {
      entry.sent += row._count.id;
    }
    if (row.status === "replied") entry.replied += row._count.id;
    if (row.status === "bounced") entry.bounced += row._count.id;
  }

  return Object.entries(byTemplate)
    .map(([templateKey, stats]) => ({
      templateKey,
      label: TEMPLATE_LABELS[templateKey] ?? templateKey,
      sent: stats.sent,
      replied: stats.replied,
      replyRate: stats.sent > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0,
      bounced: stats.bounced,
    }))
    .sort((a, b) => b.replyRate - a.replyRate);
}

/** Aggregate reply rate across all templates (for sales leak dashboard). */
export async function getOverallReplyRate(): Promise<{ sent: number; replied: number; replyRatePct: number | null }> {
  const [sent, replied] = await Promise.all([
    db.outreachMessage.count({ where: { status: { in: ["sent", "replied", "bounced", "ignored"] } } }),
    db.outreachMessage.count({ where: { status: "replied" } }),
  ]);
  return {
    sent,
    replied,
    replyRatePct: sent > 0 ? Math.round((replied / sent) * 100) : null,
  };
}
