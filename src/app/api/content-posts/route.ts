import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

/** GET /api/content-posts — list content posts with filters */
export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/content-posts", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const platform = url.searchParams.get("platform");
    const proofRecordId = url.searchParams.get("proofRecordId");
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") ?? "20", 10),
      50
    );

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (platform) where.platform = platform;
    if (proofRecordId) where.proofRecordId = proofRecordId;

    const rows = await db.contentPost.findMany({
      where,
      select: {
        id: true,
        proofRecordId: true,
        proofRecord: { select: { title: true } },
        platform: true,
        content: true,
        status: true,
        scheduledFor: true,
        postedAt: true,
        generatedBy: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const posts = rows.map(({ proofRecord, ...rest }) => ({
      ...rest,
      proofTitle: proofRecord?.title ?? null,
    }));

    return NextResponse.json({ ok: true, count: posts.length, posts });
  });
}
