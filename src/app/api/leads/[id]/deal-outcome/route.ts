import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { outcome?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON with outcome: 'won' or 'lost'" }, { status: 400 });
  }
  const outcome = body?.outcome === "won" || body?.outcome === "lost" ? body.outcome : null;
  if (!outcome) {
    return NextResponse.json({ error: "outcome must be 'won' or 'lost'" }, { status: 400 });
  }

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const updated = await db.lead.update({
    where: { id },
    data: { dealOutcome: outcome },
  });
  return NextResponse.json(updated);
}
