/**
 * GET /api/next-actions — List next actions with filters. Paginated.
 * Phase 4.1: Supports entityType, entityId scope filter.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { NextActionPriority, NextActionStatus, RiskSourceType } from "@prisma/client";
import { parsePaginationParams, buildPaginationMeta, paginatedResponse } from "@/lib/pagination";
import { parseScope } from "@/lib/next-actions/scope";

export const dynamic = "force-dynamic";

const VALID_STATUS = ["queued", "done", "dismissed"];
const VALID_PRIORITY = ["low", "medium", "high", "critical"];
const VALID_SOURCE: string[] = Object.values(RiskSourceType);

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/next-actions", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const sourceType = searchParams.get("sourceType");
    const search = searchParams.get("search")?.trim();
    const { entityType, entityId } = parseScope(searchParams.get("entityType"), searchParams.get("entityId"));
    const pagination = parsePaginationParams(searchParams);

    const now = new Date();
    const where: Record<string, unknown> = {
      entityType,
      entityId,
    };
    if (status && VALID_STATUS.includes(status)) {
      where.status = status as NextActionStatus;
    }
    // Phase 4.2: Hide snoozed items (snoozedUntil > now) when showing queued/active
    if (!status || status === "queued") {
      where.OR = [
        { snoozedUntil: null },
        { snoozedUntil: { lte: now } },
      ];
    }
    if (priority && VALID_PRIORITY.includes(priority)) {
      where.priority = priority as NextActionPriority;
    }
    if (sourceType && VALID_SOURCE.includes(sourceType)) {
      where.sourceType = sourceType as RiskSourceType;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { reason: { contains: search, mode: "insensitive" } },
        { createdByRule: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      db.nextBestAction.findMany({
        where,
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      db.nextBestAction.count({ where }),
    ]);

    const meta = buildPaginationMeta(total, pagination);

    return NextResponse.json(
      paginatedResponse(
        items.map((a) => ({
          id: a.id,
          title: a.title,
          reason: a.reason,
          priority: a.priority,
          score: a.score,
          status: a.status,
          sourceType: a.sourceType,
          sourceId: a.sourceId,
          actionUrl: a.actionUrl,
          payloadJson: a.payloadJson,
          explanationJson: a.explanationJson,
          createdByRule: a.createdByRule,
          dedupeKey: a.dedupeKey,
          templateKey: a.templateKey ?? null,
          entityType: a.entityType,
          entityId: a.entityId,
          snoozedUntil: a.snoozedUntil?.toISOString() ?? null,
          lastExecutedAt: a.lastExecutedAt?.toISOString() ?? null,
          lastExecutionStatus: a.lastExecutionStatus ?? null,
          lastExecutionErrorCode: a.lastExecutionErrorCode ?? null,
          createdAt: a.createdAt.toISOString(),
          completedAt: a.completedAt?.toISOString() ?? null,
          dismissedAt: a.dismissedAt?.toISOString() ?? null,
        })),
        meta
      )
    );
  });
}
