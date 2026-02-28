import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { RiskStatus } from "@prisma/client";
import { normalizePagination } from "@/lib/ui/pagination-safe";
import { RiskClient } from "./RiskClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function RiskPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const where = { status: RiskStatus.open };

  const [flags, total, openBySeverityRaw, snoozedCount, lastRun] = await Promise.all([
    db.riskFlag.findMany({
      where,
      orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
      take: PAGE_SIZE,
    }),
    db.riskFlag.count({ where }),
    db.riskFlag.groupBy({
      by: ["severity"],
      where: { status: RiskStatus.open },
      _count: { id: true },
    }),
    db.riskFlag.count({ where: { status: RiskStatus.snoozed } }),
    db.riskFlag.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  const bySeverity: Record<string, number> = {};
  for (const g of openBySeverityRaw) {
    bySeverity[g.severity] = g._count.id;
  }

  const items = flags.map((r) => ({
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
    lastSeenAt: r.lastSeenAt.toISOString(),
    snoozedUntil: r.snoozedUntil?.toISOString() ?? null,
  }));

  return (
    <RiskClient
      initialData={{
        items,
        pagination: normalizePagination(
          { page: 1, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
          items.length,
        ),
        summary: {
          openBySeverity: {
            low: bySeverity.low ?? 0,
            medium: bySeverity.medium ?? 0,
            high: bySeverity.high ?? 0,
            critical: bySeverity.critical ?? 0,
          },
          snoozedCount: snoozedCount ?? 0,
          lastRunAt: lastRun?.updatedAt?.toISOString() ?? null,
        },
      }}
    />
  );
}
