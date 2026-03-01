/**
 * PATCH /api/delivery-projects/[id]/builder/support/[requestId] — update a support request
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { updateSupportRequest } from "@/lib/builder/client";

type RouteCtx = { params: Promise<{ id: string; requestId: string }> };

const PatchSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved"]).optional(),
  resolution: z.string().max(2000).optional(),
}).refine(
  (d) => d.status || d.resolution,
  { message: "Provide at least status or resolution" },
);

export async function PATCH(
  req: NextRequest,
  { params }: RouteCtx,
) {
  return withRouteTiming(
    "PATCH /api/delivery-projects/[id]/builder/support/[requestId]",
    async () => {
      const { id, requestId } = await params;
      const result = await requireDeliveryProject(id);
      if (!result.ok) return result.response;
      const { project } = result;

      if (!project.builderSiteId) {
        return jsonError("No builder site linked to this project", 400, "NO_SITE");
      }

      const body = await req.json().catch(() => null);
      const parsed = PatchSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError(
          parsed.error.issues.map((i) => i.message).join("; "),
          400,
          "INVALID_INPUT",
        );
      }

      const updated = await updateSupportRequest(
        project.builderSiteId,
        requestId,
        parsed.data,
      );

      return NextResponse.json(updated);
    },
  );
}
