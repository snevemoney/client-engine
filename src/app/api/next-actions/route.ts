/**
 * GET /api/next-actions — List next actions with filters. Paginated.
 * Phase 4.1: Supports entityType, entityId scope filter. Phase 2: Uses nba-service.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { NextActionPriority, NextActionStatus, RiskSourceType } from "@prisma/client";
import { parsePaginationParams, buildPaginationMeta, paginatedResponse } from "@/lib/pagination";
import { list } from "@/lib/services/nba-service";

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
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const pagination = parsePaginationParams(searchParams);

    const { items, total } = await list({
      entityType,
      entityId,
      status: status && VALID_STATUS.includes(status) ? (status as NextActionStatus) : undefined,
      priority: priority && VALID_PRIORITY.includes(priority) ? (priority as NextActionPriority) : undefined,
      sourceType: sourceType && VALID_SOURCE.includes(sourceType) ? (sourceType as RiskSourceType) : undefined,
      search: search ?? undefined,
      skip: pagination.skip,
      take: pagination.pageSize,
    });

    const meta = buildPaginationMeta(total, pagination);
    return NextResponse.json(paginatedResponse(items, meta));
  });
}
