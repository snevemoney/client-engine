import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonError, requireAuth } from "@/lib/api-utils";
import { buildChecklistContent, CHECKLIST_TITLE } from "@/lib/proof-engine/checklist";
import { getOrCreateProofChecklistSystemLead } from "@/lib/proof-engine/system-lead";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const keywords = Array.isArray(body.keywords) ? (body.keywords as string[]) : undefined;
  const requestSource: "proof_post" | "manual" = body.requestSource === "proof_post" ? "proof_post" : "manual";
  const proofPostArtifactId = typeof body.proofPostArtifactId === "string" ? body.proofPostArtifactId : undefined;

  const content = buildChecklistContent({ keywords, requestSource, proofPostArtifactId });

  const systemLeadId = await getOrCreateProofChecklistSystemLead();
  const meta: Record<string, unknown> = {
    requestSource,
    generatedAt: new Date().toISOString(),
  };
  if (keywords?.length) meta.keywords = keywords;
  if (proofPostArtifactId) meta.proofPostArtifactId = proofPostArtifactId;

  const artifact = await db.artifact.create({
    data: {
      leadId: systemLeadId,
      type: "checklist",
      title: CHECKLIST_TITLE,
      content,
      meta: meta as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({
    content,
    artifactId: artifact.id,
  });
}
