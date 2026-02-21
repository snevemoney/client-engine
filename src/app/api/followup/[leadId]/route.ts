import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateFollowUpSequence, getFollowUpSequence, logTouchSent } from "@/lib/revenue/followup";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { leadId } = await params;
  try {
    const seq = await getFollowUpSequence(leadId);
    return NextResponse.json(seq ?? { sequence: null });
  } catch (e) {
    console.error("[followup GET]", e);
    return NextResponse.json({ error: "Failed to load sequence" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { leadId } = await params;
  let body: { action?: string; touchIndex?: number; note?: string };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }
  if (body.action === "logTouch" && typeof body.touchIndex === "number") {
    try {
      await logTouchSent(leadId, body.touchIndex, body.note);
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error("[followup logTouch]", e);
      return NextResponse.json({ error: "Failed to log touch" }, { status: 500 });
    }
  }
  try {
    const { artifactId, touches } = await generateFollowUpSequence(leadId);
    return NextResponse.json({ artifactId, touches });
  } catch (e) {
    console.error("[followup POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate sequence" },
      { status: 500 }
    );
  }
}
