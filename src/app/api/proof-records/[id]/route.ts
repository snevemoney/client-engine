import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

const PatchSchema = z.object({
  proofSnippet: z.string().max(5000).optional().nullable(),
  beforeState: z.string().max(2000).optional().nullable(),
  afterState: z.string().max(2000).optional().nullable(),
  metricValue: z.string().max(100).optional().nullable(),
  metricLabel: z.string().max(100).optional().nullable(),
});

/** PATCH /api/proof-records/[id] */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("PATCH /api/proof-records/[id]", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const existing = await db.proofRecord.findUnique({ where: { id } });
    if (!existing) return jsonError("Proof record not found", 404);

    const raw = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return jsonError(msg || "Invalid request body", 400, "VALIDATION");
    }
    const body = parsed.data;

    const record = await db.proofRecord.update({
      where: { id },
      data: {
        proofSnippet: body.proofSnippet !== undefined ? body.proofSnippet : undefined,
        beforeState: body.beforeState !== undefined ? body.beforeState : undefined,
        afterState: body.afterState !== undefined ? body.afterState : undefined,
        metricValue: body.metricValue !== undefined ? body.metricValue : undefined,
        metricLabel: body.metricLabel !== undefined ? body.metricLabel : undefined,
      },
    });

    return NextResponse.json({
      id: record.id,
      proofSnippet: record.proofSnippet ?? null,
      beforeState: record.beforeState ?? null,
      afterState: record.afterState ?? null,
      metricValue: record.metricValue ?? null,
      metricLabel: record.metricLabel ?? null,
      updatedAt: record.updatedAt.toISOString(),
    });
  });
}
