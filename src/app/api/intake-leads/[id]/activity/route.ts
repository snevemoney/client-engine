import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LeadActivityType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

const TYPES = ["note", "status_change", "score", "draft", "sent", "followup", "manual"] as const;

const PostSchema = z.object({
  type: z.enum(TYPES).optional().default("note"),
  content: z.string().min(1, "Content required").max(5000),
  metadataJson: z.record(z.string(), z.unknown()).optional().nullable(),
});

function safeActivity(a: { id: string; type: string; content: string; metadataJson: unknown; createdAt: Date }) {
  return {
    id: a.id,
    type: a.type,
    content: a.content ?? "",
    metadataJson: a.metadataJson ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/intake-leads/[id]/activity", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const existing = await db.intakeLead.findUnique({ where: { id } });
    if (!existing) return jsonError("Lead not found", 404);

    const raw = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return jsonError(msg || "Invalid request body", 400, "VALIDATION");
    }
    const body = parsed.data;

    const activity = await db.leadActivity.create({
      data: {
        intakeLeadId: id,
        type: (body.type as LeadActivityType) ?? LeadActivityType.note,
        content: body.content,
        metadataJson: body.metadataJson ?? undefined,
      },
    });

    return NextResponse.json(safeActivity(activity), { status: 201 });
  });
}
