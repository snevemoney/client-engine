/**
 * GET /api/sites/[id]/feedback — AI feedback on site quality (stub).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireBuilderApiKey } from "@/lib/require-api-key";

function requireAuth(req: NextRequest): boolean {
  return requireBuilderApiKey(req);
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

  const sections = JSON.parse(site.sections || "[]") as { type: string }[];
  const sectionScores = sections.map((s) => ({
    type: s.type,
    score: 85,
    issues: [] as string[],
  }));

  return NextResponse.json({
    siteId: id,
    health: {
      score: 85,
      label: "good",
      sectionCount: sections.length,
      issueCount: 0,
    },
    sectionScores,
    missingSections: [],
    suggestions: ["Consider adding a hero background image for visual impact", "Adding a photo builds trust and personal connection"],
  });
}
