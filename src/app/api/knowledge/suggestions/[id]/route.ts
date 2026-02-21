import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { KNOWLEDGE_ARTIFACT_TYPES } from "@/lib/knowledge/types";

const ALLOWED_STATUSES = new Set(["queued", "reviewed", "applied", "dismissed"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const status = body?.status;
  if (!status || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { error: "status must be one of: queued, reviewed, applied, dismissed" },
      { status: 400 }
    );
  }

  const artifact = await db.artifact.findFirst({
    where: {
      id,
      type: KNOWLEDGE_ARTIFACT_TYPES.IMPROVEMENT_SUGGESTION,
      lead: { source: "system", title: "Knowledge Engine Runs" },
    },
    select: { id: true, meta: true },
  });
  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta = (artifact.meta as Record<string, unknown>) ?? {};
  const updated = await db.artifact.update({
    where: { id },
    data: { meta: { ...meta, status } },
  });
  return NextResponse.json(updated);
}
