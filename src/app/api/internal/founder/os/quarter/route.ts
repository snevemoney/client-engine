/**
 * Phase 6.2: GET/PUT /api/internal/founder/os/quarter — Current quarter.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { getCurrentQuarter } from "@/lib/founder/os/week-utils";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PutSchema = z.object({
  title: z.string().max(200).optional(),
  notes: z.string().max(5000).optional().nullable(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export async function GET() {
  return withRouteTiming("GET /api/internal/founder/os/quarter", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      return await withSummaryCache("founder/os/quarter", async () => {
        const now = new Date();
        const { startsAt, endsAt, title } = getCurrentQuarter(now);

        const quarter = await db.founderQuarter.findFirst({
          where: {
            startsAt: { lte: now },
            endsAt: { gte: now },
          },
          include: { kpis: true },
          orderBy: { startsAt: "desc" },
        });

        if (quarter) {
          return {
            id: quarter.id,
            startsAt: quarter.startsAt.toISOString(),
            endsAt: quarter.endsAt.toISOString(),
            title: quarter.title,
            notes: quarter.notes,
            kpis: quarter.kpis.map((k) => ({
              id: k.id,
              key: k.key,
              label: k.label,
              targetValue: k.targetValue,
              currentValue: k.currentValue,
              unit: k.unit,
            })),
          };
        }

        return {
          id: null,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          title,
          notes: null,
          kpis: [],
        };
      }, 15_000);
    } catch (err) {
      console.error("[founder/os/quarter]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}

export async function PUT(request: NextRequest) {
  return withRouteTiming("PUT /api/internal/founder/os/quarter", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      const body = await request.json();
      const parsed = PutSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError(parsed.error.message, 400);
      }

      const now = new Date();
      const { startsAt, endsAt, title: defaultTitle } = getCurrentQuarter(now);

      const data = parsed.data;
      const startsAtDate = data.startsAt ? new Date(data.startsAt) : startsAt;
      const endsAtDate = data.endsAt ? new Date(data.endsAt) : endsAt;

      const existing = await db.founderQuarter.findFirst({
        where: {
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
      });

      if (existing) {
        const updated = await db.founderQuarter.update({
          where: { id: existing.id },
          data: {
            ...(data.title !== undefined && { title: data.title }),
            ...(data.notes !== undefined && { notes: data.notes }),
            ...(data.startsAt && { startsAt: startsAtDate }),
            ...(data.endsAt && { endsAt: endsAtDate }),
          },
        });
        return NextResponse.json({
          id: updated.id,
          startsAt: updated.startsAt.toISOString(),
          endsAt: updated.endsAt.toISOString(),
          title: updated.title,
          notes: updated.notes,
        });
      }

      const created = await db.founderQuarter.create({
        data: {
          startsAt: startsAtDate,
          endsAt: endsAtDate,
          title: data.title ?? defaultTitle,
          notes: data.notes ?? null,
        },
      });
      return NextResponse.json({
        id: created.id,
        startsAt: created.startsAt.toISOString(),
        endsAt: created.endsAt.toISOString(),
        title: created.title,
        notes: created.notes,
      });
    } catch (err) {
      console.error("[founder/os/quarter]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
