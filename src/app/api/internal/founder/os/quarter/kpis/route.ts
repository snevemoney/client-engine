/**
 * Phase 6.2: GET/PUT /api/internal/founder/os/quarter/kpis — KPI targets.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { getCurrentQuarter } from "@/lib/founder/os/week-utils";
import { z } from "zod";

export const dynamic = "force-dynamic";

const KpiItemSchema = z.object({
  id: z.string().optional(),
  key: z.string().max(100),
  label: z.string().max(200),
  targetValue: z.number(),
  currentValue: z.number().optional().nullable(),
  unit: z.string().max(50).optional(),
});

const PutSchema = z.object({
  kpis: z.array(KpiItemSchema).max(20),
});

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/internal/founder/os/quarter/kpis", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      const quarterId = request.nextUrl.searchParams.get("quarterId");
      if (!quarterId) {
        return await withSummaryCache("founder/os/quarter/kpis:current", async () => {
          const now = new Date();
          const quarter = await db.founderQuarter.findFirst({
            where: { startsAt: { lte: now }, endsAt: { gte: now } },
            include: { kpis: true },
            orderBy: { startsAt: "desc" },
          });
          if (!quarter) return { kpis: [] };
          return {
            kpis: quarter.kpis.map((k) => ({
              id: k.id,
              key: k.key,
              label: k.label,
              targetValue: k.targetValue,
              currentValue: k.currentValue,
              unit: k.unit,
            })),
          };
        }, 15_000);
      }

      const quarter = await db.founderQuarter.findUnique({
        where: { id: quarterId },
        include: { kpis: true },
      });
      if (!quarter) return jsonError("Quarter not found", 404);

      return await withSummaryCache(`founder/os/quarter/kpis:${quarterId}`, async () => ({
        kpis: quarter.kpis.map((k) => ({
          id: k.id,
          key: k.key,
          label: k.label,
          targetValue: k.targetValue,
          currentValue: k.currentValue,
          unit: k.unit,
        })),
      }), 15_000);
    } catch (err) {
      console.error("[founder/os/quarter/kpis]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}

export async function PUT(request: NextRequest) {
  return withRouteTiming("PUT /api/internal/founder/os/quarter/kpis", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      const body = await request.json();
      const parsed = PutSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError(parsed.error.message, 400);
      }

      const quarterId = request.nextUrl.searchParams.get("quarterId");
      const now = new Date();
      let quarter = quarterId
        ? await db.founderQuarter.findUnique({ where: { id: quarterId } })
        : await db.founderQuarter.findFirst({
            where: { startsAt: { lte: now }, endsAt: { gte: now } },
            orderBy: { startsAt: "desc" },
          });

      if (!quarter) {
        const { startsAt, endsAt, title } = getCurrentQuarter(now);
        quarter = await db.founderQuarter.create({
          data: { startsAt, endsAt, title },
        });
      }

      const existing = await db.founderKPI.findMany({ where: { quarterId: quarter.id } });
      const existingIds = new Set(existing.map((k) => k.id));
      const incoming = parsed.data.kpis;

      for (const kpi of incoming) {
        if (kpi.id && existingIds.has(kpi.id)) {
          await db.founderKPI.update({
            where: { id: kpi.id },
            data: {
              key: kpi.key,
              label: kpi.label,
              targetValue: kpi.targetValue,
              currentValue: kpi.currentValue ?? null,
              unit: kpi.unit ?? "count",
            },
          });
        } else {
          await db.founderKPI.create({
            data: {
              quarterId: quarter.id,
              key: kpi.key,
              label: kpi.label,
              targetValue: kpi.targetValue,
              currentValue: kpi.currentValue ?? null,
              unit: kpi.unit ?? "count",
            },
          });
        }
      }

      const toDelete = existing.filter((e) => !incoming.some((i) => i.id === e.id));
      for (const k of toDelete) {
        await db.founderKPI.delete({ where: { id: k.id } });
      }

      const updated = await db.founderKPI.findMany({ where: { quarterId: quarter.id } });
      return NextResponse.json({
        kpis: updated.map((k) => ({
          id: k.id,
          key: k.key,
          label: k.label,
          targetValue: k.targetValue,
          currentValue: k.currentValue,
          unit: k.unit,
        })),
      });
    } catch (err) {
      console.error("[founder/os/quarter/kpis]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
