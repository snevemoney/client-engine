import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { NextActionPriority, NextActionStatus } from "@prisma/client";
import { normalizePagination } from "@/lib/ui/pagination-safe";
import { NextActionsClient } from "./NextActionsClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function NextActionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const entityType = "command_center";
  const entityId = "command_center";
  const now = new Date();

  const where = {
    entityType,
    entityId,
    status: NextActionStatus.queued,
    OR: [
      { snoozedUntil: null },
      { snoozedUntil: { lte: now } },
    ],
  };

  const [items, total, byPriority, lastRun, prefRows] = await Promise.all([
    db.nextBestAction.findMany({
      where,
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: PAGE_SIZE,
    }),
    db.nextBestAction.count({ where }),
    db.nextBestAction.groupBy({
      by: ["priority"],
      where: { entityType, entityId, status: NextActionStatus.queued },
      _count: { id: true },
    }),
    db.nextActionRun.findFirst({
      where: { runKey: { contains: `:${entityType}:${entityId}:` } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.nextActionPreference.findMany({
      where: {
        entityType,
        entityId,
        status: "active",
        OR: [{ suppressedUntil: null }, { suppressedUntil: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const g of byPriority) {
    counts[g.priority] = g._count.id;
  }

  const serializedItems = items.map((a) => ({
    id: a.id,
    title: a.title,
    reason: a.reason,
    priority: a.priority,
    score: a.score,
    status: a.status,
    sourceType: a.sourceType,
    sourceId: a.sourceId,
    actionUrl: a.actionUrl,
    createdByRule: a.createdByRule,
    explanationJson: a.explanationJson as Record<string, unknown> | null,
    createdAt: a.createdAt.toISOString(),
  }));

  const summary = {
    top5: serializedItems.slice(0, 5).map((a) => ({
      id: a.id,
      title: a.title,
      reason: a.reason,
      priority: a.priority,
      score: a.score,
      actionUrl: a.actionUrl,
      sourceType: a.sourceType,
    })),
    queuedByPriority: {
      low: counts[NextActionPriority.low] ?? 0,
      medium: counts[NextActionPriority.medium] ?? 0,
      high: counts[NextActionPriority.high] ?? 0,
      critical: counts[NextActionPriority.critical] ?? 0,
    },
    lastRunAt: lastRun?.createdAt?.toISOString() ?? null,
  };

  const serializedPrefs = prefRows.map((r) => ({
    id: r.id,
    ruleKey: r.ruleKey,
    dedupeKey: r.dedupeKey,
    suppressedUntil: r.suppressedUntil?.toISOString() ?? null,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <NextActionsClient
      initialData={{
        items: serializedItems,
        summary,
        preferences: serializedPrefs,
        pagination: normalizePagination(
          { page: 1, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
          serializedItems.length,
        ),
      }}
    />
  );
}
