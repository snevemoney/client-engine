/**
 * Phase 6.3: GET/POST /api/internal/growth/deals
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { DealStage, DealPriority } from "@prisma/client";

export const dynamic = "force-dynamic";

const STAGES = Object.values(DealStage);
const PRIORITIES = Object.values(DealPriority);

function rateLimitMutate(request: NextRequest, userId: string) {
  const clientKey = getRequestClientKey(request, userId);
  const rl = rateLimitByKey({ key: `rl:growth:${clientKey}`, windowMs: 60_000, max: 20 });
  if (!rl.ok) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return jsonError("Rate limit exceeded", 429, undefined, {
      headers: { "Retry-After": String(retryAfter) },
      bodyExtra: { retryAfterSeconds: retryAfter },
    });
  }
  return null;
}

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/internal/growth/deals", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const userId = session.user?.id;
    if (!userId) return jsonError("Unauthorized", 401);

    const stage = request.nextUrl.searchParams.get("stage")?.trim();
    const due = request.nextUrl.searchParams.get("due")?.trim(); // overdue | today | week
    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(50, Math.max(10, parseInt(request.nextUrl.searchParams.get("pageSize") ?? "20", 10)));

    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfWeek = new Date(startOfToday);
      endOfWeek.setDate(endOfWeek.getDate() + 8);

      const where: Record<string, unknown> = { ownerUserId: userId };

      if (stage && STAGES.includes(stage as DealStage)) {
        where.stage = stage;
      }

      if (due === "overdue") {
        where.nextFollowUpAt = { lt: startOfToday, not: null };
      } else if (due === "today") {
        where.nextFollowUpAt = { gte: startOfToday, lt: endOfWeek };
      } else if (due === "week") {
        where.nextFollowUpAt = { gte: startOfToday, lt: endOfWeek };
      }

      if (search) {
        where.prospect = {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { handle: { contains: search, mode: "insensitive" } },
          ],
        };
      }

      const [items, total] = await Promise.all([
        db.deal.findMany({
          where,
          include: {
            prospect: { select: { id: true, name: true, handle: true, platform: true, opportunityScore: true } },
          },
          orderBy: [{ nextFollowUpAt: "asc" }, { updatedAt: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        db.deal.count({ where }),
      ]);

      return NextResponse.json({
        items,
        total,
        page,
        pageSize,
      });
    } catch (err) {
      console.error("[growth/deals]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/internal/growth/deals", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const userId = session.user?.id;
    if (!userId) return jsonError("Unauthorized", 401);

    const rateErr = rateLimitMutate(request, userId);
    if (rateErr) return rateErr;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    if (!body || typeof body !== "object") return jsonError("Body must be an object", 400);

    const b = body as Record<string, unknown>;
    const prospectId = typeof b.prospectId === "string" ? b.prospectId.trim() : null;
    if (!prospectId) return jsonError("prospectId required", 400);

    const stage = b.stage && STAGES.includes(b.stage as DealStage) ? (b.stage as DealStage) : "new";
    const priority = b.priority && PRIORITIES.includes(b.priority as DealPriority) ? (b.priority as DealPriority) : "medium";
    const valueCad = typeof b.valueCad === "number" ? b.valueCad : b.valueCad != null ? parseInt(String(b.valueCad), 10) : null;

    try {
      const prospect = await db.prospect.findUnique({ where: { id: prospectId } });
      if (!prospect) return jsonError("Prospect not found", 404);

      const deal = await db.deal.create({
        data: {
          prospectId,
          stage,
          priority,
          valueCad: valueCad ?? undefined,
          ownerUserId: userId,
        },
      });

      return NextResponse.json({
        deal: {
          ...deal,
          prospect: { id: prospect.id, name: prospect.name, handle: prospect.handle, platform: prospect.platform, opportunityScore: prospect.opportunityScore },
        },
      });
    } catch (err) {
      console.error("[growth/deals]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
