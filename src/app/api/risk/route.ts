/**
 * GET /api/risk — List risk flags with filters. Paginated.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { RiskSeverity, RiskStatus, RiskSourceType } from "@prisma/client";
import { parsePaginationParams, buildPaginationMeta, paginatedResponse } from "@/lib/pagination";

export const dynamic = "force-dynamic";

const VALID_STATUS = ["open", "snoozed", "resolved", "dismissed"];
const VALID_SEVERITY = ["low", "medium", "high", "critical"];
const VALID_SOURCE: string[] = Object.values(RiskSourceType);

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/risk", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const severity = searchParams.get("severity");
    const sourceType = searchParams.get("sourceType");
    const search = searchParams.get("search")?.trim();
    const pagination = parsePaginationParams(searchParams);

    const where: Record<string, unknown> = {};
    if (status && VALID_STATUS.includes(status)) {
      where.status = status as RiskStatus;
    }
    if (severity && VALID_SEVERITY.includes(severity)) {
      where.severity = severity as RiskSeverity;
    }
    if (sourceType && VALID_SOURCE.includes(sourceType)) {
      where.sourceType = sourceType as RiskSourceType;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { key: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      db.riskFlag.findMany({
        where,
        orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      db.riskFlag.count({ where }),
    ]);

    const meta = buildPaginationMeta(total, pagination);

    return NextResponse.json(
      paginatedResponse(
        items.map((r) => ({
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
        meta
      )
    );
  });
}
