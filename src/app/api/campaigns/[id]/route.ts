/**
 * GET /api/campaigns/[id] — get campaign. Auth: session.
 * PATCH /api/campaigns/[id] — update campaign. Auth: session.
 * DELETE /api/campaigns/[id] — delete campaign. Auth: session.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const RESERVED_SLUGS = new Set(["proof", "campaigns", "work", "api", "dashboard", "demos"]);

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug) && slug.length >= 1 && !RESERVED_SLUGS.has(slug);
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).optional(),
  filterTag: z.string().min(1).max(100).optional(),
  published: z.boolean().optional(),
  ctaLabel: z.string().max(100).optional().nullable(),
  ctaUrl: z.string().url().max(500).optional().or(z.literal("")).nullable(),
});

function toJson(c: { id: string; slug: string; title: string; filterTag: string; published: boolean; ctaLabel: string | null; ctaUrl: string | null; createdAt: Date; updatedAt: Date }) {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    filterTag: c.filterTag,
    published: c.published,
    ctaLabel: c.ctaLabel,
    ctaUrl: c.ctaUrl,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("GET /api/campaigns/[id]", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return jsonError("Campaign not found", 404);

    return NextResponse.json(toJson(campaign));
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("PATCH /api/campaigns/[id]", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid input", 400);

    const existing = await db.campaign.findUnique({ where: { id } });
    if (!existing) return jsonError("Campaign not found", 404);

    const data: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) data.title = parsed.data.title;
    if (parsed.data.filterTag !== undefined) data.filterTag = parsed.data.filterTag.toLowerCase().trim();
    if (parsed.data.published !== undefined) data.published = parsed.data.published;
    if (parsed.data.ctaLabel !== undefined) data.ctaLabel = parsed.data.ctaLabel || null;
    if (parsed.data.ctaUrl !== undefined) data.ctaUrl = parsed.data.ctaUrl && parsed.data.ctaUrl !== "" ? parsed.data.ctaUrl : null;

    if (parsed.data.slug !== undefined) {
      if (!isValidSlug(parsed.data.slug)) return jsonError("Invalid or reserved slug", 400);
      const duplicate = await db.campaign.findFirst({ where: { slug: parsed.data.slug, id: { not: id } } });
      if (duplicate) return jsonError("Campaign slug already exists", 409);
      data.slug = parsed.data.slug;
    }

    if (Object.keys(data).length === 0) return jsonError("No updates provided", 400);

    const updated = await db.campaign.update({ where: { id }, data });
    return NextResponse.json(toJson(updated));
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("DELETE /api/campaigns/[id]", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign) return jsonError("Campaign not found", 404);

    await db.campaign.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
