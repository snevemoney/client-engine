import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateOperatorBrief, getLatestOperatorBrief } from "@/lib/ops/operatorBrief";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brief = await getLatestOperatorBrief();
  if (!brief) return NextResponse.json({ brief: null, message: "No briefing yet. Click Brief Me to generate." });
  return NextResponse.json({ brief });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const brief = await generateOperatorBrief();
    return NextResponse.json({ brief });
  } catch (err) {
    console.error("[ops/brief]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Brief generation failed" },
      { status: 500 }
    );
  }
}
