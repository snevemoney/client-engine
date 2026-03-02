/**
 * Portfolio Health Metrics — answers PBD's question:
 * "What's your revenue per hour of actual work?"
 *
 * Pure DB queries, no AI. Feeds Founder OS portfolio section.
 */

import { db } from "@/lib/db";

// ── Types ──────────────────────────────────────────────────────────────

export type ClientRoi = {
  clientName: string;
  /** Total accepted proposal value */
  revenue: number;
  currency: string;
  /** Number of delivery projects */
  projectCount: number;
  /** Estimated effort in hours (heuristic from milestones/duration) */
  estimatedHours: number;
  /** Revenue per estimated hour */
  revenuePerHour: number;
};

export type ConcentrationRisk = {
  topClientName: string;
  topClientRevenue: number;
  totalRevenue: number;
  /** Percentage of total revenue from top client (0-100) */
  concentrationPct: number;
  /** true when concentration >= 50% */
  isRisky: boolean;
};

export type PipelineVelocity = {
  /** Average days from lead creation to wonAt */
  avgDaysToWin: number;
  /** Median days to win */
  medianDaysToWin: number;
  /** Number of won leads in the dataset */
  sampleSize: number;
  /** Trend: positive = getting faster (good) */
  recentTrendDays: number | null;
};

export type PortfolioHealth = {
  /** Revenue per estimated hour across all clients */
  overallRevenuePerHour: number;
  /** Total portfolio value (accepted proposals for active/completed projects) */
  totalRevenue: number;
  currency: string;
  /** Client ROI ranking (best first) */
  clientRanking: ClientRoi[];
  /** Revenue concentration analysis */
  concentration: ConcentrationRisk;
  /** Pipeline velocity (lead → won) */
  velocity: PipelineVelocity;
  /** Active pipeline value (sent/viewed proposals) */
  activePipelineValue: number;
  /** Number of active delivery projects */
  activeProjectCount: number;
};

// ── Client ROI Ranking ────────────────────────────────────────────────

async function computeClientRanking(): Promise<ClientRoi[]> {
  // Get all delivery projects with their linked proposals
  const projects = await db.deliveryProject.findMany({
    where: { status: { notIn: ["archived"] } },
    include: {
      proposal: {
        select: { priceMin: true, priceMax: true, priceCurrency: true, acceptedAt: true },
      },
      milestones: {
        select: { status: true },
      },
    },
  });

  // Group by client (company or clientName)
  const byClient = new Map<string, {
    revenue: number;
    currency: string;
    projectCount: number;
    totalDurationDays: number;
  }>();

  for (const p of projects) {
    const name = p.company || p.clientName || "Unknown";
    const price = p.proposal?.priceMin ?? p.proposal?.priceMax ?? 0;
    const currency = p.proposal?.priceCurrency ?? "CAD";

    // Estimate duration in days
    let durationDays = 14; // default
    if (p.completedAt && p.startDate) {
      durationDays = Math.max(1, Math.ceil((p.completedAt.getTime() - p.startDate.getTime()) / 86400000));
    } else if (p.dueDate && p.startDate) {
      durationDays = Math.max(1, Math.ceil((p.dueDate.getTime() - p.startDate.getTime()) / 86400000));
    }

    const existing = byClient.get(name) ?? { revenue: 0, currency, projectCount: 0, totalDurationDays: 0 };
    existing.revenue += price;
    existing.projectCount++;
    existing.totalDurationDays += durationDays;
    byClient.set(name, existing);
  }

  // Convert to ranked list
  const ranking: ClientRoi[] = [];
  for (const [clientName, data] of byClient) {
    // Heuristic: ~4 hours of work per business day
    const estimatedHours = Math.max(1, Math.round((data.totalDurationDays / 7) * 5 * 4));
    const revenuePerHour = estimatedHours > 0 ? Math.round(data.revenue / estimatedHours) : 0;
    ranking.push({
      clientName,
      revenue: data.revenue,
      currency: data.currency,
      projectCount: data.projectCount,
      estimatedHours,
      revenuePerHour,
    });
  }

  return ranking.sort((a, b) => b.revenuePerHour - a.revenuePerHour);
}

