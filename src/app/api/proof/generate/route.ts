import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonError, requireAuth } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { buildProofPost, buildProofPostFromIntakeLead } from "@/lib/proof-engine/generate";

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const leadId = body.leadId as string | undefined;
  const intakeLeadId = body.intakeLeadId as string | undefined;

  if (intakeLeadId) {
    const intake = await db.intakeLead.findUnique({ where: { id: intakeLeadId } });
    if (!intake) return NextResponse.json({ error: "Intake lead not found" }, { status: 404 });

    const result = await buildProofPostFromIntakeLead(intakeLeadId);
    if (!result) return NextResponse.json({ error: "No proof candidates for this intake lead" }, { status: 400 });

    const content = result.lines.join("\n");
    return NextResponse.json({
      content,
      artifactId: null,
      leadTitle: result.leadTitle,
    });
  }

  if (!leadId) return NextResponse.json({ error: "leadId or intakeLeadId required" }, { status: 400 });

  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const result = await buildProofPost(leadId);
  if (!result) return NextResponse.json({ error: "Could not build proof post" }, { status: 500 });

  const content = result.lines.join("\n");
  const meta: Record<string, unknown> = {
    leadId,
    artifactIds: result.artifactIds,
    generatedAt: new Date().toISOString(),
  };
  if (result.totalCostApprox != null) meta.totalCostApprox = result.totalCostApprox;
  if (body.keywords && Array.isArray(body.keywords)) meta.keywords = body.keywords;

  const artifact = await db.artifact.create({
    data: {
      leadId,
      type: "proof_post",
      title: `Proof post: ${result.leadTitle.slice(0, 60)}`,
      content,
      meta: meta as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({
    content,
    artifactId: artifact.id,
    leadTitle: result.leadTitle,
  });
}
