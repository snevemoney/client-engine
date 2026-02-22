import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { KNOWLEDGE_ARTIFACT_TYPES } from "@/lib/knowledge/types";

const ALLOWED_STATUSES = new Set(["queued", "reviewed", "applied", "dismissed"]);

export const PRODUCED_TAGS = [
  "knowledge_only",
  "proposal_template",
  "playbook_update",
  "automation_change",
  "copy_snippet",
  "positioning_rule",
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { status?: string; produced?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.status != null && !ALLOWED_STATUSES.has(body.status)) {
    return NextResponse.json(
      { error: "status must be one of: queued, reviewed, applied, dismissed" },
      { status: 400 }
    );
  }
  if (body.produced != null && body.produced !== "" && !PRODUCED_TAGS.includes(body.produced as (typeof PRODUCED_TAGS)[number])) {
    return NextResponse.json(
      { error: `produced must be one of: ${PRODUCED_TAGS.join(", ")} or empty` },
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
  const updates: Record<string, unknown> = { ...meta };
  if (body.status !== undefined) updates.status = body.status;
  if (body.produced !== undefined) updates.produced = body.produced === "" ? null : body.produced;

  const updated = await db.artifact.update({
    where: { id },
    data: { meta: updates as Prisma.InputJsonValue },
  });
  return NextResponse.json(updated);
}
