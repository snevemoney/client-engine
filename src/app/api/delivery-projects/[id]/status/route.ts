/**
 * POST /api/delivery-projects/[id]/status — Set status.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeliveryProjectStatus } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

const STATUSES: DeliveryProjectStatus[] = [
  "not_started",
  "kickoff",
  "in_progress",
  "qa",
  "blocked",
  "completed",
  "archived",
];

const PostSchema = z.object({
  status: z.enum(STATUSES as unknown as [string, ...string[]]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/status", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const project = await db.deliveryProject.findUnique({ where: { id } });
    if (!project) return jsonError("Project not found", 404);

    const raw = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError("Invalid status", 400, "VALIDATION");
    }
    const status = parsed.data.status as DeliveryProjectStatus;

    if (status === "completed") {
      return jsonError("Use POST /complete for completion (validates readiness)", 400, "USE_COMPLETE");
    }

    const data: { status: DeliveryProjectStatus } = { status };

    await db.$transaction([
      db.deliveryProject.update({ where: { id }, data }),
      db.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "status_change",
          message: `Status set to ${status}`,
          metaJson: { previousStatus: project.status, newStatus: status },
        },
      }),
    ]);

    return NextResponse.json({ status });
  });
}