// ── Concentration Risk ────────────────────────────────────────────────

function computeConcentration(ranking: ClientRoi[]): ConcentrationRisk {
  const totalRevenue = ranking.reduce((sum, c) => sum + c.revenue, 0);
  const top = ranking[0]; // already sorted by revenue/hour, re-sort by revenue for concentration

  const byRevenue = [...ranking].sort((a, b) => b.revenue - a.revenue);
  const topByRevenue = byRevenue[0];

  if (!topByRevenue || totalRevenue === 0) {
    return { topClientName: "N/A", topClientRevenue: 0, totalRevenue: 0, concentrationPct: 0, isRisky: false };
  }

  const pct = Math.round((topByRevenue.revenue / totalRevenue) * 100);
  return {
    topClientName: topByRevenue.clientName,
    topClientRevenue: topByRevenue.revenue,
    totalRevenue,
    concentrationPct: pct,
    isRisky: pct >= 50,
  };
}

// ── Pipeline Velocity ─────────────────────────────────────────────────

async function computePipelineVelocity(): Promise<PipelineVelocity> {
  const wonLeads = await db.lead.findMany({
    where: { dealOutcome: "won", wonAt: { not: null } },
    select: { createdAt: true, wonAt: true },
    orderBy: { wonAt: "desc" },
  });

  if (wonLeads.length === 0) {
    return { avgDaysToWin: 0, medianDaysToWin: 0, sampleSize: 0, recentTrendDays: null };
  }

  const daysToWin = wonLeads.map((l) => {
    const diff = l.wonAt!.getTime() - l.createdAt.getTime();
    return Math.max(0, Math.round(diff / 86400000));
  });

  const sorted = [...daysToWin].sort((a, b) => a - b);
  const avg = Math.round(sorted.reduce((s, d) => s + d, 0) / sorted.length);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Trend: compare last 3 vs previous 3
  let recentTrendDays: number | null = null;
  if (daysToWin.length >= 6) {
    const recent3 = daysToWin.slice(0, 3);
    const prev3 = daysToWin.slice(3, 6);
    const avgRecent = recent3.reduce((s, d) => s + d, 0) / 3;
    const avgPrev = prev3.reduce((s, d) => s + d, 0) / 3;
    recentTrendDays = Math.round(avgPrev - avgRecent); // positive = getting faster
  }

  return { avgDaysToWin: avg, medianDaysToWin: median, sampleSize: wonLeads.length, recentTrendDays };
}

// ── Main Entry Point ──────────────────────────────────────────────────

export async function computePortfolioHealth(): Promise<PortfolioHealth> {
  const [ranking, velocity, activePipeline, activeProjects] = await Promise.all([
    computeClientRanking(),
    computePipelineVelocity(),
    // Active pipeline value: proposals that are sent/viewed but not accepted/rejected
    db.proposal.findMany({
      where: {
        status: { in: ["sent", "viewed"] },
        acceptedAt: null,
        rejectedAt: null,
      },
      select: { priceMin: true, priceMax: true },
    }),
    db.deliveryProject.count({
      where: { status: { in: ["kickoff", "in_progress", "qa"] } },
    }),
  ]);

  const activePipelineValue = activePipeline.reduce(
    (sum, p) => sum + (p.priceMin ?? p.priceMax ?? 0),
    0
  );

  const concentration = computeConcentration(ranking);
  const totalRevenue = concentration.totalRevenue;
  const totalHours = ranking.reduce((s, c) => s + c.estimatedHours, 0);
  const overallRevenuePerHour = totalHours > 0 ? Math.round(totalRevenue / totalHours) : 0;

  return {
    overallRevenuePerHour,
    totalRevenue,
    currency: ranking[0]?.currency ?? "CAD",
    clientRanking: ranking,
    concentration,
    velocity,
    activePipelineValue,
    activeProjectCount: activeProjects,
  };
}
