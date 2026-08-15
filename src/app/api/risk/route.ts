/**
 * GET /api/risk — List risk flags with filters. Paginated.
 * Phase 2: Uses risk-service.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { RiskSeverity, RiskStatus, RiskSourceType } from "@prisma/client";
import { parsePaginationParams, buildPaginationMeta, paginatedResponse } from "@/lib/pagination";
import { list } from "@/lib/services/risk-service";

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

    const { items, total } = await list({
      status: status && VALID_STATUS.includes(status) ? (status as RiskStatus) : undefined,
      severity: severity && VALID_SEVERITY.includes(severity) ? (severity as RiskSeverity) : undefined,
      sourceType: sourceType && VALID_SOURCE.includes(sourceType) ? (sourceType as RiskSourceType) : undefined,
      search: search ?? undefined,
      skip: pagination.skip,
      take: pagination.pageSize,
    });

    const meta = buildPaginationMeta(total, pagination);
    return NextResponse.json(paginatedResponse(items, meta));
  });
}
