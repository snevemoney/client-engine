import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOpportunityBriefForLead } from "@/lib/ops/opportunityBrief";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const brief = await getOpportunityBriefForLead(id);
  if (!brief) return NextResponse.json({ error: "Lead not found or no data" }, { status: 404 });
  return NextResponse.json(brief);
}
