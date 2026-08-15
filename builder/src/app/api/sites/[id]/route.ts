/**
 * GET /api/sites/[id] — Get site with sections.
 * PATCH /api/sites/[id] — Update sections.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function requireAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const key = process.env.BUILDER_API_KEY ?? "dev-key";
  return auth === `Bearer ${key}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const sections = JSON.parse(site.sections || "[]") as { type: string; props: Record<string, unknown> }[];
  const pages = JSON.parse(site.pages || "[]") as string[];

  return NextResponse.json({
    siteId: site.id,
    status: site.status,
    previewUrl: site.previewUrl,
    liveUrl: site.liveUrl,
    pages,
    clientName: site.clientName,
    industry: site.industry,
    sections,
    contentHints: site.contentHints,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const sections = body.sections as { type: string; props: Record<string, unknown> }[] | undefined;
  if (!Array.isArray(sections)) {
    return NextResponse.json({ error: "sections required" }, { status: 400 });
  }

  const site = await prisma.site.update({
    where: { id },
    data: { sections: JSON.stringify(sections), updatedAt: new Date() },
  });

  const parsedSections = JSON.parse(site.sections || "[]");
  return NextResponse.json({
    siteId: site.id,
    status: site.status,
    previewUrl: site.previewUrl,
    liveUrl: site.liveUrl,
    pages: JSON.parse(site.pages || "[]"),
    clientName: site.clientName,
    industry: site.industry,
    sections: parsedSections,
    contentHints: site.contentHints,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
  });
}
