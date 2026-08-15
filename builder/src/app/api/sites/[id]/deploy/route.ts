/**
 * POST /api/sites/[id]/deploy — Deploy to production (stub).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function requireAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const key = process.env.BUILDER_API_KEY ?? "dev-key";
  return auth === `Bearer ${key}`;
}

export async function POST(
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

  const baseUrl = process.env.BUILDER_PUBLIC_URL ?? "http://localhost:3001";
  const liveUrl = `${baseUrl}/preview/${id}`;

  await prisma.site.update({
    where: { id },
    data: { status: "live", liveUrl, updatedAt: new Date() },
  });

  return NextResponse.json({
    siteId: id,
    liveUrl,
    status: "live",
  });
}
