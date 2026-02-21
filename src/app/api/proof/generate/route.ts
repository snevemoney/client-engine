import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildProofPost } from "@/lib/proof-engine/generate";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const leadId = body.leadId as string | undefined;
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

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
      meta,
    },
  });

  return NextResponse.json({
    content,
    artifactId: artifact.id,
    leadTitle: result.leadTitle,
  });
}
