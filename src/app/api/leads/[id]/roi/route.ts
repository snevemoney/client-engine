import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { estimateLeadRoi, getLeadRoiEstimate } from "@/lib/revenue/roi";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const roi = await getLeadRoiEstimate(id);
    return NextResponse.json(roi ? { estimate: roi.meta, content: roi.content } : { estimate: null });
  } catch (e) {
    console.error("[leads roi GET]", e);
    return NextResponse.json({ error: "Failed to load ROI" }, { status: 500 });
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const { artifactId, estimate } = await estimateLeadRoi(id);
    return NextResponse.json({ artifactId, estimate });
  } catch (e) {
    console.error("[leads roi POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ROI estimation failed" },
      { status: 500 }
    );
  }
}
