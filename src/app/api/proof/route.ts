import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withRouteTiming } from "@/lib/api-utils";

export async function GET() {
  return withRouteTiming("GET /api/proof", async () => {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const artifacts = await db.artifact.findMany({
      where: { type: "proof_post" },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { lead: { select: { id: true, title: true } } },
    });

    return NextResponse.json(artifacts);
  });
}
