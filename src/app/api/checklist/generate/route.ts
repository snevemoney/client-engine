import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildChecklistContent, CHECKLIST_TITLE } from "@/lib/proof-engine/checklist";
import { getOrCreateProofChecklistSystemLead } from "@/lib/proof-engine/system-lead";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const keywords = Array.isArray(body.keywords) ? body.keywords as string[] : undefined;
  const requestSource = body.requestSource === "proof_post" ? "proof_post" : "manual";
  const proofPostArtifactId = typeof body.proofPostArtifactId === "string" ? body.proofPostArtifactId : undefined;

  const opts = { keywords, requestSource, proofPostArtifactId };
  const content = buildChecklistContent(opts);

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
      meta,
    },
  });

  return NextResponse.json({
    content,
    artifactId: artifact.id,
  });
}
