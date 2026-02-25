/**
 * GET /api/jobs — List jobs with filters and pagination.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import {
  parsePaginationParams,
  buildPaginationMeta,
  paginatedResponse,
} from "@/lib/pagination";
import { JobRunStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUSES = ["queued", "running", "succeeded", "failed", "canceled", "dead_letter"] as const;

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/jobs", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const jobType = url.searchParams.get("jobType");
    const search = url.searchParams.get("search")?.trim();

    const pagination = parsePaginationParams(url.searchParams);

    const where: Record<string, unknown> = {};
    if (status && STATUSES.includes(status as (typeof STATUSES)[number])) {
      where.status = status as JobRunStatus;
    }
    if (jobType) where.jobType = jobType;
    if (search) {
      where.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { sourceId: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      db.jobRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.pageSize,
        select: {
          id: true,
          jobType: true,
          status: true,
          priority: true,
          attempts: true,
          maxAttempts: true,
          sourceType: true,
          sourceId: true,
          runAfter: true,
          startedAt: true,
          finishedAt: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      db.jobRun.count({ where }),
    ]);

    const meta = buildPaginationMeta(total, pagination);

    return NextResponse.json(
      paginatedResponse(
        items.map((j) => ({
          id: j.id,
          jobType: j.jobType,
          status: j.status,
          priority: j.priority,
          attempts: j.attempts,
          maxAttempts: j.maxAttempts,
          sourceType: j.sourceType,
          sourceId: j.sourceId,
          runAfter: j.runAfter?.toISOString() ?? null,
          startedAt: j.startedAt?.toISOString() ?? null,
          finishedAt: j.finishedAt?.toISOString() ?? null,
          errorMessage: j.errorMessage ? j.errorMessage.slice(0, 200) : null,
          createdAt: j.createdAt.toISOString(),
        })),
        meta
      )
    );
  });
}
