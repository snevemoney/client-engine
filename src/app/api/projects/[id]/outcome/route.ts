import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuth, withRouteTiming, checkStateChangeRateLimit } from "@/lib/api-utils";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const OutcomeSchema = z.object({
  actualRevenue: z.number().int().min(0).optional().nullable(),
  repeatClient: z.boolean().optional(),
  referralSource: z.string().max(5000).optional().nullable(),
  satisfactionScore: z.number().int().min(1).max(5).optional().nullable(),
  lessonsLearned: z.string().max(10000).optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("GET /api/projects/[id]/outcome", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const project = await db.project.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!project) return jsonError("Project not found", 404);

    const outcome = await db.outcome.findUnique({
      where: { projectId: id },
    });
    if (!outcome) return jsonError("Outcome not found", 404);

    return NextResponse.json(outcome);
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/projects/[id]/outcome", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const rl = checkStateChangeRateLimit(req, "projects-outcome", session.user?.id);
    if (rl) return rl;

    const { id } = await params;
    const project = await db.project.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!project) return jsonError("Project not found", 404);

    const body = await req.json().catch(() => null);
    const parsed = OutcomeSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid input", 400);

    try {
      const data = parsed.data;
      const outcome = await db.outcome.upsert({
        where: { projectId: id },
        create: {
          projectId: id,
          actualRevenue: data.actualRevenue ?? null,
          repeatClient: data.repeatClient ?? false,
          referralSource: data.referralSource ?? null,
          satisfactionScore: data.satisfactionScore ?? null,
          lessonsLearned: data.lessonsLearned ?? null,
        },
        update: {
          ...(data.actualRevenue !== undefined && { actualRevenue: data.actualRevenue }),
          ...(data.repeatClient !== undefined && { repeatClient: data.repeatClient }),
          ...(data.referralSource !== undefined && { referralSource: data.referralSource }),
          ...(data.satisfactionScore !== undefined && { satisfactionScore: data.satisfactionScore }),
          ...(data.lessonsLearned !== undefined && { lessonsLearned: data.lessonsLearned }),
        },
      });
      return NextResponse.json(outcome, { status: 201 });
    } catch (err) {
      console.error("[projects/outcome]", err);
      return jsonError("Failed to save outcome", 500);
    }
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("PATCH /api/projects/[id]/outcome", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const rl = checkStateChangeRateLimit(req, "projects-outcome", session.user?.id);
    if (rl) return rl;

    const { id } = await params;
    const project = await db.project.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!project) return jsonError("Project not found", 404);

    const body = await req.json().catch(() => null);
    const parsed = OutcomeSchema.partial().safeParse(body);
    if (!parsed.success) return jsonError("Invalid input", 400);

    try {
      const data = parsed.data;
      const outcome = await db.outcome.update({
        where: { projectId: id },
        data: {
          ...(data.actualRevenue !== undefined && { actualRevenue: data.actualRevenue }),
          ...(data.repeatClient !== undefined && { repeatClient: data.repeatClient }),
          ...(data.referralSource !== undefined && { referralSource: data.referralSource }),
          ...(data.satisfactionScore !== undefined && { satisfactionScore: data.satisfactionScore }),
          ...(data.lessonsLearned !== undefined && { lessonsLearned: data.lessonsLearned }),
        },
      });
      return NextResponse.json(outcome);
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "P2025") {
        return jsonError("Outcome not found", 404);
      }
      console.error("[projects/outcome]", err);
      return jsonError("Failed to update outcome", 500);
    }
  });
}
