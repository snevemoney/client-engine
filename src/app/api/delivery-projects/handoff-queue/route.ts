/**
 * GET /api/delivery-projects/handoff-queue — Projects for handoff work.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { parsePaginationParams, buildPaginationMeta, paginatedResponse } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/delivery-projects/handoff-queue", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status"); // completed_no_handoff | handoff_in_progress | handoff_completed | handoff_missing_client_confirm | all
    const search = url.searchParams.get("search") ?? url.searchParams.get("q");
    const owner = url.searchParams.get("owner");
    const pagination = parsePaginationParams(url.searchParams);

    const projects = await db.deliveryProject.findMany({
      where: {
        status: { in: ["completed", "archived"] },
        ...(search?.trim()
          ? {
              OR: [
                { title: { contains: search.trim(), mode: "insensitive" as const } },
                { clientName: { contains: search.trim(), mode: "insensitive" as const } },
                { company: { contains: search.trim(), mode: "insensitive" as const } },
              ],
            }
          : {}),
        ...(owner?.trim() ? { handoffOwner: { contains: owner.trim(), mode: "insensitive" as const } } : {}),
      },
      select: {
        id: true,
        title: true,
        clientName: true,
        company: true,
        status: true,
        completedAt: true,
        handoffStartedAt: true,
        handoffCompletedAt: true,
        handoffOwner: true,
        clientConfirmedAt: true,
      },
      orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
      take: 500,
    });

    type Row = (typeof projects)[0] & { handoffState: string };
    const rows: Row[] = projects.map((p) => {
      const hasStarted = !!p.handoffStartedAt;
      const hasCompleted = !!p.handoffCompletedAt;
      const hasClientConfirm = !!p.clientConfirmedAt;
      let handoffState = "completed_no_handoff";
      if (hasStarted && !hasCompleted) handoffState = "handoff_in_progress";
      else if (hasCompleted && hasClientConfirm) handoffState = "handoff_completed";
      else if (hasCompleted && !hasClientConfirm) handoffState = "handoff_missing_client_confirm";
      return { ...p, handoffState };
    });

    const filtered =
      statusFilter && statusFilter !== "all"
        ? rows.filter((r) => r.handoffState === statusFilter)
        : rows;

    const total = filtered.length;
    const pageItems = filtered.slice(pagination.skip, pagination.skip + pagination.pageSize);
    const meta = buildPaginationMeta(total, pagination);

    return NextResponse.json(
      paginatedResponse(
        pageItems.map((p) => ({
        id: p.id,
        title: p.title ?? "",
        clientName: p.clientName ?? null,
        company: p.company ?? null,
        status: p.status ?? "completed",
        completedAt: p.completedAt?.toISOString() ?? null,
        handoffStartedAt: p.handoffStartedAt?.toISOString() ?? null,
        handoffCompletedAt: p.handoffCompletedAt?.toISOString() ?? null,
        handoffOwner: p.handoffOwner ?? null,
        clientConfirmedAt: p.clientConfirmedAt?.toISOString() ?? null,
        handoffState: p.handoffState,
      })),
        meta
      )
    );
  });
}
