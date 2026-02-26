import { NextResponse } from "next/server";
import { jsonError, requireAuth } from "@/lib/api-utils";
import { db } from "@/lib/db";

export async function GET() {
  const session = await requireAuth();
  if (!session) return jsonError("Unauthorized", 401);

  const artifacts = await db.artifact.findMany({
    where: { type: "checklist" },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json(artifacts);
}
