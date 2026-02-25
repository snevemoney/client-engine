/**
 * GET /api/automation-suggestions — List suggestions with filters.
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { parsePaginationParams, buildPaginationMeta, paginatedResponse } from "@/lib/pagination";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withRouteTiming("GET /api/automation-suggestions", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get("status");
      const priority = searchParams.get("priority");
      const type = searchParams.get("type");
      const sourceType = searchParams.get("sourceType");
      const search = searchParams.get("search")?.trim();
      const pagination = parsePaginationParams(searchParams);

      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (type) where.type = type;
      if (sourceType) where.sourceType = sourceType;
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { reason: { contains: search, mode: "insensitive" } },
        ];
      }

      const [suggestions, total] = await Promise.all([
        db.automationSuggestion.findMany({
          where,
          orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
          skip: pagination.skip,
          take: pagination.pageSize,
        }),
        db.automationSuggestion.count({ where }),
      ]);

      const mapped = suggestions.map((s) => ({
          id: s.id,
          type: s.type,
          title: s.title,
          reason: s.reason,
          status: s.status,
          priority: s.priority,
          sourceType: s.sourceType,
          sourceId: s.sourceId,
          payloadJson: s.payloadJson,
          actionUrl: s.actionUrl,
          createdAt: s.createdAt.toISOString(),
          resolvedAt: s.resolvedAt?.toISOString() ?? null,
        }));
      const meta = buildPaginationMeta(total, pagination);
      return NextResponse.json({
        ...paginatedResponse(mapped, meta),
        suggestions: mapped,
      });
    } catch (err) {
      console.error("[automation-suggestions GET]", err);
      return jsonError("Failed to load suggestions", 500);
    }
  });
}
