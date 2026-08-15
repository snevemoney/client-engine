/**
 * Phase 2: Risk service — summary, list, runRules.
 * Extracted from /api/risk routes for use by coach-tools and routes.
 */

import { db } from "@/lib/db";
import { RiskSeverity, RiskStatus, RiskSourceType } from "@prisma/client";
import { fetchRiskRuleContext } from "@/lib/risk/fetch-context";
import { evaluateRiskRules } from "@/lib/risk/rules";
import { upsertRiskFlags } from "@/lib/risk/service";

export type RiskSummary = {
  openBySeverity: { low: number; medium: number; high: number; critical: number };
  snoozedCount: number;
  lastRunAt: string | null;
};

export async function getSummary(): Promise<RiskSummary> {
  const [openBySeverity, snoozedCount, lastRun] = await Promise.all([
    db.riskFlag.groupBy({
      by: ["severity"],
      where: { status: RiskStatus.open },
      _count: { id: true },
    }),
    db.riskFlag.count({ where: { status: RiskStatus.snoozed } }),
    db.riskFlag.findFirst({
      where: {},
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  const bySeverity: Record<string, number> = {};
  for (const g of openBySeverity) {
    bySeverity[g.severity] = g._count.id;
  }

  return {
    openBySeverity: {
      low: bySeverity.low ?? 0,
      medium: bySeverity.medium ?? 0,
      high: bySeverity.high ?? 0,
      critical: bySeverity.critical ?? 0,
    },
    snoozedCount: snoozedCount ?? 0,
    lastRunAt: lastRun?.updatedAt?.toISOString() ?? null,
  };
}

export type RiskListOptions = {
  status?: RiskStatus;
  severity?: RiskSeverity;
  sourceType?: RiskSourceType;
  search?: string;
  skip?: number;
  take?: number;
};

export type RiskItem = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  sourceType: string;
  sourceId: string | null;
  actionUrl: string | null;
  suggestedFix: string | null;
  evidenceJson: unknown;
  createdByRule: string | null;
  lastSeenAt: string;
  createdAt: string;
  snoozedUntil: string | null;
};

const VALID_STATUS = ["open", "snoozed", "resolved", "dismissed"];
const VALID_SEVERITY = ["low", "medium", "high", "critical"];
const VALID_SOURCE: string[] = Object.values(RiskSourceType);

export async function list(options: RiskListOptions): Promise<{ items: RiskItem[]; total: number }> {
  const where: Record<string, unknown> = {};
  if (options.status && VALID_STATUS.includes(options.status)) {
    where.status = options.status;
  }
  if (options.severity && VALID_SEVERITY.includes(options.severity)) {
    where.severity = options.severity;
  }
  if (options.sourceType && VALID_SOURCE.includes(options.sourceType)) {
    where.sourceType = options.sourceType;
  }
  if (options.search?.trim()) {
    where.OR = [
      { title: { contains: options.search, mode: "insensitive" } },
      { description: { contains: options.search, mode: "insensitive" } },
      { key: { contains: options.search, mode: "insensitive" } },
    ];
  }

  const skip = options.skip ?? 0;
  const take = options.take ?? 25;

  const [items, total] = await Promise.all([
    db.riskFlag.findMany({
      where,
      orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
      skip,
      take,
    }),
    db.riskFlag.count({ where }),
  ]);

  return {
    items: items.map((r) => ({
      id: r.id,
      key: r.key,
      title: r.title,
      description: r.description,
      severity: r.severity,
      status: r.status,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      actionUrl: r.actionUrl,
      suggestedFix: r.suggestedFix,
      evidenceJson: r.evidenceJson,
      createdByRule: r.createdByRule,
      lastSeenAt: r.lastSeenAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      snoozedUntil: r.snoozedUntil?.toISOString() ?? null,
    })),
    total,
  };
}

export type RunRiskRulesResult = {
  created: number;
  updated: number;
  criticalNotified: number;
  lastRunAt: string;
};

export async function runRules(ownerUserId?: string): Promise<RunRiskRulesResult> {
  const ctx = await fetchRiskRuleContext({ ownerUserId });
  const candidates = evaluateRiskRules(ctx);
  const result = await upsertRiskFlags(candidates);
  return {
    created: result.created,
    updated: result.updated,
    criticalNotified: result.criticalNotified,
    lastRunAt: new Date().toISOString(),
  };
}
