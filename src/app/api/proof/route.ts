import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";

export async function GET() {
  return withRouteTiming("GET /api/proof", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const artifacts = await db.artifact.findMany({
      where: { type: "proof_post" },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { lead: { select: { id: true, title: true } } },
    });

    return NextResponse.json(artifacts);
  });
}
