/**
 * GET /api/delivery-projects/[id]/builder/admin
 *
 * Authenticated redirect to the builder admin URL. BUILDER_API_KEY stays
 * server-side; the delivery UI never interpolates it (no "dev-key" fallback).
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("GET /api/delivery-projects/[id]/builder/admin", async () => {
    const { id } = await params;
    const result = await requireDeliveryProject(id);
    if (!result.ok) return result.response;
    const { project } = result;

    if (!project.builderSiteId || !project.builderPreviewUrl) {
      return jsonError("No builder site linked to this project", 400, "NO_SITE");
    }

    const key = process.env.BUILDER_API_KEY?.trim();
    if (!key) {
      return jsonError("BUILDER_API_KEY is not configured", 503);
    }

    const adminPath =
      String(project.builderPreviewUrl).replace(/\/preview\//, "/sites/") +
      "/admin?token=" +
      encodeURIComponent(key);

    const location = /^https?:\/\//i.test(adminPath)
      ? adminPath
      : new URL(adminPath, req.url).toString();

    return NextResponse.redirect(location);
  });
}
