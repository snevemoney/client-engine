/**
 * GET  /api/delivery-projects/[id]/builder/sections — fetch site sections
 * PATCH /api/delivery-projects/[id]/builder/sections — update site sections
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { getSiteWithSections, updateSiteSections } from "@/lib/builder/client";

type RouteCtx = { params: Promise<{ id: string }> };

const VALID_SECTION_TYPES = ["hero", "about", "services", "testimonials", "booking", "contact", "footer"] as const;

const SectionSchema = z.object({
  type: z.enum(VALID_SECTION_TYPES),
  props: z.record(z.string(), z.unknown()),
});

const PatchSchema = z.object({
  sections: z.array(SectionSchema).min(1, "At least one section is required"),
});

export async function GET(
  _req: NextRequest,
  { params }: RouteCtx,
) {
  return withRouteTiming(
    "GET /api/delivery-projects/[id]/builder/sections",
    async () => {
      const { id } = await params;
      const result = await requireDeliveryProject(id);
      if (!result.ok) return result.response;
      const { project } = result;

      if (!project.builderSiteId) {
        return jsonError("No builder site linked to this project", 400, "NO_SITE");
      }

      const site = await getSiteWithSections(project.builderSiteId);
      return NextResponse.json({ sections: site.sections });
    },
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteCtx,
) {
  return withRouteTiming(
    "PATCH /api/delivery-projects/[id]/builder/sections",
    async () => {
      const { id } = await params;
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

      const updated = await updateSiteSections(project.builderSiteId, parsed.data.sections);
      return NextResponse.json({ sections: updated.sections });
    },
  );
}
