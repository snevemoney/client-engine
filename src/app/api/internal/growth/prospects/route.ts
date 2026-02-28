/**
 * Phase 6.3: GET/POST /api/internal/growth/prospects
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { ProspectPlatform } from "@prisma/client";

export const dynamic = "force-dynamic";

const PLATFORMS = Object.values(ProspectPlatform);

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
  return withRouteTiming("GET /api/internal/growth/prospects", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const userId = session.user?.id;
    if (!userId) return jsonError("Unauthorized", 401);

    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const platform = request.nextUrl.searchParams.get("platform")?.trim();
    const minScore = request.nextUrl.searchParams.get("minScore");
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(50, Math.max(10, parseInt(request.nextUrl.searchParams.get("pageSize") ?? "20", 10)));

    try {
      const where: Record<string, unknown> = {
        deals: { some: { ownerUserId: userId } },
      };
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { handle: { contains: search, mode: "insensitive" } },
          { niche: { contains: search, mode: "insensitive" } },
        ];
      }
      if (platform && PLATFORMS.includes(platform as ProspectPlatform)) {
        where.platform = platform;
      }
      if (minScore) {
        const score = parseInt(minScore, 10);
        if (!isNaN(score)) where.opportunityScore = { gte: score };
      }

      const [items, total] = await Promise.all([
        db.prospect.findMany({
          where,
          include: {
            deals: {
              where: { ownerUserId: userId },
              select: { id: true, stage: true, nextFollowUpAt: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        db.prospect.count({ where }),
      ]);

      return NextResponse.json({
        items,
        total,
        page,
        pageSize,
      });
    } catch (err) {
      console.error("[growth/prospects]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/internal/growth/prospects", async () => {
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
    const name = typeof b.name === "string" ? b.name.trim() : null;
    const platform = b.platform && PLATFORMS.includes(b.platform as ProspectPlatform) ? (b.platform as ProspectPlatform) : null;

    if (!name || !platform) return jsonError("name and platform required", 400);

    const handle = typeof b.handle === "string" ? b.handle.trim() || null : null;
    const niche = typeof b.niche === "string" ? b.niche.trim() || null : null;
    const followers = typeof b.followers === "number" ? b.followers : b.followers != null ? parseInt(String(b.followers), 10) : null;
    const bioUrl = typeof b.bioUrl === "string" ? b.bioUrl.trim() || null : null;
    const currentWebPresence = typeof b.currentWebPresence === "string" ? b.currentWebPresence.trim() || null : null;
    const opportunityScore =
      typeof b.opportunityScore === "number"
        ? Math.max(1, Math.min(10, b.opportunityScore))
        : b.opportunityScore != null
          ? Math.max(1, Math.min(10, parseInt(String(b.opportunityScore), 10)))
          : null;
    const notes = typeof b.notes === "string" ? b.notes.trim() || null : null;

    try {
      const prospect = await db.prospect.create({
        data: {
          name,
          handle: handle || undefined,
          platform,
          niche: niche ?? undefined,
          followers: followers ?? undefined,
          bioUrl: bioUrl ?? undefined,
          currentWebPresence: currentWebPresence ?? undefined,
          opportunityScore: opportunityScore ?? undefined,
          notes: notes ?? undefined,
        },
      });

      const deal = await db.deal.create({
        data: {
          prospectId: prospect.id,
          stage: "new",
          ownerUserId: userId,
        },
      });

      return NextResponse.json({
        prospect: { ...prospect, deals: [{ id: deal.id, stage: deal.stage, nextFollowUpAt: deal.nextFollowUpAt }] },
        deal,
      });
    } catch (err) {
      console.error("[growth/prospects]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
