/**
 * Phase 6.2: GET/PUT /api/internal/founder/os/week — Week plan + review.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { ingestFromFounderWeekReview } from "@/lib/memory/ingest";
import { db } from "@/lib/db";
import { withSummaryCache } from "@/lib/http/cached-handler";
import {
  getWeekStart,
  getWeekEnd,
  parseWeekStart,
  formatWeekStart,
  getCurrentQuarter,
} from "@/lib/founder/os/week-utils";
import { z } from "zod";

export const dynamic = "force-dynamic";

const JsonArraySchema = z.array(z.unknown());
const PutSchema = z.object({
  focusConstraint: z.string().max(500).optional().nullable(),
  plan: z
    .object({
      topOutcomes: JsonArraySchema.optional(),
      milestones: JsonArraySchema.optional(),
      commitments: JsonArraySchema.optional(),
    })
    .optional(),
  review: z
    .object({
      wins: JsonArraySchema.optional(),
      misses: JsonArraySchema.optional(),
      deltas: JsonArraySchema.optional(),
      decisions: JsonArraySchema.optional(),
      retroNotes: z.string().max(5000).optional().nullable(),
    })
    .optional(),
});

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/internal/founder/os/week", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const weekStartParam = request.nextUrl.searchParams.get("weekStart");
    const now = new Date();
    const weekStart = weekStartParam
      ? parseWeekStart(weekStartParam)
      : getWeekStart(now);

    if (!weekStart) {
      return jsonError("Invalid weekStart (use YYYY-MM-DD)", 400);
    }

    const weekEnd = getWeekEnd(weekStart);
    const key = formatWeekStart(weekStart);

    try {
      return await withSummaryCache(`founder/os/week:${key}`, async () => {
        let week = await db.founderWeek.findUnique({
          where: { weekStart },
          include: { plan: true, review: true, quarter: true },
        });

        if (!week) {
          const { startsAt, endsAt, title } = getCurrentQuarter(weekStart);
          const quarter = await db.founderQuarter.findFirst({
            where: { startsAt: { lte: weekStart }, endsAt: { gte: weekEnd } },
          });
          return {
            week: {
              id: null,
              weekStart: weekStart.toISOString(),
              weekEnd: weekEnd.toISOString(),
              quarterId: quarter?.id ?? null,
              focusConstraint: null,
              createdAt: null,
              updatedAt: null,
            },
            plan: { topOutcomes: [], milestones: [], commitments: [] },
            review: { wins: [], misses: [], deltas: [], decisions: [], retroNotes: null },
          };
        }

        const plan = week.plan ?? { topOutcomesJson: [], milestonesJson: [], commitmentsJson: [] };
        const review = week.review ?? {
          winsJson: [],
          missesJson: [],
          deltasJson: [],
          decisionsJson: [],
          retroNotes: null,
        };

        return {
          week: {
            id: week.id,
            weekStart: week.weekStart.toISOString(),
            weekEnd: week.weekEnd.toISOString(),
            quarterId: week.quarterId,
            focusConstraint: week.focusConstraint,
            createdAt: week.createdAt.toISOString(),
            updatedAt: week.updatedAt.toISOString(),
          },
          plan: {
            topOutcomes: (plan.topOutcomesJson as unknown[]) ?? [],
            milestones: (plan.milestonesJson as unknown[]) ?? [],
            commitments: (plan.commitmentsJson as unknown[]) ?? [],
          },
          review: {
            wins: (review.winsJson as unknown[]) ?? [],
            misses: (review.missesJson as unknown[]) ?? [],
            deltas: (review.deltasJson as unknown[]) ?? [],
            decisions: (review.decisionsJson as unknown[]) ?? [],
            retroNotes: review.retroNotes,
          },
        };
      }, 15_000);
    } catch (err) {
      console.error("[founder/os/week]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}

export async function PUT(request: NextRequest) {
  return withRouteTiming("PUT /api/internal/founder/os/week", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const weekStartParam = request.nextUrl.searchParams.get("weekStart");
    const now = new Date();
    const weekStart = weekStartParam
      ? parseWeekStart(weekStartParam)
      : getWeekStart(now);

    if (!weekStart) {
      return jsonError("Invalid weekStart (use YYYY-MM-DD)", 400);
    }

    try {
      const body = await request.json();
      const parsed = PutSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError(parsed.error.message, 400);
      }

      const weekEnd = getWeekEnd(weekStart);
      const { startsAt, endsAt, title } = getCurrentQuarter(weekStart);

      let week = await db.founderWeek.findUnique({
        where: { weekStart },
        include: { plan: true, review: true },
      });

      if (!week) {
        const quarter = await db.founderQuarter.findFirst({
          where: { startsAt: { lte: weekStart }, endsAt: { gte: weekEnd } },
        });
        if (!quarter) {
          await db.founderQuarter.create({
            data: { startsAt, endsAt, title },
          });
        }
        const q = await db.founderQuarter.findFirst({
          where: { startsAt: { lte: weekStart }, endsAt: { gte: weekEnd } },
        });
        week = await db.founderWeek.create({
          data: {
            weekStart,
            weekEnd,
            quarterId: q?.id ?? null,
          },
          include: { plan: true, review: true },
        });
      }

      if (parsed.data.focusConstraint !== undefined) {
        await db.founderWeek.update({
          where: { id: week.id },
          data: { focusConstraint: parsed.data.focusConstraint },
        });
      }

      const plan = parsed.data.plan;
      if (plan) {
        const existingPlan = week.plan;
        const topOutcomes = plan.topOutcomes ?? (existingPlan?.topOutcomesJson as unknown[] ?? []);
        const milestones = plan.milestones ?? (existingPlan?.milestonesJson as unknown[] ?? []);
        const commitments = plan.commitments ?? (existingPlan?.commitmentsJson as unknown[] ?? []);

        if (existingPlan) {
          await db.founderWeekPlan.update({
            where: { id: existingPlan.id },
            data: {
              topOutcomesJson: topOutcomes,
              milestonesJson: milestones,
              commitmentsJson: commitments,
            },
          });
        } else {
          await db.founderWeekPlan.create({
            data: {
              weekId: week.id,
              topOutcomesJson: topOutcomes,
              milestonesJson: milestones,
              commitmentsJson: commitments,
            },
          });
        }
      }

      const review = parsed.data.review;
      if (review) {
        const existingReview = week.review;
        const wins = review.wins ?? (existingReview?.winsJson as unknown[] ?? []);
        const misses = review.misses ?? (existingReview?.missesJson as unknown[] ?? []);
        const deltas = review.deltas ?? (existingReview?.deltasJson as unknown[] ?? []);
        const decisions = review.decisions ?? (existingReview?.decisionsJson as unknown[] ?? []);
        const retroNotes = review.retroNotes !== undefined ? review.retroNotes : existingReview?.retroNotes ?? null;

        if (existingReview) {
          await db.founderWeekReview.update({
            where: { id: existingReview.id },
            data: {
              winsJson: wins,
              missesJson: misses,
              deltasJson: deltas,
              decisionsJson: decisions,
              retroNotes,
            },
          });
        } else {
          await db.founderWeekReview.create({
            data: {
              weekId: week.id,
              winsJson: wins,
              missesJson: misses,
              deltasJson: deltas,
              decisionsJson: decisions,
              retroNotes,
            },
          });
        }
        if (session.user?.id) {
          ingestFromFounderWeekReview(week.id, session.user.id).catch(() => {});
        }
      }

      const updated = await db.founderWeek.findUnique({
        where: { id: week.id },
        include: { plan: true, review: true },
      });

      const p = updated?.plan ?? { topOutcomesJson: [], milestonesJson: [], commitmentsJson: [] };
      const r = updated?.review ?? {
        winsJson: [],
        missesJson: [],
        deltasJson: [],
        decisionsJson: [],
        retroNotes: null,
      };

      return NextResponse.json({
        week: updated
          ? {
              id: updated.id,
              weekStart: updated.weekStart.toISOString(),
              weekEnd: updated.weekEnd.toISOString(),
              quarterId: updated.quarterId,
              focusConstraint: updated.focusConstraint,
            }
          : null,
        plan: {
          topOutcomes: (p.topOutcomesJson as unknown[]) ?? [],
          milestones: (p.milestonesJson as unknown[]) ?? [],
          commitments: (p.commitmentsJson as unknown[]) ?? [],
        },
        review: {
          wins: (r.winsJson as unknown[]) ?? [],
          misses: (r.missesJson as unknown[]) ?? [],
          deltas: (r.deltasJson as unknown[]) ?? [],
          decisions: (r.decisionsJson as unknown[]) ?? [],
          retroNotes: r.retroNotes,
        },
      });
    } catch (err) {
      console.error("[founder/os/week]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
