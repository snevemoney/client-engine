/**
 * PATCH: update learning proposal artifact meta (promote to playbook, produced asset type).
 * Human approval gate: nothing auto-applies; this records curation decisions.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { LEARNING_ARTIFACT_TYPES } from "@/lib/learning/types";
import type { ProducedAssetType } from "@/lib/learning/types";

export const dynamic = "force-dynamic";

const PRODUCED_TYPES: ProducedAssetType[] = [
  "proposal_template",
  "case_study",
  "automation",
  "knowledge_only",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ artifactId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { artifactId } = await params;
  let body: { promotedToPlaybook?: boolean; producedAssetType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }

  const artifact = await db.artifact.findUnique({
    where: { id: artifactId },
    select: { id: true, type: true, meta: true, leadId: true },
  });

  if (!artifact || artifact.type !== LEARNING_ARTIFACT_TYPES.ENGINE_IMPROVEMENT_PROPOSAL) {
    return NextResponse.json({ error: "Proposal artifact not found" }, { status: 404 });
  }

  const meta = (artifact.meta ?? {}) as Record<string, unknown>;
  if (body.promotedToPlaybook === true) {
    meta.promotedToPlaybook = true;
    meta.promotedAt = new Date().toISOString();
  }
  if (typeof body.producedAssetType === "string" && PRODUCED_TYPES.includes(body.producedAssetType as ProducedAssetType)) {
    meta.producedAssetType = body.producedAssetType;
  }

  await db.artifact.update({
    where: { id: artifactId },
    data: { meta: meta as Prisma.InputJsonValue },
  });

  const updated = await db.artifact.findUnique({
    where: { id: artifactId },
    select: { id: true, meta: true },
  });
  return NextResponse.json(updated);
}
