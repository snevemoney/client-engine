/**
 * GET /api/campaigns — list campaigns. Auth: session.
 * POST /api/campaigns — create campaign. Auth: session.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const RESERVED_SLUGS = new Set(["proof", "campaigns", "work", "api", "dashboard", "demos"]);

function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "campaign";
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug) && slug.length >= 1 && !RESERVED_SLUGS.has(slug);
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().optional(),
  filterTag: z.string().min(1).max(100),
  published: z.boolean().optional(),
  ctaLabel: z.string().max(100).optional(),
  ctaUrl: z.string().url().max(500).optional().or(z.literal("")),
});

export async function GET() {
  return withRouteTiming("GET /api/campaigns", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const campaigns = await db.campaign.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(
      campaigns.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        filterTag: c.filterTag,
        published: c.published,
        ctaLabel: c.ctaLabel,
        ctaUrl: c.ctaUrl,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }))
    );
  });
}

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/campaigns", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid input", 400);

    const slug = parsed.data.slug ?? slugFromTitle(parsed.data.title);
    if (!isValidSlug(slug)) return jsonError("Invalid or reserved slug", 400);

    const existing = await db.campaign.findUnique({ where: { slug } });
    if (existing) return jsonError("Campaign slug already exists", 409);

    const campaign = await db.campaign.create({
      data: {
        slug,
        title: parsed.data.title,
        filterTag: parsed.data.filterTag.toLowerCase().trim(),
        published: parsed.data.published ?? false,
        ctaLabel: parsed.data.ctaLabel || null,
        ctaUrl: parsed.data.ctaUrl && parsed.data.ctaUrl !== "" ? parsed.data.ctaUrl : null,
      },
    });

    return NextResponse.json(
      {
        id: campaign.id,
        slug: campaign.slug,
        title: campaign.title,
        filterTag: campaign.filterTag,
        published: campaign.published,
        ctaLabel: campaign.ctaLabel,
        ctaUrl: campaign.ctaUrl,
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  });
}
