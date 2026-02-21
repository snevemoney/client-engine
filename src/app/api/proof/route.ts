import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const artifacts = await db.artifact.findMany({
    where: { type: "proof_post" },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { lead: { select: { id: true, title: true } } },
  });

  return NextResponse.json(artifacts);
}
