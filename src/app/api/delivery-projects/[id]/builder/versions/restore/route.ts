/**
 * POST /api/delivery-projects/[id]/builder/versions/restore — Restore sections from a version.
 * Body: { versionId: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireDeliveryProject, jsonError, withRouteTiming } from "@/lib/api-utils";
import { restoreSectionVersion } from "@/lib/builder/client";

const BodySchema = z.object({ versionId: z.string().min(1) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRouteTiming(
    "POST /api/delivery-projects/[id]/builder/versions/restore",
    async () => {
      const { id } = await params;
      const result = await requireDeliveryProject(id);
      if (!result.ok) return result.response;
      const { project } = result;

      if (!project.builderSiteId) {
        return NextResponse.json(
          { error: "No builder site for this project" },
          { status: 404 },
        );
      }

      const body = await req.json().catch(() => null);
      const parsed = BodySchema.safeParse(body);
      if (!parsed.success) {
        return jsonError(parsed.error.issues.map((i) => i.message).join("; "), 400);
      }

      try {
        const data = await restoreSectionVersion(
          project.builderSiteId,
          parsed.data.versionId,
        );
        return NextResponse.json(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to restore version";
        return NextResponse.json({ error: msg }, { status: 502 });
      }
    },
  );
}
